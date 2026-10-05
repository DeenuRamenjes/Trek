import { and, asc, eq, isNull } from 'drizzle-orm';
import type { TrekDb } from '../client';
import { addDaysToDate, newId, nowIso } from '../ids';
import { goalPauses, goals, type GoalPause } from '../schema';

export async function pauseGoal(db: TrekDb, goalId: string, date: string): Promise<void> {
  const now = nowIso();
  await db.transaction(async (tx) => {
    await tx.update(goals).set({ pausedAt: now, updatedAt: now }).where(eq(goals.id, goalId));
    await tx.insert(goalPauses).values({ id: newId(), goalId, startDate: date, endDate: null, createdAt: now, updatedAt: now });
  });
}

/** Closes the open pause with endDate = date - 1 day; deletes it when that is before its start. */
export async function resumeGoal(db: TrekDb, goalId: string, date: string): Promise<void> {
  const now = nowIso();
  await db.transaction(async (tx) => {
    const open = await tx.select().from(goalPauses).where(and(eq(goalPauses.goalId, goalId), isNull(goalPauses.endDate)));
    const end = addDaysToDate(date, -1);
    for (const p of open) {
      if (end < p.startDate) await tx.delete(goalPauses).where(eq(goalPauses.id, p.id));
      else await tx.update(goalPauses).set({ endDate: end, updatedAt: now }).where(eq(goalPauses.id, p.id));
    }
    await tx.update(goals).set({ pausedAt: null, updatedAt: now }).where(eq(goals.id, goalId));
  });
}

export async function listPauses(db: TrekDb, goalId: string): Promise<GoalPause[]> {
  return db.select().from(goalPauses).where(eq(goalPauses.goalId, goalId)).orderBy(asc(goalPauses.startDate));
}
