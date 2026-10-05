import { isoWeekday } from './dates';
import { effectiveVersion, eligibleWithoutVacation } from './scheduleEngine';
import type { GoalContext, Log, Slot } from './types';
import { vacationCovers } from './vacationRules';

export type DayStatus = 'done' | 'partial' | 'skipped' | 'vacation' | 'missed' | 'pending' | 'not-due';

export type DayInfo = {
  status: DayStatus;
  /** Sum of non-skipped log values, or done slots for slot goals (0 when vacation/not-due). */
  value: number;
  /** doneSlots/slots or value/target, capped at 1. */
  ratio: number;
};

/** Slots of the version effective on `date` that apply to its weekday. */
export function slotsForDate(ctx: GoalContext, date: string): Slot[] {
  const v = effectiveVersion(ctx.versions, date);
  if (!v || !ctx.slots) return [];
  const wd = isoWeekday(date);
  return ctx.slots.filter((s) => s.scheduleVersionId === v.id && s.weekday === wd);
}

/** Computed status of one day (design 3.3). Logs of other goals or dates are ignored. */
export function dayStatus(ctx: GoalContext, logs: Log[], date: string, today: string): DayInfo {
  const none = (status: DayStatus): DayInfo => ({ status, value: 0, ratio: 0 });
  if (!eligibleWithoutVacation(ctx, date)) return none('not-due');
  if (vacationCovers(ctx.vacations, ctx.goal.id, date)) return none('vacation');
  if (date > today) return none('not-due');

  const dayLogs = logs.filter((l) => l.goalId === ctx.goal.id && l.date === date);
  const skipped = dayLogs.some((l) => l.status === 'skipped');
  const counted = dayLogs.filter((l) => l.status !== 'skipped');
  const target = ctx.goal.targetValue;
  const slots = ctx.goal.trackingType === 'check' ? slotsForDate(ctx, date) : [];

  let value: number;
  let ratio: number;
  let done: boolean;
  let partial: boolean;
  if (ctx.goal.trackingType === 'check') {
    if (slots.length > 0) {
      const doneSlots = slots.filter((s) =>
        counted.some((l) => l.slotId === s.id && l.status === 'done'),
      ).length;
      value = doneSlots;
      ratio = doneSlots / slots.length;
      done = doneSlots === slots.length;
      partial = doneSlots > 0 && !done;
    } else {
      done = counted.some((l) => l.status === 'done');
      partial = !done && counted.some((l) => l.status === 'partial');
      value = done ? 1 : 0;
      ratio = done ? 1 : 0;
    }
  } else {
    value = counted.reduce((sum, l) => sum + l.value, 0);
    ratio = target > 0 ? Math.min(value / target, 1) : value > 0 ? 1 : 0;
    done = value > 0 && value >= target;
    partial = value > 0 && !done;
  }

  if (skipped) return { status: 'skipped', value, ratio };
  if (done) return { status: 'done', value, ratio };
  if (partial) return { status: 'partial', value, ratio };
  return { status: date === today ? 'pending' : 'missed', value, ratio };
}
