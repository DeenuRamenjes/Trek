import '../../xlsx/textCodec';
import JSZip from 'jszip';
import { workbookToBytes } from '@office-kit/xlsx/io';
import { addWorksheet, createWorkbook } from '@office-kit/xlsx/workbook';
import { setCell } from '@office-kit/xlsx/worksheet';
import { createTestDb } from '../../../test/testDb';
import type { TrekDb } from '../../../db/client';
import { seedDemoData } from '../../../db/seed';
import { DEFAULT_SETTINGS } from '../../../domain/settings';
import { applyImport } from '../importApply';
import { ImportFormatError, parseCsv, parseImport } from '../importParser';
import { ImportRejectedError, validateImport } from '../importValidate';
import { toJson } from '../jsonBackup';
import { toCsvZip } from '../csvExporter';
import { readSnapshot, SCHEMA_VERSION, type Snapshot } from '../snapshot';
import { toXlsx } from '../xlsxExporter';

const TODAY = '2026-10-05';
const INFO = { appVersion: '0.1.0', exportedAt: '2026-10-05T10:00:00.000Z' };
const newDb = () => createTestDb().db as unknown as TrekDb;

let snapshot: Snapshot;

beforeAll(async () => {
  const db = newDb();
  await seedDemoData(db, { today: TODAY });
  snapshot = await readSnapshot(db, DEFAULT_SETTINGS);
}, 60000);

async function importInto(db: TrekDb, input: Uint8Array | string, mode: 'replace' | 'merge' = 'replace') {
  const validated = validateImport(await parseImport(input));
  const result = await applyImport(db, validated, mode);
  return { validated, result };
}

describe('round trips (zero loss)', () => {
  it('xlsx: seed -> export -> parse -> replace -> identical snapshot', async () => {
    const bytes = await toXlsx(snapshot, { ...INFO, today: TODAY });
    const db = newDb();
    const { validated } = await importInto(db, bytes);
    expect(validated.errors).toEqual([]);
    expect(validated.meta.format).toBe('trek-xlsx');
    expect(validated.settings).toEqual(snapshot.settings);
    expect(await readSnapshot(db, DEFAULT_SETTINGS)).toEqual(snapshot);
  }, 120000);

  it('json: seed -> export -> parse -> replace -> identical snapshot', async () => {
    const db = newDb();
    const { validated } = await importInto(db, toJson(snapshot, INFO));
    expect(validated.errors).toEqual([]);
    expect(await readSnapshot(db, DEFAULT_SETTINGS)).toEqual(snapshot);
  }, 60000);

  it('csv zip: seed -> export -> parse -> replace -> identical snapshot', async () => {
    const db = newDb();
    const { validated } = await importInto(db, await toCsvZip(snapshot, INFO));
    expect(validated.errors).toEqual([]);
    expect(validated.meta.format).toBe('trek-csv');
    expect(validated.settings).toEqual(snapshot.settings);
    expect(await readSnapshot(db, DEFAULT_SETTINGS)).toEqual(snapshot);
  }, 60000);

  it('replace wipes existing data first', async () => {
    const db = newDb();
    await seedDemoData(db, { today: TODAY });
    await importInto(db, toJson(snapshot, INFO));
    expect(await readSnapshot(db, DEFAULT_SETTINGS)).toEqual(snapshot);
  }, 60000);

  it('keeps notes with commas, quotes and newlines through xlsx and csv', async () => {
    const s: Snapshot = structuredClone(snapshot);
    s.tables.logs[0] = { ...s.tables.logs[0]!, value: 0.125, note: 'a, "b"\nline2' };
    for (const bytes of [await toXlsx(s, { ...INFO, today: TODAY }), await toCsvZip(s, INFO)]) {
      const parsed = validateImport(await parseImport(bytes));
      expect(parsed.tables.logs[0]).toEqual(s.tables.logs[0]);
    }
  }, 120000);
});

