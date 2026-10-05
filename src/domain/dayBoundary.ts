import { addHours, subHours } from 'date-fns';
import { formatDate, parseDate } from './dates';

/** Logical date of a timestamp: local date of (ts - dayEndsAt hours). */
export function logicalDate(ts: Date, dayEndsAt: number): string {
  return formatDate(subHours(ts, dayEndsAt));
}

export function logicalToday(now: Date, dayEndsAt: number): string {
  return logicalDate(now, dayEndsAt);
}

/** Instant at which the logical `date` ends: local midnight after `date` plus dayEndsAt hours. */
export function dayRolloverAt(date: string, dayEndsAt: number): Date {
  const d = parseDate(date);
  return addHours(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1), dayEndsAt);
}
