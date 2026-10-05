import { subHours } from 'date-fns';
import { addDaysTo, formatDate, parseDate, weekStartOf } from './dates';
import { bestWeekday, completion, perGoal, skippedByWeekday } from './statsCalculator';
import type { Completion, StatsMode } from './statsCalculator';
import { currentStreak } from './streaks';
import type { GoalContext, Log } from './types';

export type Period = { kind: 'week' | 'month'; /** Any date inside the period. */ anchor: string };

export type InsightId =
  | 'overallImproved'
  | 'overallDeclined'
  | 'goalImproved'
  | 'goalDeclined'
  | 'streakGained'
  | 'mostSkippedWeekday'
  | 'perfectPeriod'
  | 'mostConsistentGoal'
  | 'totalDone'
  | 'dueDays';

/** Data-only insight; render with `formatInsight`. Params are strings or numbers. */
export type Insight = { id: InsightId; params: Record<string, string | number>; magnitude: number };

/** Strings table the domain receives from the caller (never imported here). */
export type InsightStrings = {
  /** Templates with `{name}` placeholders matching the insight params. */
  templates: Record<InsightId, string>;
  /** Names indexed by ISO weekday, 0 = Monday. */
  weekdays: readonly string[];
  /** Words for `{period}` and `{previous}`: 'week' / 'month'. */
  periods: Record<'week' | 'month', string>;
};

export type TimeBucket = 'morning' | 'afternoon' | 'evening' | 'night';
export type TimeSlotResult =
  | { kind: 'slot'; label: string; count: number }
  | { kind: 'bucket'; bucket: TimeBucket; count: number };

export type GoalReview = { goalId: string; name: string; percent: number; denominator: number; previousPercent: number | null };
export type StreakChange = { goalId: string; name: string; before: number; after: number };

export type Review = {
  period: Period;
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  overall: Completion;
  previousOverall: Completion;
  /** Percentage points versus the previous period; null when either period has no data. */
  delta: number | null;
  perGoal: GoalReview[];
  bestGoal: GoalReview | null;
  /** Null when there is only one goal with data. */
  worstGoal: GoalReview | null;
  streaksGained: StreakChange[];
  streaksLost: StreakChange[];
  /** ISO weekday (0 = Monday) or null. */
  bestWeekday: number | null;
  bestTimeSlot: TimeSlotResult | null;
  totals: { done: number; skipped: number; vacation: number; missed: number };
  insights: Insight[];
};

export function periodBounds(period: Period, weekStart: number): { from: string; to: string } {
  if (period.kind === 'week') {
    const from = weekStartOf(period.anchor, weekStart);
    return { from, to: addDaysTo(from, 6) };
  }
  const d = parseDate(period.anchor);
  return {
    from: formatDate(new Date(d.getFullYear(), d.getMonth(), 1)),
    to: formatDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  };
}

/** Previous week, or previous calendar month (anchored on its first day). */
export function previousPeriod(period: Period, weekStart: number): Period {
  const { from } = periodBounds(period, weekStart);
  if (period.kind === 'week') return { kind: 'week', anchor: addDaysTo(from, -7) };
  const d = parseDate(from);
  return { kind: 'month', anchor: formatDate(new Date(d.getFullYear(), d.getMonth() - 1, 1)) };
}