const G1 = '11111111-1111-4111-8111-111111111111';
const V1 = '22222222-2222-4222-8222-222222222222';
const S1 = '33333333-3333-4333-8333-333333333333';

async function sheetBytes(sheets: Record<string, unknown[][]>): Promise<Uint8Array> {
  const wb = createWorkbook();
  for (const [name, grid] of Object.entries(sheets)) {
    const ws = addWorksheet(wb, name);
    grid.forEach((line, r) => line.forEach((v, c) => v !== null && v !== undefined && setCell(ws, r + 1, c + 1, v as never)));
  }
  return workbookToBytes(wb);
}

const META = [['key', 'value'], ['schemaVersion', SCHEMA_VERSION], ['appVersion', '1'], ['exportedAt', INFO.exportedAt], ['format', 'trek-xlsx']];
const serial = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / 86400000 + 25569;

describe('converted values', () => {
  it('matches headers by name, skips blank rows, ignores unknown columns, coerces serials and decimals', async () => {
    const bytes = await sheetBytes({
      '_Meta': META,
      goals: [
        [' UPDATEDAT ', 'Foo', 'startDate', ' Name', 'id', 'createdAt', 'icon', 'color', 'trackingType', 'targetValue', 'sortOrder'],
        ['2026-10-01T00:00:00.000Z', 'ignored', serial('2026-01-31'), 'Run', G1, '2026-10-01T00:00:00.000Z', 'run', '#112233', 'count', '3', 0],
        [],
        [null, '  '],
      ],
      ScheduleVersions: [['id', 'goalId', 'effectiveFrom', 'scheduleType', 'scheduleDays', 'createdAt'], [V1, G1, serial('2026-01-31'), 'daily', 127, '2026-10-01T00:00:00.000Z']],
      Slots: [['label', 'time', 'weekday', 'scheduleVersionId', 'id'], ['Morning', 0.3125, 2, V1, S1], [null, 0.3333333333333333, 3, V1, 12345]],
    });
    const parsed = await parseImport(bytes);
    expect(parsed.tables.goals).toHaveLength(1);
    expect(parsed.rowNumbers.goals).toEqual([2]);
    expect(parsed.tables.goals[0]).toMatchObject({ id: G1, name: 'Run', startDate: '2026-01-31', targetValue: 3, updatedAt: '2026-10-01T00:00:00.000Z' });
    expect(parsed.tables.goals[0]).not.toHaveProperty('Foo');
    expect(parsed.tables.goalSlots.map((s) => s.time)).toEqual(['07:30', '08:00']);
    expect(parsed.tables.goalSlots[1]!.id).toBe('12345');
    expect(parsed.tables.goalSlots[1]!.label).toBeNull();
    expect(parsed.tables.goalScheduleVersions[0]!.effectiveFrom).toBe('2026-01-31');
    expect(parsed.tables.logs).toEqual([]);

    const validated = validateImport(parsed);
    expect(validated.tables.goals).toHaveLength(1);
    expect(validated.tables.goalScheduleVersions).toHaveLength(1);
    expect(validated.tables.goalSlots.map((s) => s.id)).toEqual([S1]);
    expect(validated.errors).toEqual([{ sheet: 'Slots', row: 3, message: expect.stringContaining('id') }]);
  });

  it('treats empty strings in optional text as null', async () => {
    const parsed = await parseImport(
      toJson({ ...snapshot, tables: { ...snapshot.tables, logs: [{ ...snapshot.tables.logs[0]!, note: '' }], goals: [{ ...snapshot.tables.goals[0]!, unit: '' }] } }, INFO),
    );
    expect(parsed.tables.logs[0]!.note).toBeNull();
    expect(parsed.tables.goals[0]!.unit).toBeNull();
  });

  it('parses RFC 4180 csv', () => {
    expect(parseCsv('a,b\r\n"x, ""y""","l1\nl2"\r\n\r\nz,\r\n')).toEqual([['a', 'b'], ['x, "y"', 'l1\nl2'], ['z', '']]);
  });
});

