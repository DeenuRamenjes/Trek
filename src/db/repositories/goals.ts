import { asc, eq, isNull } from 'drizzle-orm';
import type { TrekDb } from '../client';
import { emitDbChanged } from '../changes';
import { withTransaction } from '../transaction';
import { newId, nowIso } from '../ids';
import { goalScheduleVersions, goalSlots, goals, reminders, type Goal } from '../schema';

export type GoalInput = {
  name: string;
  icon?: string;
  color?: string;
  trackingType?: Goal['trackingType'];
  targetValue?: number;
  unit?: string | null;
  startDate?: string;
  endDate?: string | null;
  targetDays?: number | null;
  sortOrder?: number;
};

export async function createGoal(db: TrekDb, input: GoalInput, today: string): Promise<Goal> {
  return withTransaction(db, (tx) => createGoalTx(tx, input, today));
}

/** createGoal without its own transaction; call only inside an open withTransaction. */
export async function createGoalTx(tx: TrekDb, input: GoalInput, today: string): Promise<Goal> {
  const now = nowIso();
  const id = newId();
  const startDate = input.startDate ?? today;
  const defined = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  await tx.insert(goals).values({ ...defined, name: input.name, id, startDate, createdAt: now, updatedAt: now });
  await tx.insert(goalScheduleVersions).values({
    id: newId(),
    goalId: id,
    effectiveFrom: startDate,
    scheduleType: 'daily',
    scheduleDays: 127,
    createdAt: now,
  });
  const row = await tx.select().from(goals).where(eq(goals.id, id));
  return row[0];
}

/** updateGoal without the change event; call only inside an open withTransaction (which emits on commit). */
export async function updateGoalTx(tx: TrekDb, id: string, patch: Partial<Omit<Goal, 'id' | 'createdAt'>>): Promise<void> {
  await tx.update(goals).set({ ...patch, updatedAt: nowIso() }).where(eq(goals.id, id));
}

export async function updateGoal(db: TrekDb, id: string, patch: Partial<Omit<Goal, 'id' | 'createdAt'>>): Promise<void> {
  await updateGoalTx(db, id, patch);
  emitDbChanged();
}

export async function getGoal(db: TrekDb, id: string): Promise<Goal | undefined> {
  const rows = await db.select().from(goals).where(eq(goals.id, id));
  return rows[0];
}

export async function listGoals(db: TrekDb, opts: { includeArchived?: boolean } = {}): Promise<Goal[]> {
  const q = db.select().from(goals);
  const rows = await (opts.includeArchived ? q : q.where(isNull(goals.archivedAt))).orderBy(asc(goals.sortOrder), asc(goals.createdAt));
  return rows;
}

export async function archiveGoal(db: TrekDb, id: string, at: string = nowIso()): Promise<void> {
  await db.update(goals).set({ archivedAt: at, updatedAt: nowIso() }).where(eq(goals.id, id));
  emitDbChanged();
}

export async function reorderGoals(db: TrekDb, ids: string[]): Promise<void> {
  const now = nowIso();
  await withTransaction(db, async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx.update(goals).set({ sortOrder: i, updatedAt: now }).where(eq(goals.id, ids[i]));
    }
  });
}

export async function deleteGoal(db: TrekDb, id: string): Promise<void> {
  await db.delete(goals).where(eq(goals.id, id));
  emitDbChanged();
}

/** Copies the goal, its current schedule version (latest effective on or before today), slots and reminders. */
export async function duplicateGoal(db: TrekDb, id: string, today: string): Promise<Goal> {
  const now = nowIso();
  return withTransaction(db, async (tx) => {
    const src = (await tx.select().from(goals).where(eq(goals.id, id)))[0];
    if (!src) throw new Error(`Goal not found: ${id}`);
    const newGoalId = newId();
    await tx.insert(goals).values({
      ...src,
      id: newGoalId,
      pausedAt: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    const versions = await tx
      .select()
      .from(goalScheduleVersions)
      .where(eq(goalScheduleVersions.goalId, id))
      .orderBy(asc(goalScheduleVersions.effectiveFrom));
    const current = [...versions].reverse().find((v) => v.effectiveFrom <= today) ?? versions[0];
    const slotIdMap = new Map<string, string>();
    if (current) {
      const versionId = newId();
      await tx.insert(goalScheduleVersions).values({
        ...current,
        id: versionId,
        goalId: newGoalId,
        effectiveFrom: src.startDate,
        createdAt: now,
      });
      const slots = await tx.select().from(goalSlots).where(eq(goalSlots.scheduleVersionId, current.id));
      for (const s of slots) {
        const slotId = newId();
        slotIdMap.set(s.id, slotId);
        await tx.insert(goalSlots).values({ ...s, id: slotId, scheduleVersionId: versionId });
      }
    }
    const rems = await tx.select().from(reminders).where(eq(reminders.goalId, id));
    for (const r of rems) {
      await tx.insert(reminders).values({ ...r, id: newId(), goalId: newGoalId, slotId: r.slotId ? (slotIdMap.get(r.slotId) ?? null) : null });
    }
    return (await tx.select().from(goals).where(eq(goals.id, newGoalId)))[0];
  });
}

