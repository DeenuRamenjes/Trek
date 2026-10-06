import '../xlsx/textCodec';
import { workbookToBytes } from '@office-kit/xlsx/io';
import { createWorkbook, addWorksheet, type Workbook } from '@office-kit/xlsx/workbook';
import {
  addConditionalFormatting,
  makeCfRule,
  makeConditionalFormatting,
  makeSheetProtection,
  setCell,
  setColumnWidths,
  setFreezePanes,
  type Worksheet,
} from '@office-kit/xlsx/worksheet';
import { makeFormula } from '@office-kit/xlsx/cell';
import { setCellNumberFormat, FORMAT_TEXT } from '@office-kit/xlsx/styles';
import { colorScaleInnerXml, dataBarInnerXml } from '../xlsx/cfRules';
import { loadContextsFromSnapshot } from './contexts';
import type { ExportInfo } from './jsonBackup';
import { settingsEntries, TABLE_SPECS, tableRows, type Snapshot } from './snapshot';
import { completion, perGoal, rangeBounds } from '../../domain/statsCalculator';
import { bestStreak, currentStreak } from '../../domain/streaks';

export const XLSX_FORMAT = 'trek-xlsx';

/** Text shown in the app-computed headers. */
export const CALCULATED_BY_APP = 'calculated by app';

const LOG_RANGE_END = 100000;

const README_LINES = [
  'Trek backup (Excel)',
  '',
  'Dashboard: summary per goal and per group. Cells labelled "calculated by app" hold values computed by Trek (streaks, day counts, missed days, rates). The other cells are formulas over the Logs sheet.',
  'Goals, ScheduleVersions, Slots, Reminders, Groups, GroupGoals, GoalPauses, Logs, Vacations, VacationGoals: the raw data. One row per record, stable ids, ids, dates and times stored as text.',
  'Settings: app settings (the app-lock state is never exported).',
  '_Meta: schemaVersion, appVersion, exportedAt and format.',
  '',
  'To re-import: in Trek open Settings, Backup, Import and pick this file. Only the raw sheets and _Meta are read. Columns are matched by header name, so keep the header row. The Dashboard is ignored. Sheets are protected without a password, unprotect a sheet to edit it.',
];

function colName(n: number): string {
  let s = '';
  for (let c = n; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + ((c - 1) % 26)) + s;
  return s;
}

function textCell(wb: Workbook, ws: Worksheet, row: number, col: number, value: string): void {
  setCellNumberFormat(wb, setCell(ws, row, col, value), FORMAT_TEXT);
}

function finish(ws: Worksheet): void {
  setFreezePanes(ws, { rows: 1, cols: 0 });
  ws.sheetProtection = makeSheetProtection({ sheet: true });
}

function rawSheet(wb: Workbook, snapshot: Snapshot, spec: (typeof TABLE_SPECS)[number]): void {
  const ws = addWorksheet(wb, spec.sheet);
  spec.columns.forEach((c, i) => setCell(ws, 1, i + 1, c.name));
  tableRows(snapshot, spec.key).forEach((row, r) => {
    spec.columns.forEach((c, i) => {
      const v = row[c.name];
      if (v === null || v === undefined) return;
      if (c.kind === 'text') textCell(wb, ws, r + 2, i + 1, String(v));
      else if (c.kind === 'boolean') setCell(ws, r + 2, i + 1, Boolean(v));
      else setCell(ws, r + 2, i + 1, Number(v));
    });
  });
  finish(ws);
}

const DASH_HEADERS = [
  'Name',
  'ID',
  'Log entries',
  'Logs done',
  'Total value',
  'Average value',
  `Days done (${CALCULATED_BY_APP})`,
  `Days partial (${CALCULATED_BY_APP})`,
  `Days skipped (${CALCULATED_BY_APP})`,
  `Days vacation (${CALCULATED_BY_APP})`,
  `Days missed (${CALCULATED_BY_APP})`,
  `Partial credit (${CALCULATED_BY_APP})`,
  'Completion',
  `Last 30 days (${CALCULATED_BY_APP})`,
  `Current streak (${CALCULATED_BY_APP})`,
  `Best streak (${CALCULATED_BY_APP})`,
];

