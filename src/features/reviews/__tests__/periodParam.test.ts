import { strings } from '../../../strings/en';
import { canGoNext, formatPeriodParam, nextPeriod, parsePeriodParam, periodLabel } from '../periodParam';

describe('parsePeriodParam', () => {
  it('parses week and month params', () => {
    expect(parsePeriodParam('week-2026-01-07')).toEqual({ kind: 'week', anchor: '2026-01-07' });
    expect(parsePeriodParam('month-2026-10')).toEqual({ kind: 'month', anchor: '2026-10-01' });
  });
  it('rejects invalid params', () => {
    for (const bad of [undefined, '', 'week', 'week-2026-13-01', 'week-2026-02-30', 'month-2026-13', 'month-2026-1', 'year-2026', 'week-2026-01', 'month-2026-10-05']) {
      expect(parsePeriodParam(bad)).toBeNull();
    }
  });
});

describe('formatPeriodParam', () => {
  it('week uses the first day of the week', () => {
    expect(formatPeriodParam({ kind: 'week', anchor: '2026-01-07' }, 1)).toBe('week-2026-01-05');
    expect(formatPeriodParam({ kind: 'week', anchor: '2026-01-07' }, 0)).toBe('week-2026-01-04');
  });
  it('month uses year and month', () => {
    expect(formatPeriodParam({ kind: 'month', anchor: '2026-10-17' }, 1)).toBe('month-2026-10');
  });
  it('round trips', () => {
    const p = parsePeriodParam('week-2025-12-29')!;
    expect(parsePeriodParam(formatPeriodParam(p, 1))).toEqual(p);
  });
});

describe('periodLabel', () => {
  it('week label across the year boundary (week of Dec 29 2025 is ISO week 1)', () => {
    expect(periodLabel({ kind: 'week', anchor: '2025-12-31' }, 1)).toBe(strings.review.weekTitle(1));
    expect(periodLabel({ kind: 'week', anchor: '2025-12-31' }, 1)).toBe('Week 1');
  });
  it('week 40 and month label', () => {
    expect(periodLabel({ kind: 'week', anchor: '2026-10-05' }, 1)).toBe('Week 41');
    expect(periodLabel({ kind: 'week', anchor: '2026-09-30' }, 1)).toBe('Week 40');
    expect(periodLabel({ kind: 'month', anchor: '2026-10-01' }, 1)).toBe('October 2026');
  });
  it('sunday-start week is labelled by its Monday', () => {
    expect(periodLabel({ kind: 'week', anchor: '2025-12-28' }, 0)).toBe('Week 1');
  });
});

describe('next period', () => {
  it('moves by week and by month across the year', () => {
    expect(nextPeriod({ kind: 'week', anchor: '2025-12-29' }, 1)).toEqual({ kind: 'week', anchor: '2026-01-05' });
    expect(nextPeriod({ kind: 'month', anchor: '2025-12-01' }, 1)).toEqual({ kind: 'month', anchor: '2026-01-01' });
  });
  it('canGoNext is false when next starts after today', () => {
    expect(canGoNext({ kind: 'week', anchor: '2026-10-05' }, 1, '2026-10-07')).toBe(false);
    expect(canGoNext({ kind: 'week', anchor: '2026-09-28' }, 1, '2026-10-07')).toBe(true);
    expect(canGoNext({ kind: 'week', anchor: '2026-09-28' }, 1, '2026-10-04')).toBe(false);
    expect(canGoNext({ kind: 'month', anchor: '2026-09-01' }, 1, '2026-10-01')).toBe(true);
    expect(canGoNext({ kind: 'month', anchor: '2026-10-01' }, 1, '2026-10-31')).toBe(false);
  });
});
