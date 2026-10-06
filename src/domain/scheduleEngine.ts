import { addDaysTo, diffDays, isoWeekday } from './dates';
import { logicalDate } from './dayBoundary';
import type { Goal, GoalContext, GoalPause, ScheduleVersion } from './types';
import { vacationCovers } from './vacationRules';

/** Version with the latest effectiveFrom <= date; ties go to the latest createdAt. */
export function effectiveVersion(versions: ScheduleVersion[], date: string): ScheduleVersion | undefined {
  let best: ScheduleVersion | undefined;
  for (const v of versions) {
    if (v.effectiveFrom > date) continue;
    if (
      !best ||
      v.effectiveFrom > best.effectiveFrom ||
      (v.effectiveFrom === best.effectiveFrom && v.createdAt > best.createdAt)
    )
      best = v;
  }
  return best;
}

/** Does this version's schedule make `date` due? (timesPerWeek: every day is eligible.) */
export function isScheduledOn(version: ScheduleVersion, date: string): boolean {
  const wd = isoWeekday(date);
  switch (version.scheduleType) {
    case 'daily':
    case 'timesPerWeek':
      return true;
    case 'weekdays':
      return wd <= 4;
    case 'weekends':
      return wd >= 5;
    case 'customDays':
      return (version.scheduleDays & (1 << wd)) !== 0;
    case 'everyNDays': {
      const n = version.everyNDays;
      if (!n || n < 1) return false;
      const diff = diffDays(date, version.effectiveFrom);
      return diff >= 0 && diff % n === 0;
    }
  }
}

/** Start/end/targetDays, pauses and archive; ignores schedule and vacations. */
type Limits = { dayEndsAt: number; targetEnd: string | null; archivedOn: string | null };
// Goal rows are never mutated in place, so their derived date limits can be cached (hot in 3-year stats).
const limitsCache = new WeakMap<Goal, Limits>();

function limitsOf(goal: Goal, dayEndsAt: number): Limits {
  const hit = limitsCache.get(goal);
  if (hit && hit.dayEndsAt === dayEndsAt) return hit;
  const limits: Limits = {
    dayEndsAt,
    targetEnd: goal.targetDays != null ? addDaysTo(goal.startDate, goal.targetDays) : null,
    archivedOn: goal.archivedAt ? logicalDate(new Date(goal.archivedAt), dayEndsAt) : null,
  };
  limitsCache.set(goal, limits);
  return limits;
}

export function isInActiveRange(goal: Goal, pauses: GoalPause[], date: string, dayEndsAt: number): boolean {
  if (date < goal.startDate) return false;
  if (goal.endDate && date > goal.endDate) return false;
  const limits = limitsOf(goal, dayEndsAt);
  if (limits.targetEnd !== null && date >= limits.targetEnd) return false;
  if (pauses.some((p) => p.startDate <= date && (p.endDate == null || date <= p.endDate))) return false;
  if (limits.archivedOn !== null && date >= limits.archivedOn) return false;
  return true;
}

/** Due ignoring vacations (active range and schedule). timesPerWeek: eligible. */
export function eligibleWithoutVacation(ctx: GoalContext, date: string): boolean {
  if (!isInActiveRange(ctx.goal, ctx.pauses, date, ctx.dayEndsAt)) return false;
  const v = effectiveVersion(ctx.versions, date);
  return v ? isScheduledOn(v, date) : false;
}

export function isDue(ctx: GoalContext, date: string): boolean {
  return eligibleWithoutVacation(ctx, date) && !vacationCovers(ctx.vacations, ctx.goal.id, date);
}
