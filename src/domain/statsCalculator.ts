import { addDaysTo, eachDate, isoWeekday, weekStartOf } from './dates';
import { dayStatus } from './dayStatus';
import { effectiveVersion } from './scheduleEngine';
import type { GoalContext, Log } from './types';
import { scoreWeek } from './weekScoring';

export type StatsRange = '7D' | '30D' | '90D' | '1Y' | 'All';
export type StatsMode = 'weighted' | 'strict';

export type Completion = {
  credit: number;
  denominator: number;
  /** 0-100; 0 when the denominator is 0 (check `denominator`). */
  percent: number;
  done: number;
  partial: number;
  skipped: number;
  vacation: number;
  missed: number;
};

/** One scored unit: a daily-type day, or an ended timesPerWeek week (dated on its last day). */
type Unit = {
  date: string;
  goalId: string;
  weekly: boolean;
  credit: number;
  denominator: number;
  done: number;
  partial: number;
  skipped: number;
  vacation: number;
  missed: number;
};

const RANGE_DAYS: Record<Exclude<StatsRange, 'All'>, number> = { '7D': 7, '30D': 30, '90D': 90, '1Y': 365 };

/** Inclusive bounds ending at the logical today; 'All' starts at the earliest goal startDate. */
export function rangeBounds(range: StatsRange, today: string, earliestStart: string): { from: string; to: string } {
  if (range === 'All') return { from: earliestStart < today ? earliestStart : today, to: today };
  return { from: addDaysTo(today, 1 - RANGE_DAYS[range]), to: today };
}

function percentOf(credit: number, denominator: number): number {
  return denominator > 0 ? (credit / denominator) * 100 : 0;
}

/** Scored units of one goal in [from, to]. Single source for every stat below. */
/** Logs bucketed once by goal id, then by date. */
export type LogIndex = Map<string, Map<string, Log[]>>;

export function indexLogs(logs: Log[]): LogIndex {
  const index: LogIndex = new Map();
  for (const l of logs) {
    let byDate = index.get(l.goalId);
    if (!byDate) {
      byDate = new Map();
      index.set(l.goalId, byDate);
    }
    const arr = byDate.get(l.date);
    if (arr) arr.push(l);
    else byDate.set(l.date, [l]);
  }
  return index;
}

const NO_LOGS: Map<string, Log[]> = new Map();

export function goalLogsByDate(index: LogIndex, goalId: string): Map<string, Log[]> {
  return index.get(goalId) ?? NO_LOGS;
}

function goalUnits(
  ctx: GoalContext,
  index: LogIndex,
  from: string,
  to: string,
  today: string,
  mode: StatsMode,
  weekStart: number,
): Unit[] {
  const goalId = ctx.goal.id;
  const byDate = goalLogsByDate(index, goalId);
  const base = { goalId, weekly: false, credit: 0, denominator: 0, done: 0, partial: 0, skipped: 0, vacation: 0, missed: 0 };
  const units: Unit[] = [];
  const last = to < today ? to : today;
  for (const date of eachDate(from, last)) {
    if (effectiveVersion(ctx.versions, date)?.scheduleType === 'timesPerWeek') continue;
    const { status, ratio } = dayStatus(ctx, byDate.get(date) ?? [], date, today);
    if (status === 'done') units.push({ ...base, date, credit: 1, denominator: 1, done: 1 });
    else if (status === 'partial') units.push({ ...base, date, credit: mode === 'weighted' ? ratio : 0, denominator: 1, partial: 1 });
    else if (status === 'missed') units.push({ ...base, date, denominator: 1, missed: 1 });
    else if (status === 'skipped') units.push({ ...base, date, skipped: 1 });
    else if (status === 'vacation') units.push({ ...base, date, vacation: 1 });
  }
  // timesPerWeek: one unit per ended, non-neutral week whose last day lies in the range.
  let ws = weekStartOf(from, weekStart);
  while (ws <= last) {
    const end = addDaysTo(ws, 6);
    if (end >= from && end <= to && end < today) {
      const weekLogs: Log[] = [];
      for (const d of eachDate(ws, end)) {
        const dl = byDate.get(d);
        if (dl) weekLogs.push(...dl);
      }
      const s = scoreWeek(ctx, weekLogs, ws, today);
      if (!s.neutral) {
        const ratio = s.credited / s.adjustedTarget;
        const full = s.credited >= s.adjustedTarget;
        units.push({
          ...base,
          date: end,
          weekly: true,
          credit: full ? 1 : mode === 'weighted' ? ratio : 0,
          denominator: 1,
          done: full ? 1 : 0,
          partial: !full && s.credited > 0 ? 1 : 0,
          missed: !full && s.credited === 0 ? 1 : 0,
          vacation: s.vacationDays,
        });
      }
    }
    ws = addDaysTo(ws, 7);
  }
  return units;
}

