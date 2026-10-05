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
export function isInActiveRange(goal: Goal, pauses: GoalPause[], date: string, dayEndsAt: number): boolean {
  if (date < goal.startDate) return false;
  if (goal.endDate && date > goal.endDate) return false;
  if (goal.targetDays != null && date >= addDaysTo(goal.startDate, goal.targetDays)) return false;
  if (pauses.some((p) => p.startDate <= date && (p.endDate == null || date <= p.endDate))) return false;
  if (goal.archivedAt && date >= logicalDate(new Date(goal.archivedAt), dayEndsAt)) return false;
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
