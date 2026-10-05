import { format, getISOWeek } from 'date-fns';
import { addDaysTo, formatDate, parseDate, weekStartOf } from '../../domain/dates';
import { periodBounds, type Period } from '../../domain/reviewBuilder';
import { strings } from '../../strings/en';

const WEEK = /^week-(\d{4}-\d{2}-\d{2})$/;
const MONTH = /^month-(\d{4}-\d{2})$/;

const isRealDate = (s: string) => formatDate(parseDate(s)) === s;

/** `week-YYYY-MM-DD` (any date in the week) or `month-YYYY-MM`; null when invalid. Month anchors on its first day. */
export function parsePeriodParam(s: string | undefined | null): Period | null {
  if (!s) return null;
  const w = WEEK.exec(s);
  if (w) return isRealDate(w[1]) ? { kind: 'week', anchor: w[1] } : null;
  const m = MONTH.exec(s);
  if (m) {
    const anchor = `${m[1]}-01`;
    return isRealDate(anchor) ? { kind: 'month', anchor } : null;
  }
  return null;
}

/** Canonical param: the first day of the week, or the year and month. */
export function formatPeriodParam(p: Period, weekStart: number): string {
  if (p.kind === 'week') return `week-${weekStartOf(p.anchor, weekStart)}`;
  return `month-${p.anchor.slice(0, 7)}`;
}

/** `Week 40` (ISO week of the week's Monday) or `October 2026`. */
export function periodLabel(p: Period, weekStart: number): string {
  if (p.kind === 'month') return format(parseDate(p.anchor), 'MMMM yyyy');
  const from = weekStartOf(p.anchor, weekStart);
  const monday = addDaysTo(from, (1 - weekStart + 7) % 7);
  return strings.review.weekTitle(getISOWeek(parseDate(monday)));
}

export function nextPeriod(p: Period, weekStart: number): Period {
  const { to } = periodBounds(p, weekStart);
  return { kind: p.kind, anchor: addDaysTo(to, 1) };
}

/** True when the next period starts on or before the logical today. */
export function canGoNext(p: Period, weekStart: number, today: string): boolean {
  return periodBounds(nextPeriod(p, weekStart), weekStart).from <= today;
}
