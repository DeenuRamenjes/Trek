import {
  goalLogsByDate,
  indexLogs,
  rangeBounds,
  statsBundle,
  type StatsMode,
  type StatsRange,
} from '../../domain/statsCalculator';
import { effectiveVersion } from '../../domain/scheduleEngine';
import { streaksFromIndex } from '../../domain/streaks';
import type { GoalContext, Log } from '../../domain/types';

export type StatsModel = {
  range: { from: string; to: string };
  completion: { percent: number; done: number; partial: number; skipped: number; vacation: number; missed: number };
  /** Highest current streak over the selected goals. */
  currentStreak: number;
  /** Highest best streak over the selected goals. */
  bestStreak: number;
  /** Unit of the goal holding the max: weeks for timesPerWeek goals, otherwise days. */
  currentStreakUnit: StreakUnit;
  bestStreakUnit: StreakUnit;
  /** One cell per date in range; ratio is 0-1, or null when nothing was scored that day. `vacation` is set when nothing was scored because a vacation covered the day. */
  heatmap: { date: string; ratio: number | null; vacation: boolean }[];
  weekly: { weekStart: string; percent: number }[];
  /** 7-day rolling completion percent, one point per date in range. */
  /** percent is null when the 7-day window had nothing scored. */
  trend: { date: string; percent: number | null }[];
  perGoal: { goalId: string; name: string; color: string; percent: number }[];
  /** ISO weekday 0 = Monday; null without data. */
  bestWeekday: number | null;
};

export type StreakUnit = 'days' | 'weeks';

export type StatsInput = {
  contexts: GoalContext[];
  logs: Log[];
  /** Goal ids to include; null means every context. */
  goalIds: string[] | null;
  range: StatsRange;
  mode: StatsMode;
  today: string;
  weekStart: number;
};

export function buildStatsModel(input: StatsInput): StatsModel {
  const { logs, range, mode, today, weekStart } = input;
  const ids = input.goalIds ? new Set(input.goalIds) : null;
  const ctxs = input.contexts.filter((c) => !ids || ids.has(c.goal.id));
  const earliest = ctxs.reduce((min, c) => (c.goal.startDate < min ? c.goal.startDate : min), today);
  const { from, to } = rangeBounds(range, today, earliest);

  const index = indexLogs(logs);
  const b = statsBundle(ctxs, index, from, to, today, mode, weekStart);

  // Rolling 7-day trend: lead holds six days of lead-in before `from`.
  const trend = b.daily.map((_, i) => {
    let credit = 0;
    let denominator = 0;
    for (let k = i; k < i + 7; k++) {
      credit += b.lead[k].credit;
      denominator += b.lead[k].denominator;
    }
    return { date: b.lead[i + 6].date, percent: denominator > 0 ? (credit / denominator) * 100 : null };
  });

  let curValue = 0;
  let curUnit: StreakUnit = 'days';
  let bestValue = 0;
  let bestUnit: StreakUnit = 'days';
  for (const c of ctxs) {
    const { current, best } = streaksFromIndex(c, goalLogsByDate(index, c.goal.id), today, weekStart);
    const unit: StreakUnit = effectiveVersion(c.versions, today)?.scheduleType === 'timesPerWeek' ? 'weeks' : 'days';
    if (current > curValue) {
      curValue = current;
      curUnit = unit;
    }
    if (best > bestValue) {
      bestValue = best;
      bestUnit = unit;
    }
  }

  const c = b.completion;
  return {
    range: { from, to },
    completion: { percent: c.percent, done: c.done, partial: c.partial, skipped: c.skipped, vacation: c.vacation, missed: c.missed },
    currentStreak: curValue,
    bestStreak: bestValue,
    currentStreakUnit: curUnit,
    bestStreakUnit: bestUnit,
    heatmap: b.daily.map((p) => ({ date: p.date, ratio: p.denominator > 0 ? p.credit / p.denominator : null, vacation: p.denominator === 0 && p.vacation > 0 })),
    weekly: b.weekly.map((w) => ({ weekStart: w.weekStart, percent: w.percent })),
    trend,
    perGoal: ctxs.map((x, i) => ({ goalId: x.goal.id, name: x.goal.name, color: x.goal.color, percent: b.perGoal[i].percent })),
    bestWeekday: b.bestWeekday.best,
  };
}
