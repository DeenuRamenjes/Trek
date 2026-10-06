import JSZip from 'jszip';
import { createTestDb } from '../../../test/testDb';
import type { TrekDb } from '../../../db/client';
import { seedDemoData } from '../../../db/seed';
import { DEFAULT_SETTINGS } from '../../../domain/settings';
import { completion, perGoal, rangeBounds } from '../../../domain/statsCalculator';
import { bestStreak, currentStreak } from '../../../domain/streaks';
import { inspectWorkbook, type CellReport, type SheetReport } from '../../xlsx/readBack';
import { loadContextsFromSnapshot } from '../contexts';
import { toCsvZip } from '../csvExporter';
import { parseJson, toJson } from '../jsonBackup';
import { readSnapshot, SCHEMA_VERSION, TABLE_SPECS, type Snapshot } from '../snapshot';
import { toXlsx } from '../xlsxExporter';

const TODAY = '2026-10-05';
const INFO = { appVersion: '0.1.0', exportedAt: '2026-10-05T10:00:00.000Z' };
const ALLOWED = new Set(['COUNTIFS', 'SUMIFS', 'AVERAGEIFS', 'IFERROR', 'IF', 'MAX', 'MIN']);

let snapshot: Snapshot;
let sheets: Map<string, SheetReport>;
let meta: Record<string, string>;
let rawParts: string[];

beforeAll(async () => {
  const { db } = createTestDb();
  await seedDemoData(db as unknown as TrekDb, { today: TODAY });
  snapshot = await readSnapshot(db as unknown as TrekDb, DEFAULT_SETTINGS);
  const report = await inspectWorkbook(await toXlsx(snapshot, { ...INFO, today: TODAY }));
  sheets = new Map(report.sheets.map((s) => [s.name, s]));
  meta = report.meta;
  rawParts = report.rawSheetXml;
}, 60000);

const cell = (sheet: string, ref: string): CellReport | undefined => sheets.get(sheet)!.cells.find((c) => c.ref === ref);

describe('snapshot', () => {
  it('reads 10 tables and drops app-lock settings', () => {
    expect(Object.keys(snapshot.tables)).toHaveLength(10);
    expect(snapshot.tables.goals).toHaveLength(12);
    expect(snapshot.tables.logs.length).toBeGreaterThan(1000);
    expect(snapshot.schemaVersion).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(2);
    expect('appLock' in snapshot.settings).toBe(false);
    expect(JSON.stringify(snapshot)).not.toContain('appLock');
  });
});

describe('JSON backup', () => {
  it('round-trips deep-equal', () => {
    const parsed = parseJson(toJson(snapshot, INFO));
    expect(parsed.snapshot).toEqual(snapshot);
    expect(parsed.meta).toEqual({ format: 'trek-json', schemaVersion: SCHEMA_VERSION, ...INFO });
  });
  it('preserves nulls, decimals and awkward notes', () => {
    const s: Snapshot = structuredClone(snapshot);
    s.tables.logs[0] = { ...s.tables.logs[0]!, value: 0.125, note: 'a, "b"\nline2' };
    expect(parseJson(toJson(s, INFO)).snapshot).toEqual(s);
  });
  it('rejects other files', () => {
    expect(() => parseJson('nope')).toThrow();
    expect(() => parseJson('{"meta":{"format":"x"}}')).toThrow();
  });
});

