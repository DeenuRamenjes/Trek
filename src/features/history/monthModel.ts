import { addDaysTo, formatDate, parseDate, weekStartOf } from '../../domain/dates';
import { dayStatus, type DayStatus } from '../../domain/dayStatus';
import { effectiveVersion } from '../../domain/scheduleEngine';
import { completion } from '../../domain/statsCalculator';
import { bestStreak, currentStreak } from '../../domain/streaks';
import type { GoalContext, Log } from '../../domain/types';
import { scoreWeek } from '../../domain/weekScoring';
import type { StatusKey } from '../../ui/tokens';

export type StreakUnit = 'days' | 'weeks';

export type HistoryCell = {
  /** Null for the padding cells outside the month. */
  date: string | null;
  day: number | null;
  status: StatusKey | null;
  value: number;
  /** Value badge for count, duration and value goals; null otherwise. */
  badge: string | null;
  /** Future days cannot be edited. */
  readOnly: boolean;
  isToday: boolean;
};

export type HistoryWeek = {
  cells: HistoryCell[];
  /** timesPerWeek goals: credited days over the adjusted target ("2/3"). */
  quota: { done: number; target: number } | null;
};

export type MonthModel = {
  /** YYYY-MM */
  month: string;
  weeks: HistoryWeek[];
  header: {
    currentStreak: number;
    bestStreak: number;
    streakUnit: StreakUnit;
    /** 0-100, or null when nothing in the month was scored yet. */
    monthPercent: number | null;
  };
};

const WEEKS = 6;
const DAYS = 7;

export function toStatusKey(status: DayStatus): StatusKey {
  return status === 'not-due' ? 'notDue' : status;
}

function formatValue(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Shifts a YYYY-MM string by `delta` months. */
export function shiftMonth(month: string, delta: number): string {
  const d = parseDate(`${month}-01`);
  d.setMonth(d.getMonth() + delta);
  return formatDate(d).slice(0, 7);
}

/** Month grid (6 weeks x 7 days, starting on `weekStart`), header stats and weekly quota pills for one goal. */
export function buildMonthModel(ctx: GoalContext, logs: Log[], month: string, today: string, weekStart: number): MonthModel {
  const goalLogs = logs.filter((l) => l.goalId === ctx.goal.id);
  const first = `${month}-01`;
  const last = addDaysTo(shiftMonth(month, 1) + '-01', -1);
  const gridStart = weekStartOf(first, weekStart);
  const isCheck = ctx.goal.trackingType === 'check';

  const weeks: HistoryWeek[] = [];
  for (let w = 0; w < WEEKS; w++) {
    const ws = addDaysTo(gridStart, w * DAYS);
    const cells: HistoryCell[] = [];
    for (let i = 0; i < DAYS; i++) {
      const date = addDaysTo(ws, i);
      if (date < first || date > last) {
        cells.push({ date: null, day: null, status: null, value: 0, badge: null, readOnly: true, isToday: false });
        continue;
      }
      const info = dayStatus(ctx, goalLogs, date, today);
      const showBadge = !isCheck && info.value > 0 && info.status !== 'vacation' && info.status !== 'not-due';
      cells.push({
        date,
        day: Number(date.slice(8)),
        status: toStatusKey(info.status),
        value: info.value,
        badge: showBadge ? formatValue(info.value) : null,
        readOnly: date > today,
        isToday: date === today,
      });
    }
    let quota: HistoryWeek['quota'] = null;
    const score = scoreWeek(ctx, goalLogs, ws, today);
    if (score.eligibleDays > 0 && !score.neutral) quota = { done: score.credited, target: score.adjustedTarget };
    weeks.push({ cells, quota });
  }

  const through = last < today ? last : today;
  const scored = first <= through ? completion([ctx], goalLogs, first, through, today, 'weighted', weekStart) : null;
  const unit: StreakUnit = effectiveVersion(ctx.versions, today)?.scheduleType === 'timesPerWeek' ? 'weeks' : 'days';
  return {
    month,
    weeks,
    header: {
      currentStreak: currentStreak(ctx, goalLogs, today, weekStart),
      bestStreak: bestStreak(ctx, goalLogs, today, weekStart),
      streakUnit: unit,
      monthPercent: scored && scored.denominator > 0 ? scored.percent : null,
    },
  };
}
