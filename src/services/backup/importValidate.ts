import type { z } from 'zod';
import {
  goalPauseRow,
  goalRow,
  groupGoalRow,
  groupRow,
  logRow,
  reminderRow,
  scheduleVersionRow,
  slotRow,
  vacationGoalRow,
  vacationRow,
} from '../../db/rows';
import type { BackupMeta } from './jsonBackup';
import type { ParsedImport } from './importParser';
import { SCHEMA_VERSION, TABLE_SPECS, type ExportedSettings, type RawRow, type Snapshot, type TableKey } from './snapshot';

export type ImportError = { sheet: string; row: number; message: string };

export type ValidatedImport = {
  meta: BackupMeta;
  /** Valid rows only, every column present (null for empty). */
  tables: Snapshot['tables'];
  settings: ExportedSettings;
  errors: ImportError[];
  counts: Record<TableKey, { total: number; valid: number }>;
};

export class ImportRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportRejectedError';
  }
}

const SCHEMAS: Record<TableKey, z.ZodType> = {
  goals: goalRow,
  goalScheduleVersions: scheduleVersionRow,
  goalSlots: slotRow,
  reminders: reminderRow,
  groups: groupRow,
  groupGoals: groupGoalRow,
  goalPauses: goalPauseRow,
  logs: logRow,
  vacations: vacationRow,
  vacationGoals: vacationGoalRow,
};

/** Parents before children, so a dropped parent drops its children too. */
const PARENT_CHECKS: { key: TableKey; refs: { column: string; parent: TableKey; parentColumn: string }[] }[] = [
  { key: 'goals', refs: [] },
  { key: 'goalScheduleVersions', refs: [{ column: 'goalId', parent: 'goals', parentColumn: 'id' }] },
  { key: 'goalSlots', refs: [{ column: 'scheduleVersionId', parent: 'goalScheduleVersions', parentColumn: 'id' }] },
  { key: 'reminders', refs: [{ column: 'goalId', parent: 'goals', parentColumn: 'id' }] },
  { key: 'groups', refs: [] },
  {
    key: 'groupGoals',
    refs: [
      { column: 'groupId', parent: 'groups', parentColumn: 'id' },
      { column: 'goalId', parent: 'goals', parentColumn: 'id' },
    ],
  },
  { key: 'goalPauses', refs: [{ column: 'goalId', parent: 'goals', parentColumn: 'id' }] },
  { key: 'logs', refs: [{ column: 'goalId', parent: 'goals', parentColumn: 'id' }] },
  { key: 'vacations', refs: [] },
  {
    key: 'vacationGoals',
    refs: [
      { column: 'vacationId', parent: 'vacations', parentColumn: 'id' },
      { column: 'goalId', parent: 'goals', parentColumn: 'id' },
    ],
  },
];

/** Throws ImportRejectedError for a backup written by a newer schema. */
export function assertSupportedMeta(meta: BackupMeta): void {
  if (meta.schemaVersion > SCHEMA_VERSION) {
    throw new ImportRejectedError(
      `This backup was made by a newer version of Trek (schema ${meta.schemaVersion}, this app supports ${SCHEMA_VERSION}). Update the app to import it.`,
    );
  }
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((i) => {
      const path = i.path.join('.');
      return path ? `${path}: ${i.message}` : i.message;
    })
    .join('; ');
}

function identity(key: TableKey, row: RawRow): string {
  switch (key) {
    case 'groupGoals':
      return `${row.groupId}|${row.goalId}`;
    case 'vacationGoals':
      return `${row.vacationId}|${row.goalId}`;
    case 'logs':
      return `${row.goalId}|${row.date}|${row.slotId ?? ''}`;
    default:
      return String(row.id);
  }
}

/**
 * Validates every row with the shared zod schemas, then checks ids and references inside the file.
 * Invalid rows are left out and reported with sheet and row. Throws ImportRejectedError for newer schemas.
 */
export function validateImport(parsed: ImportParsedLike): ValidatedImport {
  assertSupportedMeta(parsed.meta);
  const errors: ImportError[] = [];
  const tables = Object.fromEntries(TABLE_SPECS.map((s) => [s.key, [] as RawRow[]])) as Record<TableKey, RawRow[]>;
  const counts = Object.fromEntries(TABLE_SPECS.map((s) => [s.key, { total: 0, valid: 0 }])) as ValidatedImport['counts'];
  const sheets = Object.fromEntries(TABLE_SPECS.map((s) => [s.key, s.sheet])) as Record<TableKey, string>;

  for (const { key, refs } of PARENT_CHECKS) {
    const spec = TABLE_SPECS.find((s) => s.key === key)!;
    const seen = new Set<string>();
    const rows = parsed.tables[key];
    counts[key].total = rows.length;
    rows.forEach((raw, i) => {
      const rowNumber = parsed.rowNumbers[key][i] ?? i + 2;
      const fail = (message: string) => errors.push({ sheet: sheets[key], row: rowNumber, message });
      const result = SCHEMAS[key]!.safeParse(raw);
      if (!result.success) return fail(describeIssues(result.error));
      const data = result.data as RawRow;
      const row: RawRow = Object.fromEntries(spec.columns.map((c) => [c.name, data[c.name] ?? null]));
      for (const ref of refs) {
        const parents = tables[ref.parent];
        if (!parents.some((p) => p[ref.parentColumn] === row[ref.column])) {
          return fail(`${ref.column}: unknown ${sheets[ref.parent]} id ${String(row[ref.column])}`);
        }
      }
      const id = identity(key, row);
      if (seen.has(id)) return fail(key === 'logs' ? 'Duplicate log for this goal, date and slot' : `Duplicate ${key === 'groupGoals' || key === 'vacationGoals' ? 'link' : 'id'} ${id}`);
      seen.add(id);
      tables[key].push(row);
      counts[key].valid++;
    });
  }

  return {
    meta: parsed.meta,
    tables: tables as unknown as Snapshot['tables'],
    settings: parsed.settings,
    errors,
    counts,
  };
}

type ImportParsedLike = Pick<ParsedImport, 'meta' | 'tables' | 'rowNumbers' | 'settings'>;