/** Time-of-day bucket of the logged time shifted by `dayEndsAt` hours, like the logical day. */
export function timeBucket(loggedAt: string, dayEndsAt = 0): TimeBucket {
  const h = subHours(new Date(loggedAt), dayEndsAt).getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

function bestTimeSlot(ctxs: GoalContext[], logs: Log[], from: string, to: string): TimeSlotResult | null {
  const counts = new Map<string, { result: TimeSlotResult; count: number }>();
  const goals = new Map(ctxs.map((c) => [c.goal.id, c]));
  for (const l of logs) {
    const ctx = goals.get(l.goalId);
    if (!ctx || l.status !== 'done' || l.date < from || l.date > to) continue;
    const label = l.slotId ? ctx.slots?.find((s) => s.id === l.slotId)?.label : null;
    const bucket = timeBucket(l.loggedAt, ctx.dayEndsAt);
    const key = label ? `slot:${label}` : `bucket:${bucket}`;
    const entry = counts.get(key) ?? {
      count: 0,
      result: label ? { kind: 'slot', label, count: 0 } : { kind: 'bucket', bucket, count: 0 },
    };
    entry.count += 1;
    entry.result.count = entry.count;
    counts.set(key, entry);
  }
  const keys = [...counts.keys()].sort();
  let best: string | null = null;
  for (const k of keys) if (best === null || counts.get(k)!.count > counts.get(best)!.count) best = k;
  return best ? counts.get(best)!.result : null;
}

/** Streak of a goal as of the end of a period (the last day counts as finished unless it is today or later). */
function streakAt(ctx: GoalContext, logs: Log[], to: string, today: string, weekStart: number): number {
  const asOf = to >= today ? today : addDaysTo(to, 1);
  return currentStreak(ctx, logs.filter((l) => l.date <= to), asOf, weekStart);
}

const round = (n: number) => Math.round(n);

function compareInsights(a: Insight, b: Insight): number {
  if (b.magnitude !== a.magnitude) return b.magnitude - a.magnitude;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  const ak = JSON.stringify(a.params);
  const bk = JSON.stringify(b.params);
  return ak < bk ? -1 : ak > bk ? 1 : 0;
}

/** Minimum change in percentage points for an improved/declined insight. */
const MIN_CHANGE = 5;

/**
 * Weekly or monthly review (design 3.7, CLAUDE.md 5.8). `today` is the logical today.
 * Insights: rule templates ranked by magnitude (percentage points, streak days, 5 per skip, 15 for a
 * perfect period), then id and params; the top 3 are kept.
 */
export function buildReview(args: {
  period: Period;
  weekStart: number;
  today: string;
  ctxs: GoalContext[];
  logs: Log[];
  mode?: StatsMode;
}): Review {
  const { period, weekStart, today, ctxs, logs } = args;
  const mode = args.mode ?? 'weighted';
  const { from, to } = periodBounds(period, weekStart);
  const prev = periodBounds(previousPeriod(period, weekStart), weekStart);

  const overall = completion(ctxs, logs, from, to, today, mode, weekStart);
  const previousOverall = completion(ctxs, logs, prev.from, prev.to, today, mode, weekStart);
  const delta = overall.denominator > 0 && previousOverall.denominator > 0 ? overall.percent - previousOverall.percent : null;

  const cur = perGoal(ctxs, logs, from, to, today, mode, weekStart);
  const old = perGoal(ctxs, logs, prev.from, prev.to, today, mode, weekStart);
  const goals: GoalReview[] = ctxs.map((c, i) => ({
    goalId: c.goal.id,
    name: c.goal.name,
    percent: cur[i].percent,
    denominator: cur[i].denominator,
    previousPercent: old[i].denominator > 0 ? old[i].percent : null,
  }));
  const withData = goals.filter((g) => g.denominator > 0);
  const byRank = [...withData].sort((a, b) => b.percent - a.percent || (a.name < b.name ? -1 : a.name > b.name ? 1 : a.goalId < b.goalId ? -1 : 1));
  const bestGoal = byRank[0] ?? null;
  const worstGoal = byRank.length > 1 ? byRank[byRank.length - 1] : null;

  const gained: StreakChange[] = [];
  const lost: StreakChange[] = [];
  for (const c of ctxs) {
    const before = streakAt(c, logs, prev.to, today, weekStart);
    const after = streakAt(c, logs, to, today, weekStart);
    const change = { goalId: c.goal.id, name: c.goal.name, before, after };
    if (after > before) gained.push(change);
    else if (after < before) lost.push(change);
  }

  const bw = bestWeekday(ctxs, logs, from, to, today, mode, weekStart).best;
  const totals = { done: overall.done, skipped: overall.skipped, vacation: overall.vacation, missed: overall.missed };

  const insights: Insight[] = [];
  const periodWord = period.kind;
  // With a single goal the overall insight would repeat the goal insight.
  if (delta !== null && Math.abs(delta) >= MIN_CHANGE && ctxs.length > 1) {
    insights.push({
      id: delta > 0 ? 'overallImproved' : 'overallDeclined',
      params: { percent: round(Math.abs(delta)), period: periodWord },
      magnitude: Math.abs(delta),
    });
  }
  for (const g of goals) {
    if (g.denominator === 0 || g.previousPercent === null) continue;
    const d = g.percent - g.previousPercent;
    if (Math.abs(d) < MIN_CHANGE) continue;
    insights.push({
      id: d > 0 ? 'goalImproved' : 'goalDeclined',
      params: { goal: g.name, percent: round(Math.abs(d)), period: periodWord },
      magnitude: Math.abs(d),
    });
  }
  for (const s of gained) {
    insights.push({ id: 'streakGained', params: { goal: s.name, days: s.after - s.before }, magnitude: s.after - s.before });
  }
  const skips = skippedByWeekday(ctxs, logs, from, to, today, weekStart);
  const maxSkips = Math.max(...skips);
  if (maxSkips >= 2) {
    insights.push({ id: 'mostSkippedWeekday', params: { weekday: skips.indexOf(maxSkips) }, magnitude: maxSkips * 5 });
  }
  if (overall.denominator > 0 && overall.percent === 100 && to < today) {
    insights.push({ id: 'perfectPeriod', params: { period: periodWord }, magnitude: 15 });
  }
  insights.sort(compareInsights);
  // Filler rules so a scored period always has at least 2 insights; they never displace real ones.
  if (insights.length < 2 && overall.denominator > 0) {
    const fillers: Insight[] = [];
    if (bestGoal && bestGoal.percent > 0) {
      fillers.push({ id: 'mostConsistentGoal', params: { goal: bestGoal.name, percent: round(bestGoal.percent) }, magnitude: 0 });
    }
    fillers.push({ id: 'totalDone', params: { count: overall.done, period: periodWord }, magnitude: 0 });
    fillers.push({ id: 'dueDays', params: { count: overall.denominator, period: periodWord }, magnitude: 0 });
    insights.push(...fillers.slice(0, 2 - insights.length));
  }

  return {
    period,
    from,
    to,
    previousFrom: prev.from,
    previousTo: prev.to,
    overall,
    previousOverall,
    delta,
    perGoal: goals,
    bestGoal,
    worstGoal,
    streaksGained: gained,
    streaksLost: lost,
    bestWeekday: bw,
    bestTimeSlot: bestTimeSlot(ctxs, logs, from, to),
    totals,
    insights: insights.slice(0, 3),
  };
}

/** Render an insight with a strings table passed in by the caller. */
export function formatInsight(insight: Insight, strings: InsightStrings): string {
  const params: Record<string, string | number> = { ...insight.params };
  if (typeof params.weekday === 'number') params.weekday = strings.weekdays[params.weekday] ?? '';
  if (params.period === 'week' || params.period === 'month') {
    params.period = strings.periods[params.period];
  }
  return strings.templates[insight.id].replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}
