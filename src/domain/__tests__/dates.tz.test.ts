import { addDaysTo, diffDays, eachDate, weekStartOf } from '../dates';
import { dayRolloverAt, logicalDate } from '../dayBoundary';

describe('DST (America/New_York)', () => {
  it('runs in a DST time zone', () => {
    expect(new Date(2026, 2, 8, 12).getTimezoneOffset()).not.toBe(new Date(2026, 0, 8, 12).getTimezoneOffset());
  });

  it('addDaysTo crosses spring-forward and fall-back', () => {
    expect(addDaysTo('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDaysTo('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDaysTo('2026-03-07', 2)).toBe('2026-03-09');
    expect(addDaysTo('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDaysTo('2026-11-01', 1)).toBe('2026-11-02');
    expect(addDaysTo('2026-11-02', -2)).toBe('2026-10-31');
  });

  it('diffDays counts whole calendar days across DST', () => {
    expect(diffDays('2026-03-09', '2026-03-07')).toBe(2);
    expect(diffDays('2026-11-02', '2026-10-31')).toBe(2);
    expect(diffDays('2026-03-07', '2026-03-09')).toBe(-2);
    expect(diffDays('2026-12-31', '2026-01-01')).toBe(364);
  });

  it('eachDate has no duplicates or gaps across DST', () => {
    expect(eachDate('2026-03-07', '2026-03-10')).toEqual(['2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10']);
    expect(eachDate('2026-10-30', '2026-11-03')).toEqual([
      '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03',
    ]);
  });

  it('weekStartOf across DST', () => {
    expect(weekStartOf('2026-03-08', 0)).toBe('2026-03-08');
    expect(weekStartOf('2026-03-09', 0)).toBe('2026-03-08');
    expect(weekStartOf('2026-03-08', 1)).toBe('2026-03-02');
    expect(weekStartOf('2026-11-01', 0)).toBe('2026-11-01');
    expect(weekStartOf('2026-11-03', 1)).toBe('2026-11-02');
    expect(weekStartOf('2026-11-01', 1)).toBe('2026-10-26');
  });

  it.each(['2026-03-07', '2026-03-08', '2026-03-09', '2026-10-31', '2026-11-01', '2026-11-02'])(
    'dayRolloverAt invariant with dayEndsAt 3 on %s',
    (date) => {
      const r = dayRolloverAt(date, 3);
      expect(logicalDate(new Date(r.getTime() - 1), 3)).toBe(date);
      expect(logicalDate(r, 3)).toBe(addDaysTo(date, 1));
    },
  );
});