/** Builds the xlsx workbook bytes. No charts. */
export async function toXlsx(snapshot: Snapshot, info: ExportInfo & { today: string }): Promise<Uint8Array> {
  const wb = createWorkbook();
  const { settings } = snapshot;
  const weekStart = settings.weekStart;
  const contexts = loadContextsFromSnapshot(snapshot);
  const logs = snapshot.tables.logs;
  const earliest = contexts.reduce((m, c) => (c.goal.startDate < m ? c.goal.startDate : m), info.today);
  const all = rangeBounds('All', info.today, earliest);
  const last30 = rangeBounds('30D', info.today, earliest);
  const fraction = (credit: number, den: number) => (den > 0 ? credit / den : 0);

  // README
  const readme = addWorksheet(wb, 'README');
  README_LINES.forEach((line, i) => {
    if (line) setCell(readme, i + 1, 1, line);
  });
  setColumnWidths(readme, { 1: 120 });
  readme.sheetProtection = makeSheetProtection({ sheet: true });

  // Dashboard
  const dash = addWorksheet(wb, 'Dashboard');
  DASH_HEADERS.forEach((h, i) => setCell(dash, 1, i + 1, h));
  const logsSpec = TABLE_SPECS.find((s) => s.key === 'logs')!;
  const logCol = (name: string) => {
    const L = colName(logsSpec.columns.findIndex((c) => c.name === name) + 1);
    return `Logs!$${L}$2:$${L}$${LOG_RANGE_END}`;
  };
  const goalRange = logCol('goalId');
  const statusRange = logCol('status');
  const valueRange = logCol('value');

  const goalStats = perGoal(contexts, logs, all.from, all.to, info.today, 'weighted', weekStart);
  const goalRow = new Map<string, number>();
  const streaks = new Map<string, { current: number; best: number }>();

  const writeStatCells = (
    r: number,
    c: { done: number; partial: number; skipped: number; vacation: number; missed: number; credit: number; denominator: number },
    thirty: { credit: number; denominator: number },
    cur: number | null,
    best: number | null,
    curFormula?: string,
    bestFormula?: string,
  ) => {
    setCell(dash, r, 7, c.done);
    setCell(dash, r, 8, c.partial);
    setCell(dash, r, 9, c.skipped);
    setCell(dash, r, 10, c.vacation);
    setCell(dash, r, 11, c.missed);
    setCell(dash, r, 12, c.credit - c.done);
    const den = c.done + c.partial + c.missed;
    setCell(
      dash,
      r,
      13,
      makeFormula(`IFERROR(IF(G${r}+H${r}+K${r}=0,0,(G${r}+L${r})/(G${r}+H${r}+K${r})),0)`, {
        cachedValue: fraction(c.credit, den),
      }),
    );
    setCell(dash, r, 14, fraction(thirty.credit, thirty.denominator));
    if (curFormula) setCell(dash, r, 15, makeFormula(curFormula, { cachedValue: cur ?? 0 }));
    else setCell(dash, r, 15, cur ?? 0);
    if (bestFormula) setCell(dash, r, 16, makeFormula(bestFormula, { cachedValue: best ?? 0 }));
    else setCell(dash, r, 16, best ?? 0);
  };

  contexts.forEach((ctx, i) => {
    const r = i + 2;
    goalRow.set(ctx.goal.id, r);
    textCell(wb, dash, r, 1, ctx.goal.name);
    textCell(wb, dash, r, 2, ctx.goal.id);
    const mine = logs.filter((l) => l.goalId === ctx.goal.id);
    const doneLogs = mine.filter((l) => l.status === 'done').length;
    const sum = mine.reduce((a, l) => a + l.value, 0);
    setCell(dash, r, 3, makeFormula(`COUNTIFS(${goalRange},$B${r})`, { cachedValue: mine.length }));
    setCell(dash, r, 4, makeFormula(`COUNTIFS(${goalRange},$B${r},${statusRange},"done")`, { cachedValue: doneLogs }));
    setCell(dash, r, 5, makeFormula(`SUMIFS(${valueRange},${goalRange},$B${r})`, { cachedValue: sum }));
    setCell(
      dash,
      r,
      6,
      makeFormula(`IFERROR(AVERAGEIFS(${valueRange},${goalRange},$B${r}),0)`, { cachedValue: mine.length ? sum / mine.length : 0 }),
    );
    const thirty = completion([ctx], logs, last30.from, last30.to, info.today, 'weighted', weekStart);
    const cur = currentStreak(ctx, logs, info.today, weekStart);
    const best = bestStreak(ctx, logs, info.today, weekStart);
    streaks.set(ctx.goal.id, { current: cur, best });
    writeStatCells(r, goalStats[i]!, thirty, cur, best);
  });

  const goalsEnd = contexts.length + 1;
  const groupHeaderRow = goalsEnd + 2;
  setCell(dash, groupHeaderRow, 1, 'Groups');
  const groupRows = snapshot.tables.groups.map((g, i) => ({ g, r: groupHeaderRow + 1 + i }));
  for (const { g, r } of groupRows) {
    const memberIds = new Set(snapshot.tables.groupGoals.filter((x) => x.groupId === g.id).map((x) => x.goalId));
    const members = contexts.filter((c) => memberIds.has(c.goal.id));
    textCell(wb, dash, r, 1, g.name);
    textCell(wb, dash, r, 2, g.id);
    const c = completion(members, logs, all.from, all.to, info.today, 'weighted', weekStart);
    const thirty = completion(members, logs, last30.from, last30.to, info.today, 'weighted', weekStart);
    const cur = Math.max(0, ...members.map((m) => streaks.get(m.goal.id)!.current));
    const best = Math.max(0, ...members.map((m) => streaks.get(m.goal.id)!.best));
    const refs = (col: string) => members.map((m) => `${col}${goalRow.get(m.goal.id)}`).join(',');
    writeStatCells(
      r,
      c,
      thirty,
      cur,
      best,
      members.length ? `MAX(${refs('O')})` : undefined,
      members.length ? `MAX(${refs('P')})` : undefined,
    );
  }

  const lastRow = Math.max(goalsEnd, groupHeaderRow + groupRows.length);
  const bar = (sqref: string, priority: number) =>
    addConditionalFormatting(
      dash,
      makeConditionalFormatting({
        sqref,
        rules: [makeCfRule({ type: 'dataBar', priority, innerXml: dataBarInnerXml({ color: 'FF4F7CAC' }) })],
      }),
    );
  const scale = (sqref: string, priority: number) =>
    addConditionalFormatting(
      dash,
      makeConditionalFormatting({
        sqref,
        rules: [
          makeCfRule({
            type: 'colorScale',
            priority,
            innerXml: colorScaleInnerXml([
              { type: 'min', color: 'FFF2F2F2' },
              { type: 'max', color: 'FF4F7CAC' },
            ]),
          }),
        ],
      }),
    );
  if (contexts.length > 0) {
    bar(`G2:G${lastRow}`, 1);
    scale(`M2:N${lastRow}`, 2);
    bar(`O2:P${lastRow}`, 3);
  }
  setColumnWidths(dash, { 1: 24, 2: 38, 3: 12, 4: 12, 5: 14, 6: 14, 7: 22, 8: 22, 9: 22, 10: 22, 11: 22, 12: 22, 13: 14, 14: 22, 15: 22, 16: 22 });
  finish(dash);

  for (const spec of TABLE_SPECS) rawSheet(wb, snapshot, spec);

  const set = addWorksheet(wb, 'Settings');
  setCell(set, 1, 1, 'key');
  setCell(set, 1, 2, 'value');
  settingsEntries(settings).forEach(([k, v], i) => {
    setCell(set, i + 2, 1, k);
    if (typeof v === 'string') textCell(wb, set, i + 2, 2, v);
    else setCell(set, i + 2, 2, v);
  });
  finish(set);

  const meta = addWorksheet(wb, '_Meta');
  setCell(meta, 1, 1, 'key');
  setCell(meta, 1, 2, 'value');
  (
    [
      ['schemaVersion', snapshot.schemaVersion],
      ['appVersion', info.appVersion],
      ['exportedAt', info.exportedAt],
      ['format', XLSX_FORMAT],
    ] as const
  ).forEach(([k, v], i) => {
    setCell(meta, i + 2, 1, k);
    if (typeof v === 'string') textCell(wb, meta, i + 2, 2, v);
    else setCell(meta, i + 2, 2, v);
  });
  finish(meta);

  return workbookToBytes(wb);
}
