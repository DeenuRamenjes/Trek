import { dayStatus, slotsForDate, type DayStatus } from '../../domain/dayStatus';
import { effectiveVersion, isDue } from '../../domain/scheduleEngine';
import type { GoalContext, Goal, Log } from '../../domain/types';
import { quotaMet, scoreWeek } from '../../domain/weekScoring';
import { weekStartOf } from '../../domain/dates';

export type TodaySlot = { id: string; time: string; label: string | null; done: boolean };

export type ProgressText =
  | { key: 'check' }
  | { key: 'slots'; params: { done: number; total: number } }
  | { key: 'amount'; params: { value: number; target: number; unit: string | null } };

export type TodayRow = {
  goalId: string;
  name: string;
  icon: string;
  color: string;
  trackingType: Goal['trackingType'];
  status: DayStatus;
  value: number;
  target: number;
  unit: string | null;
  slots: TodaySlot[];
  /** timesPerWeek goals while the week's quota is unmet. */
  weekProgress: { done: number; target: number } | null;
  progressText: ProgressText;
};

export type TodayModel = { pending: TodayRow[]; done: TodayRow[] };

function progressFor(goal: Goal, slots: TodaySlot[], value: number): ProgressText {
  if (goal.trackingType === 'check') {
    if (slots.length > 0) return { key: 'slots', params: { done: slots.filter((s) => s.done).length, total: slots.length } };
    return { key: 'check' };
  }
  return { key: 'amount', params: { value, target: goal.targetValue, unit: goal.unit } };
}

/**
 * Checklist rows for `date`. Only due goals appear; a timesPerWeek goal whose weekly quota is already met
 * appears only if it was itself completed on `date`. Done and skipped rows go to `done`. Sorted by sortOrder.
 */
export function buildTodayRows(
  contexts: GoalContext[],
  logs: Log[],
  date: string,
  today: string,
  weekStart: number,
): TodayModel {
  const pending: TodayRow[] = [];
  const done: TodayRow[] = [];
  const sorted = [...contexts].sort((a, b) => a.goal.sortOrder - b.goal.sortOrder);
  for (const ctx of sorted) {
    if (!isDue(ctx, date)) continue;
    const info = dayStatus(ctx, logs, date, today);
    const isWeekly = effectiveVersion(ctx.versions, date)?.scheduleType === 'timesPerWeek';
    const finished = info.status === 'done' || info.status === 'skipped';
    if (isWeekly && !finished && quotaMet(ctx, logs, date, today, weekStart)) continue;

    const goalLogs = logs.filter((l) => l.goalId === ctx.goal.id && l.date === date && l.status !== 'skipped');
    const slots: TodaySlot[] =
      ctx.goal.trackingType === 'check'
        ? slotsForDate(ctx, date).map((s) => ({
            id: s.id,
            time: s.time,
            label: s.label ?? null,
            done: goalLogs.some((l) => l.slotId === s.id && l.status === 'done'),
          }))
        : [];
    let weekProgress: TodayRow['weekProgress'] = null;
    if (isWeekly) {
      const w = scoreWeek(ctx, logs, weekStartOf(date, weekStart), today);
      if (w.doneDays < w.adjustedTarget) weekProgress = { done: w.doneDays, target: w.adjustedTarget };
    }
    const row: TodayRow = {
      goalId: ctx.goal.id,
      name: ctx.goal.name,
      icon: ctx.goal.icon,
      color: ctx.goal.color,
      trackingType: ctx.goal.trackingType,
      status: info.status === 'not-due' ? 'pending' : info.status,
      value: info.value,
      target: ctx.goal.targetValue,
      unit: ctx.goal.unit,
      slots,
      weekProgress,
      progressText: progressFor(ctx.goal, slots, info.value),
    };
    (finished ? done : pending).push(row);
  }
  return { pending, done };
}
