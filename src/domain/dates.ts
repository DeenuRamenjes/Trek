import { addDays, differenceInCalendarDays, startOfWeek } from 'date-fns';

/** Parse `YYYY-MM-DD` as a local-midnight Date (never UTC). */
export function parseDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));

/** `yyyy-MM-dd` from local date parts. Hand-rolled: date-fns `format` dominated the 3-year stats profile. */
export function formatDate(d: Date): string {
  return `${String(d.getFullYear()).padStart(4, '0')}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function addDaysTo(date: string, n: number): string {
  return formatDate(addDays(parseDate(date), n));
}

/** Whole calendar days from b to a (a - b). */
export function diffDays(a: string, b: string): number {
  return differenceInCalendarDays(parseDate(a), parseDate(b));
}

/** ISO weekday: 0 = Monday … 6 = Sunday. */
export function isoWeekday(date: string): number {
  return (parseDate(date).getDay() + 6) % 7;
}

/** First day of the week containing `date`; weekStart 0 = Sunday … 6 = Saturday. */
export function weekStartOf(date: string, weekStart: number): string {
  return formatDate(startOfWeek(parseDate(date), { weekStartsOn: weekStart as 0 | 1 | 2 | 3 | 4 | 5 | 6 }));
}

/** Inclusive list of dates from `from` to `to`; empty when from > to. */
export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  const n = diffDays(to, from);
  const d = parseDate(from);
  for (let i = 0; i <= n; i++) {
    out.push(formatDate(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}
