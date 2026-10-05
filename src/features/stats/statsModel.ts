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
import { bestStreak, currentStreak } from '../../domain/streaks';
import type { GoalContext, Log } from '../../domain/types';

export type StatsModel = {
  range: { from: string; to: string };
  completion: { percent: number; done: number; partial: number; skipped: number; vacation: number; missed: number };
  /** Highest current streak over the selected goals. */
  currentStreak: number;
  /** Highest best streak over the selected goals. */
  bestStreak: number;
  /** One cell per date in range; ratio is 0-1, or null when nothing was scored that day. */
  heatmap: { date: string; ratio: number | null }[];
  weekly: { weekStart: string; percent: number }[];
  /** 7-day rolling completion percent, one point per date in range. */
  trend: { date: string; percent: number }[];
  perGoal: { goalId: string; name: string; color: string; percent: number }[];
  /** ISO weekday 0 = Monday; null without data. */
  bestWeekday: number | null;
};

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
    return { date: lead[i + 6].date, percent: denominator > 0 ? (credit / denominator) * 100 : 0 };
  });

  const byGoal = perGoal(ctxs, logs, from, to, today, mode, weekStart);

  return {
    range: { from, to },
    completion: { percent: c.percent, done: c.done, partial: c.partial, skipped: c.skipped, vacation: c.vacation, missed: c.missed },
    currentStreak: ctxs.reduce((m, x) => Math.max(m, currentStreak(x, logs, today, weekStart)), 0),
    bestStreak: ctxs.reduce((m, x) => Math.max(m, bestStreak(x, logs, today, weekStart)), 0),
    heatmap: heat.map((p) => ({ date: p.date, ratio: p.denominator > 0 ? p.credit / p.denominator : null })),
    weekly: weeklyBars(ctxs, logs, from, to, today, mode, weekStart).map((b) => ({ weekStart: b.weekStart, percent: b.percent })),
    trend,
    perGoal: ctxs.map((x, i) => ({ goalId: x.goal.id, name: x.goal.name, color: x.goal.color, percent: byGoal[i].percent })),
    bestWeekday: bestWeekday(ctxs, logs, from, to, today, mode, weekStart).best,
  };
}
