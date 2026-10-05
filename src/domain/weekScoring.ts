import { addDaysTo, eachDate, weekStartOf } from './dates';
import { dayStatus } from './dayStatus';
import { effectiveVersion, eligibleWithoutVacation } from './scheduleEngine';
import type { GoalContext, Log } from './types';
import { vacationCovers } from './vacationRules';

export type WeekScore = {
  /** Days of the week on a timesPerWeek version passing every rule except vacation. */
  eligibleDays: number;
  vacationDays: number;
  adjustedTarget: number;
  doneDays: number;
  credited: number;
  missed: number;
  ended: boolean;
  /** Target 0 or no eligible days: counts for nothing. */
  neutral: boolean;
};

/** Score one week (design 3.4). `weekStartDate` is the first day of the week. */
export function scoreWeek(
  ctx: GoalContext,
  logs: Log[],
  weekStartDate: string,
  today: string,
): WeekScore {
  const days = eachDate(weekStartDate, addDaysTo(weekStartDate, 6)).filter((d) => {
    const v = effectiveVersion(ctx.versions, d);
    return v?.scheduleType === 'timesPerWeek' && eligibleWithoutVacation(ctx, d);
  });
  const eligibleDays = days.length;
  const vacDays = days.filter((d) => vacationCovers(ctx.vacations, ctx.goal.id, d));
  const vacationDays = vacDays.length;
  const target = eligibleDays
    ? (effectiveVersion(ctx.versions, days[days.length - 1])?.timesPerWeek ?? 0)
    : 0;
  const adjustedTarget =
    eligibleDays > 0 && target > 0 ? Math.ceil((target * (eligibleDays - vacationDays)) / eligibleDays) : 0;
  const doneDays = days.filter((d) => dayStatus(ctx, logs, d, today).status === 'done').length;
  const credited = Math.min(doneDays, adjustedTarget);
  const ended = addDaysTo(weekStartDate, 6) < today;
  return {
    eligibleDays,
    vacationDays,
    adjustedTarget,
    doneDays,
    credited,
    missed: ended ? adjustedTarget - credited : 0,
    ended,
    neutral: adjustedTarget === 0,
  };
}

/** True when the week of `date` needs nothing more (quota met, or neutral week). */
export function quotaMet(
  ctx: GoalContext,
  logs: Log[],
  date: string,
  today: string,
  weekStart: number,
): boolean {
  const s = scoreWeek(ctx, logs, weekStartOf(date, weekStart), today);
  return s.neutral || s.doneDays >= s.adjustedTarget;
}
