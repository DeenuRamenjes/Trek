import { asc, eq } from 'drizzle-orm';
import type { TrekDb } from '../client';
import { withTransaction } from '../transaction';
import { addDaysToDate } from '../dates';
import { newId, nowIso } from '../ids';
import { vacationGoals, vacations, type Vacation } from '../schema';

export type VacationInput = {
  startDate: string;
  endDate: string;
  scope: Vacation['scope'];
  goalIds?: string[];
  note?: string | null;
};
export type VacationWithGoals = Vacation & { goalIds: string[] };

async function writeGoalIds(tx: Pick<TrekDb, 'insert' | 'delete'>, vacationId: string, goalIds: string[]) {
  await tx.delete(vacationGoals).where(eq(vacationGoals.vacationId, vacationId));
  for (const goalId of new Set(goalIds)) await tx.insert(vacationGoals).values({ vacationId, goalId });
}

export async function createVacation(db: TrekDb, input: VacationInput): Promise<VacationWithGoals> {
  const now = nowIso();
  const id = newId();
  await withTransaction(db, async (tx) => {
    await tx.insert(vacations).values({
      id,
      startDate: input.startDate,
      endDate: input.endDate,
      scope: input.scope,
      note: input.note ?? null,
      createdAt: now,
      updatedAt: now,
    });
    await writeGoalIds(tx, id, input.scope === 'selected' ? (input.goalIds ?? []) : []);
  });
  return (await listVacations(db)).find((v) => v.id === id) as VacationWithGoals;
}

export async function updateVacation(db: TrekDb, id: string, patch: Partial<VacationInput>): Promise<void> {
  const { goalIds, ...rest } = patch;
  await withTransaction(db, async (tx) => {
    await tx.update(vacations).set({ ...rest, updatedAt: nowIso() }).where(eq(vacations.id, id));
    if (patch.scope === 'all') await writeGoalIds(tx, id, []);
    else if (goalIds) await writeGoalIds(tx, id, goalIds);
  });
}

/** endDate = today - 1 day; a vacation that had not started yet is deleted. */
export async function endVacationNow(db: TrekDb, id: string, today: string): Promise<void> {
  const v = (await db.select().from(vacations).where(eq(vacations.id, id)))[0];
  if (!v) return;
  const end = addDaysToDate(today, -1);
  if (end < v.startDate) await deleteVacation(db, id);
  else await db.update(vacations).set({ endDate: end, updatedAt: nowIso() }).where(eq(vacations.id, id));
}

export async function deleteVacation(db: TrekDb, id: string): Promise<void> {
  await db.delete(vacations).where(eq(vacations.id, id));
}

export async function listVacations(db: TrekDb): Promise<VacationWithGoals[]> {
  const rows = await db.select().from(vacations).orderBy(asc(vacations.startDate), asc(vacations.createdAt));
  const links = await db.select().from(vacationGoals);
  return rows.map((v) => ({ ...v, goalIds: links.filter((l) => l.vacationId === v.id).map((l) => l.goalId) }));
}
