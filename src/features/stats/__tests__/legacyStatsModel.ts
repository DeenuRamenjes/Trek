import { addDaysTo } from '../../../domain/dates';
import {
  bestWeekday,
  completion,
  dailySeries,
  perGoal,
  rangeBounds,
  weeklyBars,
  type StatsMode,
  type StatsRange,
} from '../../../domain/statsCalculator';
import { effectiveVersion } from '../../../domain/scheduleEngine';
import { bestStreak, currentStreak } from '../../../domain/streaks';
import type { GoalContext, Log } from '../../../domain/types';
import type { StatsInput, StatsModel, StreakUnit } from '../statsModel';


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

export function buildStatsModelLegacy(input: StatsInput): StatsModel {
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