describe('rejections and errors', () => {
  it('rejects a newer schemaVersion (json and xlsx)', async () => {
    const newer = JSON.parse(toJson(snapshot, INFO));
    newer.meta.schemaVersion = SCHEMA_VERSION + 1;
    await expect(parseImport(JSON.stringify(newer)).then(validateImport)).rejects.toBeInstanceOf(ImportRejectedError);
    const bytes = await sheetBytes({ _Meta: [['key', 'value'], ['schemaVersion', SCHEMA_VERSION + 1], ['format', 'trek-xlsx']] });
    await expect(parseImport(bytes).then(validateImport)).rejects.toThrow(/newer version/);
  });

  it('rejects files that are not Trek backups', async () => {
    await expect(parseImport('nope')).rejects.toBeInstanceOf(ImportFormatError);
    await expect(parseImport(await sheetBytes({ Sheet1: [['a']] }))).rejects.toBeInstanceOf(ImportFormatError);
    const zip = new JSZip();
    zip.file('x.csv', 'a\r\n1\r\n');
    await expect(parseImport(await zip.generateAsync({ type: 'uint8array' }))).rejects.toBeInstanceOf(ImportFormatError);
  });

  it('reports invalid rows with sheet and row, and drops their children', async () => {
    const s: Snapshot = structuredClone(snapshot);
    s.tables.goals[1] = { ...s.tables.goals[1]!, color: 'red' };
    s.tables.logs[2] = { ...s.tables.logs[2]!, value: -1 };
    const badGoal = s.tables.goals[1]!.id;
    const validated = validateImport(await parseImport(toJson(s, INFO)));
    const sheets = new Set(validated.errors.map((e) => e.sheet));
    expect(validated.errors).toContainEqual({ sheet: 'Goals', row: 2, message: expect.stringContaining('color') });
    expect(validated.errors).toContainEqual({ sheet: 'Logs', row: 3, message: expect.stringContaining('value') });
    expect(sheets.has('ScheduleVersions')).toBe(true);
    expect(validated.tables.goals.some((g) => g.id === badGoal)).toBe(false);
    expect(validated.tables.logs.some((l) => l.goalId === badGoal)).toBe(false);
    expect(validated.counts.goals).toEqual({ total: 12, valid: 11 });
  });

  it('reports duplicate ids and duplicate log keys', async () => {
    const s: Snapshot = structuredClone(snapshot);
    const first = s.tables.logs[0]!;
    s.tables.logs.push({ ...first, id: '99999999-9999-4999-8999-999999999999' });
    s.tables.groups.push({ ...s.tables.groups[0]! });
    const validated = validateImport(await parseImport(toJson(s, INFO)));
    expect(validated.errors.map((e) => e.sheet).sort()).toEqual(['Groups', 'Logs']);
  });
});

