import { dayRolloverAt, logicalDate } from '../dayBoundary';

describe('dayBoundary DST (America/New_York)', () => {
  it('runs in a DST time zone', () => {
    expect(new Date(2026, 2, 8, 12).getTimezoneOffset()).not.toBe(new Date(2026, 0, 8, 12).getTimezoneOffset());
  });
  it('spring forward 2026-03-08', () => {
    expect(logicalDate(new Date(2026, 2, 8, 3, 30), 3)).toBe('2026-03-07');
    expect(logicalDate(new Date(2026, 2, 8, 6, 30), 3)).toBe('2026-03-08');
    expect(logicalDate(new Date(2026, 2, 8, 12, 0), 0)).toBe('2026-03-08');
  });
  it('fall back 2026-11-01: 01:30 happens twice', () => {
    const first = new Date(2026, 10, 1, 0, 30).getTime() + 3600_000; // 01:30 EDT
    const second = first + 3600_000; // 01:30 EST
    expect(logicalDate(new Date(first), 0)).toBe('2026-11-01');
    expect(logicalDate(new Date(second), 0)).toBe('2026-11-01');
    expect(logicalDate(new Date(second), 3)).toBe('2026-10-31');
  });
  it('rollover on DST days is wall-clock based', () => {
    expect(dayRolloverAt('2026-03-07', 0)).toEqual(new Date(2026, 2, 8, 0, 0));
    expect(dayRolloverAt('2026-03-08', 0)).toEqual(new Date(2026, 2, 9, 0, 0));
    expect(dayRolloverAt('2026-10-31', 0)).toEqual(new Date(2026, 10, 1, 0, 0));
  });
});
