import { addDaysTo, diffDays, eachDate, formatDate, isoWeekday, parseDate, weekStartOf } from '../dates';

describe('dates', () => {
  it('parse/format round trip is local', () => {
    const d = parseDate('2026-03-08');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 2, 8, 0]);
    expect(formatDate(d)).toBe('2026-03-08');
  });
  it('addDaysTo crosses month and year', () => {
    expect(addDaysTo('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysTo('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDaysTo('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysTo('2024-02-28', 1)).toBe('2024-02-29');
  });
  it('diffDays', () => {
    expect(diffDays('2026-01-10', '2026-01-01')).toBe(9);
    expect(diffDays('2026-01-01', '2026-01-10')).toBe(-9);
    expect(diffDays('2026-01-01', '2025-01-01')).toBe(365);
  });
  it('isoWeekday 0=Mon', () => {
    expect(isoWeekday('2026-10-05')).toBe(0); // Monday
    expect(isoWeekday('2026-10-11')).toBe(6); // Sunday
    expect(isoWeekday('2026-10-10')).toBe(5);
  });
  it('weekStartOf honours weekStart (0=Sun)', () => {
    expect(weekStartOf('2026-10-08', 1)).toBe('2026-10-05');
    expect(weekStartOf('2026-10-11', 1)).toBe('2026-10-05');
    expect(weekStartOf('2026-10-11', 0)).toBe('2026-10-11');
    expect(weekStartOf('2026-10-10', 0)).toBe('2026-10-04');
    expect(weekStartOf('2026-10-05', 6)).toBe('2026-10-03');
  });
  it('eachDate inclusive', () => {
    expect(eachDate('2025-12-30', '2026-01-02')).toEqual(['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02']);
    expect(eachDate('2026-01-01', '2026-01-01')).toEqual(['2026-01-01']);
    expect(eachDate('2026-01-02', '2026-01-01')).toEqual([]);
  });
});