function allUnits(
  ctxs: GoalContext[],
  logs: Log[],
  from: string,
  to: string,
  today: string,
  mode: StatsMode,
  weekStart: number,
): Unit[] {
  const index = indexLogs(logs);
  return ctxs.flatMap((c) => goalUnits(c, index, from, to, today, mode, weekStart));
}

function sum(units: Unit[]): Completion {
  const c: Completion = { credit: 0, denominator: 0, percent: 0, done: 0, partial: 0, skipped: 0, vacation: 0, missed: 0 };
  for (const u of units) {
    c.credit += u.credit;
    c.denominator += u.denominator;
    c.done += u.done;
    c.partial += u.partial;
    c.skipped += u.skipped;
    c.vacation += u.vacation;
    c.missed += u.missed;
  }
  c.percent = percentOf(c.credit, c.denominator);
  return c;
}

/**
 * Completion over [from, to] (design 3.6). Daily-type goals: due days that are done, partial or missed
 * (skipped, vacation and pending excluded). timesPerWeek goals: one unit per ended non-neutral week.
 * Partial credit is value/target in weighted mode and 0 in strict mode.
 */
export function completion(
  ctxs: GoalContext[],
  logs: Log[],
  from: string,
  to: string,
  today: string,
  mode: StatsMode,
  weekStart = 1,
): Completion {
  return sum(allUnits(ctxs, logs, from, to, today, mode, weekStart));
}

export type DailyPoint = { date: string; credit: number; denominator: number; percent: number; vacation: number };

/** One point per date in [from, to] (heatmap and trend). Weekly units land on the week's last day. */
export function dailySeries(
  ctxs: GoalContext[],
  logs: Log[],
  from: string,
  to: string,
  today: string,
  mode: StatsMode,
  weekStart = 1,
): DailyPoint[] {
  const byDate = new Map<string, { credit: number; denominator: number; vacation: number }>();
  for (const u of allUnits(ctxs, logs, from, to, today, mode, weekStart)) {
    const p = byDate.get(u.date) ?? { credit: 0, denominator: 0, vacation: 0 };
    p.credit += u.credit;
    p.denominator += u.denominator;
    p.vacation += u.vacation;
    byDate.set(u.date, p);
  }
  return eachDate(from, to).map((date) => {
    const p = byDate.get(date) ?? { credit: 0, denominator: 0, vacation: 0 };
    return { date, credit: p.credit, denominator: p.denominator, percent: percentOf(p.credit, p.denominator), vacation: p.vacation };
  });
}

export type WeekBar = { weekStart: string; credit: number; denominator: number; percent: number };

/** One bar per week (per `weekStart`) touching [from, to]. */
export function weeklyBars(
  ctxs: GoalContext[],
  logs: Log[],
  from: string,
  to: string,
  today: string,
  mode: StatsMode,
  weekStart: number,
): WeekBar[] {
  const bars = new Map<string, WeekBar>();
  for (let ws = weekStartOf(from, weekStart); ws <= to; ws = addDaysTo(ws, 7)) {
    bars.set(ws, { weekStart: ws, credit: 0, denominator: 0, percent: 0 });
  }
  for (const u of allUnits(ctxs, logs, from, to, today, mode, weekStart)) {
    const b = bars.get(weekStartOf(u.date, weekStart));
    if (!b) continue;
    b.credit += u.credit;
    b.denominator += u.denominator;
  }
  const out = [...bars.values()];
  for (const b of out) b.percent = percentOf(b.credit, b.denominator);
  return out;
}

export type GoalStat = Completion & { goalId: string };

/** Completion per goal, in the order given. */
export function perGoal(
  ctxs: GoalContext[],
  logs: Log[],
  from: string,
  to: string,
  today: string,
  mode: StatsMode,
  weekStart = 1,
): GoalStat[] {
  const index = indexLogs(logs);
  return ctxs.map((c) => ({ goalId: c.goal.id, ...sum(goalUnits(c, index, from, to, today, mode, weekStart)) }));
}

export type WeekdayStats = {
  /** ISO weekday 0 = Monday; percent per weekday (0 when no data). */
  byWeekday: { weekday: number; credit: number; denominator: number; percent: number }[];
  /** Highest completion among weekdays with data; ties go to the earliest weekday; null without data. */
  best: number | null;
};

