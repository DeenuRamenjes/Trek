import type { TrekDb } from '../../db/client';
import {
  listGoals,
  listPauses,
  listScheduleVersions,
  listSlots,
  listVacations,
} from '../../db/repositories';
import type { GoalContext, Slot } from '../../domain/types';

/** Builds a GoalContext per goal (sorted by sortOrder) from the repositories. */
export async function loadGoalContexts(
  db: TrekDb,
  opts: { includeArchived?: boolean; dayEndsAt?: number } = {},
): Promise<GoalContext[]> {
  const dayEndsAt = opts.dayEndsAt ?? 0;
  const goals = await listGoals(db, { includeArchived: opts.includeArchived ?? false });
  const vacations = await listVacations(db);
  const out: GoalContext[] = [];
  for (const goal of goals) {
    const versions = await listScheduleVersions(db, goal.id);
    const slots: Slot[] = [];
    for (const v of versions) slots.push(...(await listSlots(db, v.id)));
    out.push({
      goal,
      versions,
      pauses: await listPauses(db, goal.id),
      vacations,
      dayEndsAt,
      slots,
    });
  }
  return out;
}
