import { asc } from 'drizzle-orm';
import journal from '../../db/migrations/meta/_journal.json';
import type { TrekDb } from '../../db/client';
import * as schema from '../../db/schema';
import type { Settings } from '../../domain/settings';

/** Number of applied migrations. Bump by adding a migration; exports carry it and imports reject newer values. */
export const SCHEMA_VERSION: number = journal.entries.length;

export type ColumnKind = 'text' | 'number' | 'boolean';
export type ColumnSpec = { name: string; kind: ColumnKind };

export type TableKey =
  | 'goals'
  | 'goalScheduleVersions'
  | 'goalSlots'
  | 'reminders'
  | 'groups'
  | 'groupGoals'
  | 'goalPauses'
  | 'logs'
  | 'vacations'
  | 'vacationGoals';

export type TableSpec = {
  key: TableKey;
  /** Excel sheet name and CSV file stem. */
  sheet: string;
  columns: ColumnSpec[];
};

const t = (name: string): ColumnSpec => ({ name, kind: 'text' });
const n = (name: string): ColumnSpec => ({ name, kind: 'number' });
const b = (name: string): ColumnSpec => ({ name, kind: 'boolean' });

/** Raw tables in export order. Text columns (ids, dates, times, timestamps, strings) are stored as TEXT in xlsx. */
export const TABLE_SPECS: readonly TableSpec[] = [
  {
    key: 'goals',
    sheet: 'Goals',
    columns: [
      t('id'), t('name'), t('icon'), t('color'), t('trackingType'), n('targetValue'), t('unit'), t('startDate'),
      t('endDate'), n('targetDays'), t('pausedAt'), t('archivedAt'), n('sortOrder'), t('createdAt'), t('updatedAt'),
    ],
  },
  {
    key: 'goalScheduleVersions',
    sheet: 'ScheduleVersions',
    columns: [t('id'), t('goalId'), t('effectiveFrom'), t('scheduleType'), n('scheduleDays'), n('everyNDays'), n('timesPerWeek'), t('createdAt')],
  },
  { key: 'goalSlots', sheet: 'Slots', columns: [t('id'), t('scheduleVersionId'), n('weekday'), t('time'), t('label')] },
  {
    key: 'reminders',
    sheet: 'Reminders',
    columns: [t('id'), t('goalId'), t('slotId'), n('weekday'), t('time'), n('offsetMin'), b('enabled')],
  },
  { key: 'groups', sheet: 'Groups', columns: [t('id'), t('name'), t('color'), t('icon'), n('sortOrder'), t('createdAt'), t('updatedAt')] },
  { key: 'groupGoals', sheet: 'GroupGoals', columns: [t('groupId'), t('goalId')] },
  {
    key: 'goalPauses',
    sheet: 'GoalPauses',
    columns: [t('id'), t('goalId'), t('startDate'), t('endDate'), t('createdAt'), t('updatedAt')],
  },
  {
    key: 'logs',
    sheet: 'Logs',
    columns: [t('id'), t('goalId'), t('date'), t('slotId'), n('value'), t('status'), t('note'), t('loggedAt'), t('updatedAt')],
  },
  {
    key: 'vacations',
    sheet: 'Vacations',
    columns: [t('id'), t('startDate'), t('endDate'), t('scope'), t('note'), t('createdAt'), t('updatedAt')],
  },
  { key: 'vacationGoals', sheet: 'VacationGoals', columns: [t('vacationId'), t('goalId')] },
];

/** Settings in a backup: everything except the app-lock state. */
export type ExportedSettings = Omit<Settings, 'appLock'>;

export type Snapshot = {
  schemaVersion: number;
  settings: ExportedSettings;
  tables: {
    goals: schema.Goal[];
    goalScheduleVersions: schema.ScheduleVersion[];
    goalSlots: schema.Slot[];
    reminders: schema.Reminder[];
    groups: schema.Group[];
    groupGoals: schema.GroupGoal[];
    goalPauses: schema.GoalPause[];
    logs: schema.Log[];
    vacations: schema.Vacation[];
    vacationGoals: schema.VacationGoal[];
  };
};

export type RawRow = Record<string, unknown>;

/** Drops app-lock state from settings. */
export function exportableSettings(settings: Settings): ExportedSettings {
  const { appLock: _appLock, ...rest } = settings;
  void _appLock;
  return rest;
}

/** Reads every table except pending_actions. Rows are ordered deterministically. */
export async function readSnapshot(db: TrekDb, settings: Settings): Promise<Snapshot> {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: exportableSettings(settings),
    tables: {
      goals: await db.select().from(schema.goals).orderBy(asc(schema.goals.sortOrder), asc(schema.goals.id)),
      goalScheduleVersions: await db
        .select()
        .from(schema.goalScheduleVersions)
        .orderBy(asc(schema.goalScheduleVersions.goalId), asc(schema.goalScheduleVersions.effectiveFrom), asc(schema.goalScheduleVersions.id)),
      goalSlots: await db.select().from(schema.goalSlots).orderBy(asc(schema.goalSlots.id)),
      reminders: await db.select().from(schema.reminders).orderBy(asc(schema.reminders.id)),
      groups: await db.select().from(schema.groups).orderBy(asc(schema.groups.sortOrder), asc(schema.groups.id)),
      groupGoals: await db.select().from(schema.groupGoals).orderBy(asc(schema.groupGoals.groupId), asc(schema.groupGoals.goalId)),
      goalPauses: await db.select().from(schema.goalPauses).orderBy(asc(schema.goalPauses.goalId), asc(schema.goalPauses.startDate), asc(schema.goalPauses.id)),
      logs: await db.select().from(schema.logs).orderBy(asc(schema.logs.goalId), asc(schema.logs.date), asc(schema.logs.id)),
      vacations: await db.select().from(schema.vacations).orderBy(asc(schema.vacations.startDate), asc(schema.vacations.id)),
      vacationGoals: await db.select().from(schema.vacationGoals).orderBy(asc(schema.vacationGoals.vacationId), asc(schema.vacationGoals.goalId)),
    },
  };
}

/** Table rows as plain records, for exporters. */
export function tableRows(snapshot: Snapshot, key: TableKey): RawRow[] {
  return snapshot.tables[key] as unknown as RawRow[];
}

/** Settings as flat key/value pairs; objects and null are JSON text. */
export function settingsEntries(settings: ExportedSettings): [string, string | number | boolean][] {
  const out: [string, string | number | boolean][] = [];
  for (const [k, v] of Object.entries(settings)) {
    if (v === undefined) continue;
    out.push([k, typeof v === 'object' ? JSON.stringify(v) : (v as string | number | boolean)]);
  }
  return out;
}