/** Best weekday by completion. timesPerWeek weeks have no weekday and are excluded. */
export function bestWeekday(
  ctxs: GoalContext[],
  logs: Log[],
  from: string,
  to: string,
  today: string,
  mode: StatsMode,
  weekStart = 1,
): WeekdayStats {
  const byWeekday = Array.from({ length: 7 }, (_, weekday) => ({ weekday, credit: 0, denominator: 0, percent: 0 }));
  for (const u of allUnits(ctxs, logs, from, to, today, mode, weekStart)) {
    if (u.weekly) continue;
    const w = byWeekday[isoWeekday(u.date)];
    w.credit += u.credit;
    w.denominator += u.denominator;
  }
  let best: number | null = null;
  for (const w of byWeekday) {
    w.percent = percentOf(w.credit, w.denominator);
    if (w.denominator > 0 && (best === null || w.percent > byWeekday[best].percent)) best = w.weekday;
  }
  return { byWeekday, best };
}

/** Skipped daily-type days per ISO weekday (index 0 = Monday). */
export function skippedByWeekday(
  ctxs: GoalContext[],
  logs: Log[],
  from: string,
  to: string,
  today: string,
  weekStart = 1,
): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0];
  for (const u of allUnits(ctxs, logs, from, to, today, 'weighted', weekStart)) {
    if (!u.weekly && u.skipped) out[isoWeekday(u.date)] += u.skipped;
  }
  return out;
}

export type StatsBundle = {
  completion: Completion;
  daily: DailyPoint[];
  /** Daily points for [from - 6, to], for the rolling 7-day trend. */
  lead: DailyPoint[];
  weekly: WeekBar[];
  perGoal: GoalStat[];
  bestWeekday: WeekdayStats;
};

/**
 * Everything the Stats tab needs, from one scoring pass per goal over [from - 6, to].
 * Equivalent to calling completion, dailySeries (twice), weeklyBars, perGoal and bestWeekday.
 */
export function statsBundle(
  ctxs: GoalContext[],
  index: LogIndex,
  from: string,
  to: string,
  today: string,
  mode: StatsMode,
  weekStart = 1,
): StatsBundle {
  const leadFrom = addDaysTo(from, -6);
  const inRange: Unit[] = [];
  const goalStats: GoalStat[] = [];
  const leadMap = new Map<string, { credit: number; denominator: number; vacation: number }>();
  for (const c of ctxs) {
    const mine: Unit[] = [];
    for (const u of goalUnits(c, index, leadFrom, to, today, mode, weekStart)) {
      const p = leadMap.get(u.date) ?? { credit: 0, denominator: 0, vacation: 0 };
      p.credit += u.credit;
      p.denominator += u.denominator;
      p.vacation += u.vacation;
      leadMap.set(u.date, p);
      if (u.date >= from) mine.push(u);
    }
    for (const u of mine) inRange.push(u);
    goalStats.push({ goalId: c.goal.id, ...sum(mine) });
  }
  const series = (start: string): DailyPoint[] =>
    eachDate(start, to).map((date) => {
      const p = leadMap.get(date) ?? { credit: 0, denominator: 0, vacation: 0 };
      return { date, credit: p.credit, denominator: p.denominator, percent: percentOf(p.credit, p.denominator), vacation: p.vacation };
    });
  const lead = series(leadFrom);
  const daily = lead.slice(6);

  const bars = new Map<string, WeekBar>();
  for (let ws = weekStartOf(from, weekStart); ws <= to; ws = addDaysTo(ws, 7)) {
    bars.set(ws, { weekStart: ws, credit: 0, denominator: 0, percent: 0 });
  }
  const byWeekday = Array.from({ length: 7 }, (_, weekday) => ({ weekday, credit: 0, denominator: 0, percent: 0 }));
  for (const u of inRange) {
    const b = bars.get(weekStartOf(u.date, weekStart));
    if (b) {
      b.credit += u.credit;
      b.denominator += u.denominator;
    }
    if (!u.weekly) {
      const w = byWeekday[isoWeekday(u.date)];
      w.credit += u.credit;
      w.denominator += u.denominator;
    }
  }
  const weekly = [...bars.values()];
  for (const b of weekly) b.percent = percentOf(b.credit, b.denominator);
  let best: number | null = null;
  for (const w of byWeekday) {
    w.percent = percentOf(w.credit, w.denominator);
    if (w.denominator > 0 && (best === null || w.percent > byWeekday[best].percent)) best = w.weekday;
  }
  return { completion: sum(inRange), daily, lead, weekly, perGoal: goalStats, bestWeekday: { byWeekday, best } };
}
