import { eq, inArray } from 'drizzle-orm';
import type { TrekDb } from '../../db/client';
import * as schema from '../../db/schema';
import { withTransaction } from '../../db/transaction';
import type { ValidatedImport } from './importValidate';
import type { TableKey } from './snapshot';

export type ImportMode = 'replace' | 'merge';
export type TableOutcome = { added: number; updated: number; kept: number; skipped: number };
export type ApplyResult = Record<TableKey, TableOutcome>;

const CHUNK = 50;

function emptyResult(): ApplyResult {
  const zero = (): TableOutcome => ({ added: 0, updated: 0, kept: 0, skipped: 0 });
  return {
    goals: zero(), goalScheduleVersions: zero(), goalSlots: zero(), reminders: zero(), groups: zero(),
    groupGoals: zero(), goalPauses: zero(), logs: zero(), vacations: zero(), vacationGoals: zero(),
  };
}

function chunks<T>(rows: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += CHUNK) out.push(rows.slice(i, i + CHUNK));
  return out;
}

/** Inserts rows in chunks (tx-free: the caller owns the transaction). Existing primary keys are left alone. */
async function insertAll(db: TrekDb, table: any, rows: unknown[]): Promise<void> {
  for (const part of chunks(rows)) await db.insert(table).values(part as never).onConflictDoNothing();
}

async function deleteWhereIn(db: TrekDb, table: any, column: any, ids: string[]): Promise<void> {
  for (const part of chunks(ids)) await db.delete(table).where(inArray(column, part));
}

async function applyReplace(db: TrekDb, data: ValidatedImport, result: ApplyResult): Promise<void> {
  // Children first; cascades would also do it, explicit deletes keep this independent of foreign_keys.
  await db.delete(schema.vacationGoals);
  await db.delete(schema.vacations);
  await db.delete(schema.logs);
  await db.delete(schema.goalPauses);
  await db.delete(schema.groupGoals);
  await db.delete(schema.groups);
  await db.delete(schema.reminders);
  await db.delete(schema.goalSlots);
  await db.delete(schema.goalScheduleVersions);
  await db.delete(schema.goals);
  const t = data.tables;
  await insertAll(db, schema.goals, t.goals);
  await insertAll(db, schema.goalScheduleVersions, t.goalScheduleVersions);
  await insertAll(db, schema.goalSlots, t.goalSlots);
  await insertAll(db, schema.reminders, t.reminders);
  await insertAll(db, schema.groups, t.groups);
  await insertAll(db, schema.groupGoals, t.groupGoals);
  await insertAll(db, schema.goalPauses, t.goalPauses);
  await insertAll(db, schema.logs, t.logs);
  await insertAll(db, schema.vacations, t.vacations);
  await insertAll(db, schema.vacationGoals, t.vacationGoals);
  for (const k of Object.keys(result) as TableKey[]) result[k].added = t[k].length;
}

type Dated = { id: string; updatedAt: string };

/** Newer updatedAt wins; ties keep the stored row. */
function fileWins(file: Dated, stored: Dated | undefined): boolean {
  return stored === undefined || file.updatedAt > stored.updatedAt;
}

