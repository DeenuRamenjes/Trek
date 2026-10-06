import { addDaysTo, eachDate, weekStartOf } from './dates';
import { dayStatus } from './dayStatus';
import { effectiveVersion } from './scheduleEngine';
import type { GoalContext, Log } from './types';
import { scoreWeek } from './weekScoring';

type Outcome = 'inc' | 'neutral' | 'break';

/**
 * Chronological streak outcomes from the goal start to `today`. Each day on a daily-type
 * version is one unit; each week with timesPerWeek days is one unit (placed after the week's days).
 */
function outcomes(ctx: GoalContext, byDate: Map<string, Log[]>, today: string, weekStart: number): Outcome[] {
  const out: Outcome[] = [];
  let ws = weekStartOf(ctx.goal.startDate, weekStart);
  while (ws <= today) {
    const days = eachDate(ws, addDaysTo(ws, 6));
    const weekLogs: Log[] = [];
    let hasWeekly = false;
    for (const d of days) {
      const dl = byDate.get(d);
      if (dl) weekLogs.push(...dl);
    }
    for (const d of days) {
      if (d > today) break;
      const v = effectiveVersion(ctx.versions, d);
      if (v?.scheduleType === 'timesPerWeek') {
        hasWeekly = true;
        continue;
      }
      const { status } = dayStatus(ctx, weekLogs, d, today);
      if (status === 'done') out.push('inc');
      else if (d === today) out.push('neutral');
      else if (status === 'partial' || status === 'missed') out.push('break');
      else out.push('neutral');
    }
    if (hasWeekly) {
      const s = scoreWeek(ctx, weekLogs, ws, today);
      if (s.neutral || !s.ended) out.push('neutral');
      else out.push(s.credited >= s.adjustedTarget ? 'inc' : 'break');
    }
    ws = addDaysTo(ws, 7);
  }
  return out;
}

function byDateOf(ctx: GoalContext, logs: Log[]): Map<string, Log[]> {
  const byDate = new Map<string, Log[]>();
  for (const l of logs) {
    if (l.goalId !== ctx.goal.id) continue;
    const arr = byDate.get(l.date);
    if (arr) arr.push(l);
    else byDate.set(l.date, [l]);
  }
  return byDate;
}

function currentOf(o: Outcome[]): number {
  let n = 0;
  for (let i = o.length - 1; i >= 0; i--) {
    if (o[i] === 'break') break;
    if (o[i] === 'inc') n++;
  }
  return n;
}

function bestOf(o: Outcome[]): number {
  let best = 0;
  let run = 0;
  for (const x of o) {
    if (x === 'break') run = 0;
    else if (x === 'inc') best = Math.max(best, ++run);
  }
  return best;
}

export function currentStreak(ctx: GoalContext, logs: Log[], today: string, weekStart: number): number {
  return currentOf(outcomes(ctx, byDateOf(ctx, logs), today, weekStart));
}

export function bestStreak(ctx: GoalContext, logs: Log[], today: string, weekStart: number): number {
  return bestOf(outcomes(ctx, byDateOf(ctx, logs), today, weekStart));
}

/** Current and best streak from one outcomes pass, using a goal's pre-bucketed logs. */
export function streaksFromIndex(
  ctx: GoalContext,
  byDate: Map<string, Log[]>,
  today: string,
  weekStart: number,
): { current: number; best: number } {
  const o = outcomes(ctx, byDate, today, weekStart);
  return { current: currentOf(o), best: bestOf(o) };
}

/** Milestone (7, 30 or 100) newly reached when the streak moves from `before` to `after`. */
export function milestoneReached(before: number, after: number): 7 | 30 | 100 | null {
  if (after <= before) return null;
  return after === 7 || after === 30 || after === 100 ? after : null;
}
