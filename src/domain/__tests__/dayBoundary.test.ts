import { dayRolloverAt, logicalDate, logicalToday } from '../dayBoundary';

const at = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi);

describe('dayBoundary', () => {
  it('dayEndsAt 0 is the calendar date', () => {
    expect(logicalDate(at(2026, 10, 5, 0, 0), 0)).toBe('2026-10-05');
    expect(logicalDate(at(2026, 10, 5, 23, 59), 0)).toBe('2026-10-05');
  });
  it('01:30 with 3 is previous day', () => {
    expect(logicalDate(at(2026, 10, 5, 1, 30), 3)).toBe('2026-10-04');
  });
  it('03:00 with 3 is same day', () => {
    expect(logicalDate(at(2026, 10, 5, 3, 0), 3)).toBe('2026-10-05');
    expect(logicalDate(at(2026, 10, 5, 2, 59), 3)).toBe('2026-10-04');
  });
  it('month and year boundaries', () => {
    expect(logicalDate(at(2026, 3, 1, 2, 0), 3)).toBe('2026-02-28');
    expect(logicalDate(at(2026, 1, 1, 2, 0), 3)).toBe('2025-12-31');
    expect(logicalDate(at(2024, 3, 1, 2, 0), 3)).toBe('2024-02-29');
  });
  it('logicalToday matches logicalDate', () => {
    expect(logicalToday(at(2026, 1, 1, 2, 0), 3)).toBe('2025-12-31');
  });
  it('dayRolloverAt', () => {
    expect(dayRolloverAt('2026-10-05', 0)).toEqual(at(2026, 10, 6, 0));
    expect(dayRolloverAt('2026-10-05', 3)).toEqual(at(2026, 10, 6, 3));
    expect(dayRolloverAt('2026-12-31', 3)).toEqual(at(2027, 1, 1, 3));
  });
});
