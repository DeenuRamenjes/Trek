/** Shift a YYYY-MM-DD date by whole days (calendar arithmetic, no time zone involved). */
export function addDaysToDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