async function applyMerge(db: TrekDb, data: ValidatedImport, result: ApplyResult): Promise<void> {
  const t = data.tables;

  // goals: own updatedAt decides; schedule versions, slots and reminders follow the goal.
  const storedGoals = new Map((await db.select().from(schema.goals)).map((g) => [g.id, g]));
  const winningGoals = new Set<string>();
  for (const g of t.goals) {
    const stored = storedGoals.get(g.id);
    if (!stored) {
      await db.insert(schema.goals).values(g);
      result.goals.added++;
      winningGoals.add(g.id);
    } else if (fileWins(g, stored)) {
      await db.update(schema.goals).set(g).where(eq(schema.goals.id, g.id));
      result.goals.updated++;
      winningGoals.add(g.id);
    } else result.goals.kept++;
  }
  const goalIds = [...winningGoals];
  const replacedGoalIds = goalIds.filter((id) => storedGoals.has(id));
  await deleteWhereIn(db, schema.goalScheduleVersions, schema.goalScheduleVersions.goalId, replacedGoalIds);
  await deleteWhereIn(db, schema.reminders, schema.reminders.goalId, replacedGoalIds);

  const versions = t.goalScheduleVersions.filter((v) => winningGoals.has(v.goalId));
  const versionIds = new Set(versions.map((v) => v.id));
  const slots = t.goalSlots.filter((s) => versionIds.has(s.scheduleVersionId));
  const reminders = t.reminders.filter((r) => winningGoals.has(r.goalId));
  await insertAll(db, schema.goalScheduleVersions, versions);
  await insertAll(db, schema.goalSlots, slots);
  await insertAll(db, schema.reminders, reminders);
  result.goalScheduleVersions.added = versions.length;
  result.goalScheduleVersions.kept = t.goalScheduleVersions.length - versions.length;
  result.goalSlots.added = slots.length;
  result.goalSlots.kept = t.goalSlots.length - slots.length;
  result.reminders.added = reminders.length;
  result.reminders.kept = t.reminders.length - reminders.length;

  const goalExists = new Set((await db.select({ id: schema.goals.id }).from(schema.goals)).map((g) => g.id));

  // groups and vacations: own updatedAt; their join rows follow them.
  const storedGroups = new Map((await db.select().from(schema.groups)).map((g) => [g.id, g]));
  const winningGroups = new Set<string>();
  for (const g of t.groups) {
    const stored = storedGroups.get(g.id);
    if (!stored) {
      await db.insert(schema.groups).values(g);
      result.groups.added++;
      winningGroups.add(g.id);
    } else if (fileWins(g, stored)) {
      await db.update(schema.groups).set(g).where(eq(schema.groups.id, g.id));
      result.groups.updated++;
      winningGroups.add(g.id);
    } else result.groups.kept++;
  }
  await deleteWhereIn(db, schema.groupGoals, schema.groupGoals.groupId, [...winningGroups].filter((id) => storedGroups.has(id)));
  const links = t.groupGoals.filter((l) => winningGroups.has(l.groupId) && goalExists.has(l.goalId));
  await insertAll(db, schema.groupGoals, links);
  result.groupGoals.added = links.length;
  result.groupGoals.kept = t.groupGoals.filter((l) => !winningGroups.has(l.groupId)).length;
  result.groupGoals.skipped = t.groupGoals.length - links.length - result.groupGoals.kept;

  const storedVacations = new Map((await db.select().from(schema.vacations)).map((v) => [v.id, v]));
  const winningVacations = new Set<string>();
  for (const v of t.vacations) {
    const stored = storedVacations.get(v.id);
    if (!stored) {
      await db.insert(schema.vacations).values(v);
      result.vacations.added++;
      winningVacations.add(v.id);
    } else if (fileWins(v, stored)) {
      await db.update(schema.vacations).set(v).where(eq(schema.vacations.id, v.id));
      result.vacations.updated++;
      winningVacations.add(v.id);
    } else result.vacations.kept++;
  }
  await deleteWhereIn(db, schema.vacationGoals, schema.vacationGoals.vacationId, [...winningVacations].filter((id) => storedVacations.has(id)));
  const vLinks = t.vacationGoals.filter((l) => winningVacations.has(l.vacationId) && goalExists.has(l.goalId));
  await insertAll(db, schema.vacationGoals, vLinks);
  result.vacationGoals.added = vLinks.length;
  result.vacationGoals.kept = t.vacationGoals.filter((l) => !winningVacations.has(l.vacationId)).length;
  result.vacationGoals.skipped = t.vacationGoals.length - vLinks.length - result.vacationGoals.kept;

  // pauses: own updatedAt.
  const storedPauses = new Map((await db.select().from(schema.goalPauses)).map((p) => [p.id, p]));
  for (const p of t.goalPauses) {
    if (!goalExists.has(p.goalId)) {
      result.goalPauses.skipped++;
      continue;
    }
    const stored = storedPauses.get(p.id);
    if (!stored) {
      await db.insert(schema.goalPauses).values(p);
      result.goalPauses.added++;
    } else if (fileWins(p, stored)) {
      await db.update(schema.goalPauses).set(p).where(eq(schema.goalPauses.id, p.id));
      result.goalPauses.updated++;
    } else result.goalPauses.kept++;
  }

  // logs: own updatedAt, matched by id or by the unique (goal, date, slot) key.
  const storedLogs = await db.select().from(schema.logs);
  const byId = new Map(storedLogs.map((l) => [l.id, l]));
  const keyOf = (l: { goalId: string; date: string; slotId: string | null }) => `${l.goalId}|${l.date}|${l.slotId ?? ''}`;
  const byKey = new Map(storedLogs.map((l) => [keyOf(l), l]));
  for (const l of t.logs) {
    if (!goalExists.has(l.goalId)) {
      result.logs.skipped++;
      continue;
    }
    const stored = byId.get(l.id) ?? byKey.get(keyOf(l));
    if (!stored) {
      await db.insert(schema.logs).values(l);
      result.logs.added++;
    } else if (fileWins(l, stored)) {
      if (stored.id === l.id) await db.update(schema.logs).set(l).where(eq(schema.logs.id, l.id));
      else {
        await db.delete(schema.logs).where(eq(schema.logs.id, stored.id));
        await db.insert(schema.logs).values(l);
      }
      result.logs.updated++;
    } else result.logs.kept++;
  }
}

/**
 * Writes a validated import in one transaction. Replace empties the ten tables first.
 * Merge matches by id and the newer updatedAt wins; tables without updatedAt follow their parent.
 * Settings and pending_actions are not touched here. Never call inside another withTransaction on the same db.
 */
export async function applyImport(db: TrekDb, data: ValidatedImport, mode: ImportMode): Promise<ApplyResult> {
  const result = emptyResult();
  await withTransaction(db, async (tx) => {
    if (mode === 'replace') await applyReplace(tx, data, result);
    else await applyMerge(tx, data, result);
  });
  return result;
}