describe('xlsx export', () => {
  it('has all sheets in order', () => {
    expect([...sheets.keys()]).toEqual([
      'README', 'Dashboard', ...TABLE_SPECS.map((s) => s.sheet), 'Settings', '_Meta',
    ]);
  });

  it('_Meta carries format and schemaVersion', () => {
    expect(meta).toEqual({ schemaVersion: String(SCHEMA_VERSION), appVersion: '0.1.0', exportedAt: INFO.exportedAt, format: 'trek-xlsx' });
  });

  it('every sheet has a frozen header and protection without a password', () => {
    for (const s of sheets.values()) {
      if (s.name === 'README') continue;
      expect(s.pane).toMatchObject({ state: 'frozen', ySplit: 1 });
      expect(s.protected).toBe(true);
      expect(s.passwordHash).toBe(false);
    }
  });

  it('id, date and time columns are TEXT; raw headers match the table columns', () => {
    for (const spec of TABLE_SPECS) {
      const sheet = sheets.get(spec.sheet)!;
      spec.columns.forEach((c, i) => {
        expect(sheet.cells.find((x) => x.row === 1 && x.col === i + 1)?.value).toBe(c.name);
        const first = sheet.cells.find((x) => x.row === 2 && x.col === i + 1);
        if (first && c.kind === 'text') expect(first.format).toBe('@');
      });
    }
  });

  it('raw rows hold the snapshot values', () => {
    const logs = sheets.get('Logs')!;
    expect(logs.cells.filter((c) => c.col === 1 && c.row > 1)).toHaveLength(snapshot.tables.logs.length);
    const l = snapshot.tables.logs[0]!;
    expect(cell('Logs', 'A2')!.value).toBe(l.id);
    expect(cell('Logs', 'E2')!.value).toBe(l.value);
    expect(cell('Logs', 'C2')!.value).toBe(l.date);
  });

  it('has data bars and color scales, no charts', () => {
    const types = sheets.get('Dashboard')!.conditionalFormats;
    expect(types).toContain('dataBar');
    expect(types).toContain('colorScale');
    expect(rawParts.join('')).toContain('<dataBar>');
    expect(rawParts.join('')).not.toMatch(/<drawing|<chart/);
  });

  it('formulas use only allowed functions, never FILTER/LET/XLOOKUP, and carry cached values', () => {
    const formulas = sheets.get('Dashboard')!.cells.filter((c) => c.formula !== undefined);
    expect(formulas.length).toBeGreaterThan(50);
    for (const f of formulas) {
      const fns = [...f.formula!.matchAll(/([A-Z][A-Z0-9.]*)\s*\(/g)].map((m) => m[1]!);
      for (const fn of fns) expect(ALLOWED.has(fn)).toBe(true);
      expect(f.formula).not.toMatch(/\b(FILTER|LET|XLOOKUP)\s*\(/i);
      expect(typeof f.cached).toBe('number');
    }
  });

  it('cached values equal the app numbers', () => {
    const contexts = loadContextsFromSnapshot(snapshot);
    const logs = snapshot.tables.logs;
    const wk = snapshot.settings.weekStart;
    const earliest = contexts.reduce((m, c) => (c.goal.startDate < m ? c.goal.startDate : m), TODAY);
    const all = rangeBounds('All', TODAY, earliest);
    const l30 = rangeBounds('30D', TODAY, earliest);
    const stats = perGoal(contexts, logs, all.from, all.to, TODAY, 'weighted', wk);
    contexts.forEach((ctx, i) => {
      const r = i + 2;
      const mine = logs.filter((l) => l.goalId === ctx.goal.id);
      const sum = mine.reduce((a, l) => a + l.value, 0);
      expect(cell('Dashboard', `B${r}`)!.value).toBe(ctx.goal.id);
      expect(cell('Dashboard', `C${r}`)!.cached).toBe(mine.length);
      expect(cell('Dashboard', `D${r}`)!.cached).toBe(mine.filter((l) => l.status === 'done').length);
      expect(cell('Dashboard', `E${r}`)!.cached).toBeCloseTo(sum, 9);
      expect(cell('Dashboard', `F${r}`)!.cached).toBeCloseTo(mine.length ? sum / mine.length : 0, 9);
      const s = stats[i]!;
      expect(cell('Dashboard', `G${r}`)!.value).toBe(s.done);
      expect(cell('Dashboard', `H${r}`)!.value).toBe(s.partial);
      expect(cell('Dashboard', `I${r}`)!.value).toBe(s.skipped);
      expect(cell('Dashboard', `J${r}`)!.value).toBe(s.vacation);
      expect(cell('Dashboard', `K${r}`)!.value).toBe(s.missed);
      // Formula result (from the cells it reads) equals cache equals app completion.
      const den = Number(cell('Dashboard', `G${r}`)!.value) + Number(cell('Dashboard', `H${r}`)!.value) + Number(cell('Dashboard', `K${r}`)!.value);
      const fromCells = den === 0 ? 0 : (Number(cell('Dashboard', `G${r}`)!.value) + Number(cell('Dashboard', `L${r}`)!.value)) / den;
      expect(cell('Dashboard', `M${r}`)!.cached).toBeCloseTo(fromCells, 9);
      expect(cell('Dashboard', `M${r}`)!.cached).toBeCloseTo(s.percent / 100, 9);
      const c30 = completion([ctx], logs, l30.from, l30.to, TODAY, 'weighted', wk);
      expect(cell('Dashboard', `N${r}`)!.value).toBeCloseTo(c30.percent / 100, 9);
      expect(cell('Dashboard', `O${r}`)!.value).toBe(currentStreak(ctx, logs, TODAY, wk));
      expect(cell('Dashboard', `P${r}`)!.value).toBe(bestStreak(ctx, logs, TODAY, wk));
    });
  });

  it('group rows aggregate member goals', () => {
    const contexts = loadContextsFromSnapshot(snapshot);
    const wk = snapshot.settings.weekStart;
    const headerRow = contexts.length + 3;
    expect(cell('Dashboard', `A${headerRow}`)!.value).toBe('Groups');
    snapshot.tables.groups.forEach((g, i) => {
      const r = headerRow + 1 + i;
      expect(cell('Dashboard', `B${r}`)!.value).toBe(g.id);
      const ids = new Set(snapshot.tables.groupGoals.filter((x) => x.groupId === g.id).map((x) => x.goalId));
      const members = contexts.filter((c) => ids.has(c.goal.id));
      const earliest = contexts.reduce((m, c) => (c.goal.startDate < m ? c.goal.startDate : m), TODAY);
      const all = rangeBounds('All', TODAY, earliest);
      const c = completion(members, snapshot.tables.logs, all.from, all.to, TODAY, 'weighted', wk);
      expect(cell('Dashboard', `G${r}`)!.value).toBe(c.done);
      expect(cell('Dashboard', `M${r}`)!.cached).toBeCloseTo(c.percent / 100, 9);
      const cur = Math.max(0, ...members.map((m) => currentStreak(m, snapshot.tables.logs, TODAY, wk)));
      expect(cell('Dashboard', `O${r}`)!.cached).toBe(cur);
    });
  });

  it('labels app-computed headers', () => {
    expect(cell('Dashboard', 'K1')!.value).toContain('calculated by app');
    expect(cell('Dashboard', 'O1')!.value).toContain('calculated by app');
  });
});

describe('CSV export', () => {
  it('has one file per table with headers, plus Settings and _Meta', async () => {
    const zip = await JSZip.loadAsync(await toCsvZip(snapshot, INFO));
    for (const spec of TABLE_SPECS) {
      const text = await zip.files[`${spec.sheet}.csv`]!.async('string');
      expect(text.split('\r\n')[0]).toBe(spec.columns.map((c) => c.name).join(','));
    }
    expect(Object.keys(zip.files).sort()).toEqual([...TABLE_SPECS.map((s) => `${s.sheet}.csv`), 'Settings.csv', '_Meta.csv'].sort());
  });

  it('quotes commas, quotes and newlines per RFC 4180', async () => {
    const s: Snapshot = structuredClone(snapshot);
    s.tables.logs[0] = { ...s.tables.logs[0]!, note: 'a, "b"\nc' };
    const zip = await JSZip.loadAsync(await toCsvZip(s, INFO));
    expect(await zip.files['Logs.csv']!.async('string')).toContain('"a, ""b""\nc"');
  });
});
