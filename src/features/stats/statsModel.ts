import { addDaysTo } from '../../domain/dates';
import {
  bestWeekday,
  completion,
  dailySeries,
  perGoal,
  rangeBounds,
  weeklyBars,
  type StatsMode,
  type StatsRange,
} from '../../domain/statsCalculator';
import { effectiveVersion } from '../../domain/scheduleEngine';
import { bestStreak, currentStreak } from '../../domain/streaks';
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

function maxStreak(ctxs: GoalContext[], streak: (c: GoalContext) => number, today: string): { value: number; unit: StreakUnit } {
  let value = 0;
  let unit: StreakUnit = 'days';
  for (const c of ctxs) {
    const n = streak(c);
    if (n > value) {
      value = n;
      unit = effectiveVersion(c.versions, today)?.scheduleType === 'timesPerWeek' ? 'weeks' : 'days';
    }
  }
  return { value, unit };
}

export function buildStatsModel(input: StatsInput): StatsModel {
  const { logs, range, mode, today, weekStart } = input;
  const ids = input.goalIds ? new Set(input.goalIds) : null;
  const ctxs = input.contexts.filter((c) => !ids || ids.has(c.goal.id));
  const earliest = ctxs.reduce((min, c) => (c.goal.startDate < min ? c.goal.startDate : min), today);
  const { from, to } = rangeBounds(range, today, earliest);

  const c = completion(ctxs, logs, from, to, today, mode, weekStart);
  const heat = dailySeries(ctxs, logs, from, to, today, mode, weekStart);

  // Rolling 7-day trend needs six days of lead-in before `from`.
  const lead = dailySeries(ctxs, logs, addDaysTo(from, -6), to, today, mode, weekStart);
  const trend = lead.slice(6).map((_, i) => {
    let credit = 0;
    let denominator = 0;
    for (const p of lead.slice(i, i + 7)) {
      credit += p.credit;
      denominator += p.denominator;
    }
    return { date: lead[i + 6].date, percent: denominator > 0 ? (credit / denominator) * 100 : null };
  });

  const cur = maxStreak(ctxs, (x) => currentStreak(x, logs, today, weekStart), today);
  const best = maxStreak(ctxs, (x) => bestStreak(x, logs, today, weekStart), today);
  const byGoal = perGoal(ctxs, logs, from, to, today, mode, weekStart);

  return {
    range: { from, to },
    completion: { percent: c.percent, done: c.done, partial: c.partial, skipped: c.skipped, vacation: c.vacation, missed: c.missed },
    currentStreak: cur.value,
    bestStreak: best.value,
    currentStreakUnit: cur.unit,
    bestStreakUnit: best.unit,
    heatmap: heat.map((p) => ({ date: p.date, ratio: p.denominator > 0 ? p.credit / p.denominator : null, vacation: p.denominator === 0 && p.vacation > 0 })),
    weekly: weeklyBars(ctxs, logs, from, to, today, mode, weekStart).map((b) => ({ weekStart: b.weekStart, percent: b.percent })),
    trend,
    perGoal: ctxs.map((x, i) => ({ goalId: x.goal.id, name: x.goal.name, color: x.goal.color, percent: byGoal[i].percent })),
    bestWeekday: bestWeekday(ctxs, logs, from, to, today, mode, weekStart).best,
  };
}
