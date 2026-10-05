import { bestWeekday, completion, dailySeries, perGoal, rangeBounds, weeklyBars } from '../statsCalculator';
import { mkCtx, mkGoal, mkLog, mkVacation, mkVersion } from './fixtures';

// 2026-01-05 is a Monday.
describe('rangeBounds', () => {
  it('computes inclusive ranges ending today', () => {
    expect(rangeBounds('7D', '2026-03-10', '2025-01-01')).toEqual({ from: '2026-03-04', to: '2026-03-10' });
    expect(rangeBounds('30D', '2026-03-10', '2025-01-01')).toEqual({ from: '2026-02-09', to: '2026-03-10' });
    expect(rangeBounds('90D', '2026-03-10', '2025-01-01')).toEqual({ from: '2025-12-11', to: '2026-03-10' });
    expect(rangeBounds('1Y', '2026-03-10', '2025-01-01')).toEqual({ from: '2025-03-11', to: '2026-03-10' });
    expect(rangeBounds('All', '2026-03-10', '2025-06-01')).toEqual({ from: '2025-06-01', to: '2026-03-10' });
  });
  it('All never starts after today', () => {
    expect(rangeBounds('All', '2026-03-10', '2026-04-01').from).toBe('2026-03-10');
  });
});

describe('completion', () => {
  const ctx = mkCtx({ goal: mkGoal({ trackingType: 'count', targetValue: 10 }) });
  const logs = [
    mkLog({ date: '2026-01-05', value: 10 }),
    mkLog({ date: '2026-01-06', value: 5 }),
    mkLog({ date: '2026-01-07', value: 0, status: 'skipped' }),
  ];
  // 05 done, 06 partial 0.5, 07 skipped, 08 missed; today 09 pending.
  it('weighted counts partial as value/target', () => {
    const c = completion([ctx], logs, '2026-01-05', '2026-01-09', '2026-01-09', 'weighted');
    expect(c).toMatchObject({ credit: 1.5, denominator: 3, done: 1, partial: 1, skipped: 1, missed: 1, vacation: 0 });
    expect(c.percent).toBeCloseTo(50);
  });
  it('strict counts partial as 0', () => {
    const c = completion([ctx], logs, '2026-01-05', '2026-01-09', '2026-01-09', 'strict');
    expect(c.credit).toBe(1);
    expect(c.percent).toBeCloseTo(33.33, 1);
  });
  it('excludes vacation days and pending today from the denominator', () => {
    const v = mkCtx({ vacations: [mkVacation({ startDate: '2026-01-08', endDate: '2026-01-08' })] });
    const c = completion([v], [mkLog({ date: '2026-01-05' })], '2026-01-05', '2026-01-09', '2026-01-09', 'weighted');
    expect(c).toMatchObject({ vacation: 1, denominator: 3, done: 1, missed: 2 });
  });
  it('zero denominator gives 0 percent', () => {
    expect(completion([ctx], [], '2026-01-09', '2026-01-09', '2026-01-09', 'weighted')).toMatchObject({ denominator: 0, percent: 0 });
  });
  it('past stats unchanged after a new schedule version starting today', () => {
    const before = completion([ctx], logs, '2026-01-05', '2026-01-08', '2026-01-09', 'weighted');
    const edited = mkCtx({
      goal: ctx.goal,
      versions: [mkVersion(), mkVersion({ id: 'v2', effectiveFrom: '2026-01-09', scheduleType: 'weekdays', scheduleDays: 0b0000011, createdAt: '2026-01-09T00:00:00.000Z' })],
    });
    expect(completion([edited], logs, '2026-01-05', '2026-01-08', '2026-01-09', 'weighted')).toEqual(before);
  });
});

describe('timesPerWeek', () => {
  const ctx = mkCtx({
    goal: mkGoal({ startDate: '2026-01-05' }),
    versions: [mkVersion({ effectiveFrom: '2026-01-05', scheduleType: 'timesPerWeek', timesPerWeek: 3 })],
  });
  const logs = [
    mkLog({ date: '2026-01-05' }), mkLog({ date: '2026-01-06' }), mkLog({ date: '2026-01-07' }), // week 1 full
    mkLog({ date: '2026-01-12' }), // week 2 1 of 3
  ];
  it('contributes one unit per ended week', () => {
    const w = completion([ctx], logs, '2026-01-05', '2026-01-25', '2026-01-26', 'weighted', 1);
    // week1 full, week2 1/3, week3 0
    expect(w).toMatchObject({ denominator: 3, done: 1, partial: 1, missed: 1 });
    expect(w.credit).toBeCloseTo(1 + 1 / 3);
    expect(completion([ctx], logs, '2026-01-05', '2026-01-25', '2026-01-26', 'strict', 1).credit).toBe(1);
  });
  it('excludes the current week', () => {
    const c = completion([ctx], logs, '2026-01-05', '2026-01-18', '2026-01-14', 'weighted', 1);
    expect(c.denominator).toBe(1);
  });
});

describe('series and breakdowns', () => {
  const a = mkCtx({ goal: mkGoal({ id: 'g1' }) });
  const b = mkCtx({ goal: mkGoal({ id: 'g2' }), versions: [mkVersion({ id: 'v2', goalId: 'g2' })] });
  const logs = [mkLog({ date: '2026-01-05' }), mkLog({ date: '2026-01-06', goalId: 'g2' }), mkLog({ date: '2026-01-12' })];
  it('dailySeries has one point per date', () => {
    const s = dailySeries([a], logs, '2026-01-05', '2026-01-07', '2026-01-10', 'weighted');
    expect(s.map((p) => p.percent)).toEqual([100, 0, 0]);
  });
  it('weeklyBars groups by week start', () => {
    const bars = weeklyBars([a], logs, '2026-01-05', '2026-01-18', '2026-01-19', 'weighted', 1);
    expect(bars.map((x) => x.weekStart)).toEqual(['2026-01-05', '2026-01-12']);
    expect(bars[0].percent).toBeCloseTo(100 / 7);
  });
  it('perGoal keeps order', () => {
    const r = perGoal([a, b], logs, '2026-01-05', '2026-01-06', '2026-01-10', 'weighted');
    expect(r.map((x) => [x.goalId, x.percent])).toEqual([['g1', 50], ['g2', 50]]);
  });
  it('bestWeekday picks highest, earliest on ties; null without data', () => {
    const r = bestWeekday([a], [mkLog({ date: '2026-01-06' })], '2026-01-05', '2026-01-07', '2026-01-10', 'weighted');
    expect(r.best).toBe(1);
    expect(bestWeekday([a], [], '2026-01-10', '2026-01-10', '2026-01-10', 'weighted').best).toBeNull();
  });
});
