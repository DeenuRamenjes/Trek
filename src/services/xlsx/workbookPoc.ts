import './textCodec';
import { workbookToBytes } from '@office-kit/xlsx/io';
import { createWorkbook, addWorksheet } from '@office-kit/xlsx/workbook';
import {
  addConditionalFormatting,
  makeCfRule,
  makeConditionalFormatting,
  makeSheetProtection,
  setCell,
  setFreezePanes,
  setColumnWidths,
  type Worksheet,
} from '@office-kit/xlsx/worksheet';
import { dataBarInnerXml, colorScaleInnerXml } from './cfRules';
import { makeFormula } from '@office-kit/xlsx/cell';
import { setCellNumberFormat, FORMAT_TEXT } from '@office-kit/xlsx/styles';
import type { Workbook } from '@office-kit/xlsx/workbook';

type LogRow = { id: string; date: string; time: string; goalId: string; status: string; value: number };

const LOGS: LogRow[] = [
  { id: '0001', date: '2026-10-01', time: '07:30', goalId: 'g1', status: 'done', value: 1 },
  { id: '0002', date: '2026-10-02', time: '07:45', goalId: 'g1', status: 'done', value: 1 },
  { id: '0003', date: '2026-10-03', time: '08:00', goalId: 'g1', status: 'partial', value: 0.5 },
  { id: '0004', date: '2026-10-01', time: '21:00', goalId: 'g2', status: 'done', value: 30 },
  { id: '0005', date: '2026-10-02', time: '21:10', goalId: 'g2', status: 'skipped', value: 0 },
  { id: '0006', date: '2026-10-03', time: '21:05', goalId: 'g2', status: 'done', value: 20 },
  { id: '0007', date: '2026-10-01', time: '12:00', goalId: 'g3', status: 'done', value: 8 },
];

const GOALS = ['g1', 'g2', 'g3'];

/** Dashboard cells, each with the value the app computes and caches. */
function computeDashboard() {
  return GOALS.map((g) => {
    const rows = LOGS.filter((r) => r.goalId === g);
    const done = rows.filter((r) => r.status === 'done').length;
    const sum = rows.reduce((a, r) => a + r.value, 0);
    return { goal: g, done, sum, avg: sum / rows.length, rate: rows.length === 0 ? 0 : done / rows.length };
  });
}

const DASH = computeDashboard();

/** Expected formula cells on the Dashboard, used by tests. */
export const POC_EXPECTED: { ref: string; value: number }[] = DASH.flatMap((d, i) => {
  const r = i + 2;
  return [
    { ref: `B${r}`, value: d.done },
    { ref: `C${r}`, value: d.sum },
    { ref: `D${r}`, value: d.avg },
    { ref: `E${r}`, value: d.rate },
  ];
});

function text(wb: Workbook, ws: Worksheet, row: number, col: number, value: string): void {
  const c = setCell(ws, row, col, value);
  setCellNumberFormat(wb, c, FORMAT_TEXT);
}

function finish(ws: Worksheet): void {
  setFreezePanes(ws, { rows: 1, cols: 0 });
  ws.sheetProtection = makeSheetProtection({ sheet: true });
}

export async function buildPocWorkbook(): Promise<Uint8Array> {
  const wb = createWorkbook();

  const dash = addWorksheet(wb, 'Dashboard');
  ['Goal', 'Done', 'Total value', 'Average value', 'Done rate'].forEach((h, i) => setCell(dash, 1, i + 1, h));
  DASH.forEach((d, i) => {
    const r = i + 2;
    text(wb, dash, r, 1, d.goal);
    setCell(dash, r, 2, makeFormula(`COUNTIFS(Logs!$D$2:$D$1000,A${r},Logs!$E$2:$E$1000,"done")`, { cachedValue: d.done }));
    setCell(dash, r, 3, makeFormula(`SUMIFS(Logs!$F$2:$F$1000,Logs!$D$2:$D$1000,A${r})`, { cachedValue: d.sum }));
    setCell(dash, r, 4, makeFormula(`IFERROR(AVERAGEIFS(Logs!$F$2:$F$1000,Logs!$D$2:$D$1000,A${r}),0)`, { cachedValue: d.avg }));
    setCell(dash, r, 5, makeFormula(`IFERROR(B${r}/COUNTIFS(Logs!$D$2:$D$1000,A${r}),0)`, { cachedValue: d.rate }));
  });
  const last = DASH.length + 1;
  addConditionalFormatting(
    dash,
    makeConditionalFormatting({
      sqref: `B2:B${last}`,
      rules: [makeCfRule({ type: 'dataBar', priority: 1, innerXml: dataBarInnerXml({ color: 'FF4F7CAC' }) })],
    }),
  );
  addConditionalFormatting(
    dash,
    makeConditionalFormatting({
      sqref: `E2:E${last}`,
      rules: [
        makeCfRule({
          type: 'colorScale',
          priority: 2,
          innerXml: colorScaleInnerXml([
            { type: 'min', color: 'FFF2F2F2' },
            { type: 'max', color: 'FF4F7CAC' },
          ]),
        }),
      ],
    }),
  );
  setColumnWidths(dash, { 1: 14, 2: 10, 3: 14, 4: 16, 5: 12 });
  finish(dash);

  const logs = addWorksheet(wb, 'Logs');
  ['ID', 'Date', 'Time', 'GoalId', 'Status', 'Value'].forEach((h, i) => setCell(logs, 1, i + 1, h));
  LOGS.forEach((l, i) => {
    const r = i + 2;
    text(wb, logs, r, 1, l.id);
    text(wb, logs, r, 2, l.date);
    text(wb, logs, r, 3, l.time);
    text(wb, logs, r, 4, l.goalId);
    setCell(logs, r, 5, l.status);
    setCell(logs, r, 6, l.value);
  });
  finish(logs);

  const meta = addWorksheet(wb, '_Meta');
  setCell(meta, 1, 1, 'key');
  setCell(meta, 1, 2, 'value');
  [
    ['schemaVersion', '1'],
    ['appVersion', '0.1.0'],
    ['exportedAt', new Date().toISOString()],
    ['format', 'trek-xlsx'],
  ].forEach(([k, v], i) => {
    setCell(meta, i + 2, 1, k!);
    setCell(meta, i + 2, 2, v!);
  });
  finish(meta);

  return workbookToBytes(wb);
}
