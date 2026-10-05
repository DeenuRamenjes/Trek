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
function outcomes(ctx: GoalContext, logs: Log[], today: string, weekStart: number): Outcome[] {
  const byDate = new Map<string, Log[]>();
  for (const l of logs) {
    if (l.goalId !== ctx.goal.id) continue;
    const arr = byDate.get(l.date);
    if (arr) arr.push(l);
    else byDate.set(l.date, [l]);
  }
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

export function currentStreak(ctx: GoalContext, logs: Log[], today: string, weekStart: number): number {
  let n = 0;
  const o = outcomes(ctx, logs, today, weekStart);
  for (let i = o.length - 1; i >= 0; i--) {
    if (o[i] === 'break') break;
    if (o[i] === 'inc') n++;
  }
  return n;
}

export function bestStreak(ctx: GoalContext, logs: Log[], today: string, weekStart: number): number {
  let best = 0;
  let run = 0;
  for (const x of outcomes(ctx, logs, today, weekStart)) {
    if (x === 'break') run = 0;
    else if (x === 'inc') best = Math.max(best, ++run);
  }
  return best;
}

/** Milestone (7, 30 or 100) newly reached when the streak moves from `before` to `after`. */
export function milestoneReached(before: number, after: number): 7 | 30 | 100 | null {
  if (after <= before) return null;
  return after === 7 || after === 30 || after === 100 ? after : null;
}