describe('merge', () => {
  const T0 = '2026-01-01T00:00:00.000Z';
  const OLD = '2026-02-01T00:00:00.000Z';
  const NEW = '2026-03-01T00:00:00.000Z';
  const id = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;

  function base(name: string, at: string, opts: { slotTime?: string; group?: boolean } = {}): Snapshot {
    const goal = {
      id: id(1), name, icon: 'flag', color: '#112233', trackingType: 'check' as const, targetValue: 1, unit: null,
      startDate: '2026-01-01', endDate: null, targetDays: null, pausedAt: null, archivedAt: null, sortOrder: 0, createdAt: T0, updatedAt: at,
    };
    return {
      schemaVersion: SCHEMA_VERSION,
      settings: snapshot.settings,
      tables: {
        goals: [goal],
        goalScheduleVersions: [{ id: id(2), goalId: id(1), effectiveFrom: '2026-01-01', scheduleType: 'daily', scheduleDays: 127, everyNDays: null, timesPerWeek: null, createdAt: T0 }],
        goalSlots: [{ id: id(3), scheduleVersionId: id(2), weekday: 0, time: opts.slotTime ?? '07:00', label: null }],
        reminders: [],
        groups: [{ id: id(4), name: `${name} group`, color: '#112233', icon: 'flag', sortOrder: 0, createdAt: T0, updatedAt: at }],
        groupGoals: opts.group === false ? [] : [{ groupId: id(4), goalId: id(1) }],
        goalPauses: [],
        logs: [{ id: id(5), goalId: id(1), date: '2026-01-02', slotId: null, value: 1, status: 'done', note: name, loggedAt: at, updatedAt: at }],
        vacations: [],
        vacationGoals: [],
      },
    };
  }

  async function mergeCase(stored: Snapshot, incoming: Snapshot) {
    const db = newDb();
    await importInto(db, toJson(stored, INFO), 'replace');
    const { result } = await importInto(db, toJson(incoming, INFO), 'merge');
    return { snap: await readSnapshot(db, DEFAULT_SETTINGS), result };
  }

  it('newer incoming wins; children follow the parent', async () => {
    const { snap, result } = await mergeCase(base('stored', OLD, { slotTime: '07:00' }), base('incoming', NEW, { slotTime: '09:00', group: false }));
    expect(snap.tables.goals[0]!.name).toBe('incoming');
    expect(snap.tables.goalSlots.map((s) => s.time)).toEqual(['09:00']);
    expect(snap.tables.groups[0]!.name).toBe('incoming group');
    expect(snap.tables.groupGoals).toEqual([]);
    expect(snap.tables.logs[0]!.note).toBe('incoming');
    expect(result.goals).toMatchObject({ updated: 1, added: 0, kept: 0 });
  });

  it('older incoming loses; stored children stay', async () => {
    const { snap, result } = await mergeCase(base('stored', NEW, { slotTime: '07:00' }), base('incoming', OLD, { slotTime: '09:00', group: false }));
    expect(snap.tables.goals[0]!.name).toBe('stored');
    expect(snap.tables.goalSlots.map((s) => s.time)).toEqual(['07:00']);
    expect(snap.tables.groupGoals).toHaveLength(1);
    expect(snap.tables.logs[0]!.note).toBe('stored');
    expect(result.goals.kept).toBe(1);
    expect(result.goalSlots.kept).toBe(1);
  });

  it('adds new rows and keeps stored-only rows', async () => {
    const stored = base('stored', OLD);
    const incoming = base('stored', OLD);
    incoming.tables.logs.push({ ...incoming.tables.logs[0]!, id: id(6), date: '2026-01-03', note: 'extra' });
    stored.tables.logs.push({ ...stored.tables.logs[0]!, id: id(7), date: '2026-01-04', note: 'only stored' });
    const { snap, result } = await mergeCase(stored, incoming);
    expect(snap.tables.logs.map((l) => l.note).sort()).toEqual(['extra', 'only stored', 'stored']);
    expect(result.logs).toMatchObject({ added: 1, kept: 1 });
  });

  it('a newer log with a different id but the same goal/date/slot replaces the stored one', async () => {
    const stored = base('stored', OLD);
    const incoming = base('stored', OLD);
    incoming.tables.logs[0] = { ...incoming.tables.logs[0]!, id: id(8), note: 'newer', updatedAt: NEW };
    const { snap } = await mergeCase(stored, incoming);
    expect(snap.tables.logs).toHaveLength(1);
    expect(snap.tables.logs[0]).toMatchObject({ id: id(8), note: 'newer' });
  });

  it('merging a backup into itself changes nothing', async () => {
    const db = newDb();
    await importInto(db, toJson(snapshot, INFO), 'replace');
    await importInto(db, toJson(snapshot, INFO), 'merge');
    expect(await readSnapshot(db, DEFAULT_SETTINGS)).toEqual(snapshot);
  }, 60000);
});
