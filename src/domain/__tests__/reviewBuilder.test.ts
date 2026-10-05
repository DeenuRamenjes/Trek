import { strings } from '../../strings/en';
import { buildReview, formatInsight, periodBounds, previousPeriod, timeBucket } from '../reviewBuilder';
import type { Log } from '../types';
import { mkCtx, mkGoal, mkLog, mkVersion } from './fixtures';

describe('periods', () => {
  it('week bounds follow weekStart', () => {
    expect(periodBounds({ kind: 'week', anchor: '2026-01-07' }, 1)).toEqual({ from: '2026-01-05', to: '2026-01-11' });
    expect(periodBounds({ kind: 'week', anchor: '2026-01-07' }, 0)).toEqual({ from: '2026-01-04', to: '2026-01-10' });
  });
  it('month bounds incl. leap year', () => {
    expect(periodBounds({ kind: 'month', anchor: '2028-02-15' }, 1)).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
  it('previous period across month and year boundary', () => {
    expect(previousPeriod({ kind: 'month', anchor: '2026-01-20' }, 1)).toEqual({ kind: 'month', anchor: '2025-12-01' });
    expect(periodBounds(previousPeriod({ kind: 'month', anchor: '2026-01-20' }, 1), 1)).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    const p = previousPeriod({ kind: 'week', anchor: '2026-01-01' }, 1);
    expect(periodBounds(p, 1)).toEqual({ from: '2025-12-22', to: '2025-12-28' });
  });
});

describe('time bucket', () => {
  it('buckets by local hour', () => {
    const at = (h: number) => new Date(2026, 0, 5, h, 0).toISOString();
    expect([4, 5, 11, 12, 16, 17, 21, 22, 0].map((h) => timeBucket(at(h)))).toEqual([
      'night', 'morning', 'morning', 'afternoon', 'afternoon', 'evening', 'evening', 'night', 'night',
    ]);
  });
});

const weekdaysCtx = (name = 'Reading') =>
  mkCtx({ goal: mkGoal({ name, startDate: '2025-12-01' }), versions: [mkVersion({ effectiveFrom: '2025-12-01', scheduleType: 'weekdays', scheduleDays: 31 })] });
const days = (ds: string[]): Log[] => ds.map((date) => mkLog({ date }));

describe('buildReview', () => {
  // Weeks (Mon start): 12-29..01-04 prev, 01-05..01-11 cur.
  it('reproduces "Reading improved 20% vs last week"', () => {
    const ctx = weekdaysCtx();
    const logs = days(['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2025-12-29', '2025-12-30', '2025-12-31']);
    const r = buildReview({ period: { kind: 'week', anchor: '2026-01-07' }, weekStart: 1, today: '2026-01-12', ctxs: [ctx], logs });
    expect(r.overall.percent).toBeCloseTo(80);
    expect(r.previousOverall.percent).toBeCloseTo(60);
    expect(r.delta).toBeCloseTo(20);
    const goal = r.insights.find((i) => i.id === 'goalImproved')!;
    expect(formatInsight(goal, strings.insights)).toBe('Reading improved 20% vs last week');
    expect(r.bestGoal?.name).toBe('Reading');
    expect(r.worstGoal).toBeNull();
    expect(r.totals).toMatchObject({ done: 4, missed: 1 });
  });

  it('month review across year boundary (Jan vs Dec)', () => {
    const ctx = mkCtx({ goal: mkGoal({ startDate: '2025-12-01' }), versions: [mkVersion({ effectiveFrom: '2025-12-01' })] });
    const dec = Array.from({ length: 31 }, (_, i) => `2025-12-${String(i + 1).padStart(2, '0')}`);
    const logs = days(dec.slice(0, 15));
    const r = buildReview({ period: { kind: 'month', anchor: '2026-01-10' }, weekStart: 1, today: '2026-02-05', ctxs: [ctx], logs });
    expect([r.from, r.to, r.previousFrom, r.previousTo]).toEqual(['2026-01-01', '2026-01-31', '2025-12-01', '2025-12-31']);
    expect(r.overall.percent).toBe(0);
    expect(r.previousOverall.percent).toBeCloseTo((15 / 31) * 100);
    expect(r.delta).toBeCloseTo(-(15 / 31) * 100);
    expect(r.insights[0].id).toBe('goalDeclined');
  });

  it('streaks gained and lost, best and worst goal', () => {
    const a = mkCtx({ goal: mkGoal({ id: 'a', name: 'A', startDate: '2026-01-01' }), versions: [mkVersion({ id: 'va', goalId: 'a', effectiveFrom: '2026-01-01' })] });
    const b = mkCtx({ goal: mkGoal({ id: 'b', name: 'B', startDate: '2026-01-01' }), versions: [mkVersion({ id: 'vb', goalId: 'b', effectiveFrom: '2026-01-01' })] });
    const logs = [
      ...['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10', '2026-01-11'].map((date) => mkLog({ date, goalId: 'a' })),
      ...['2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'].map((date) => mkLog({ date, goalId: 'b' })),
    ];
    const r = buildReview({ period: { kind: 'week', anchor: '2026-01-08' }, weekStart: 1, today: '2026-01-14', ctxs: [a, b], logs });
    expect(r.bestGoal?.name).toBe('A');
    expect(r.worstGoal?.name).toBe('B');
    expect(r.streaksGained.map((s) => [s.name, s.before, s.after])).toEqual([['A', 0, 7]]);
    expect(r.streaksLost.map((s) => [s.name, s.before, s.after])).toEqual([['B', 4, 0]]);
  });

  it('best time slot uses slot label else bucket', () => {
    const ctx = { ...mkCtx(), slots: [{ id: 's1', scheduleVersionId: 'v1', weekday: 0, time: '08:00', label: 'Morning pages' }] } as ReturnType<typeof mkCtx>;
    const at = (h: number) => new Date(2026, 0, 5, h, 0).toISOString();
    const logs = [
      mkLog({ date: '2026-01-05', slotId: 's1', loggedAt: at(8) }),
      mkLog({ date: '2026-01-06', slotId: 's1', loggedAt: at(8) }),
      mkLog({ date: '2026-01-07', loggedAt: at(19) }),
    ];
    const r = buildReview({ period: { kind: 'week', anchor: '2026-01-07' }, weekStart: 1, today: '2026-01-14', ctxs: [ctx], logs });
    expect(r.bestTimeSlot).toEqual({ kind: 'slot', label: 'Morning pages', count: 2 });
    const r2 = buildReview({ period: { kind: 'week', anchor: '2026-01-07' }, weekStart: 1, today: '2026-01-14', ctxs: [mkCtx()], logs: [logs[2]] });
    expect(r2.bestTimeSlot).toEqual({ kind: 'bucket', bucket: 'evening', count: 1 });
  });

  it('insights are ranked by magnitude, deterministic, max 3, and string-free', () => {
    const ctx = weekdaysCtx();
    const logs = days(['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2025-12-29', '2025-12-30', '2025-12-31']);
    const args = { period: { kind: 'week' as const, anchor: '2026-01-07' }, weekStart: 1, today: '2026-01-12', ctxs: [ctx], logs };
    const a = buildReview(args).insights;
    expect(buildReview({ ...args, logs: [...logs].reverse() }).insights).toEqual(a);
    expect(a.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < a.length; i++) expect(a[i - 1].magnitude).toBeGreaterThanOrEqual(a[i].magnitude);
    expect(a.every((i) => typeof i.id === 'string' && !('text' in i))).toBe(true);
  });

  it('perfect period insight', () => {
    const ctx = mkCtx({ goal: mkGoal({ startDate: '2026-01-05' }) });
    const logs = days(['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10', '2026-01-11']);
    const r = buildReview({ period: { kind: 'week', anchor: '2026-01-05' }, weekStart: 1, today: '2026-01-14', ctxs: [ctx], logs });
    expect(r.insights.map((i) => i.id)).toContain('perfectPeriod');
    expect(formatInsight(r.insights.find((i) => i.id === 'perfectPeriod')!, strings.insights)).toBe('A perfect week: every due day done');
  });

  it('most skipped weekday insight', () => {
    const ctx = mkCtx({ goal: mkGoal({ startDate: '2026-01-05' }) });
    const logs = [mkLog({ date: '2026-01-05', status: 'skipped' }), mkLog({ date: '2026-01-12', status: 'skipped' })];
    const r = buildReview({ period: { kind: 'month', anchor: '2026-01-10' }, weekStart: 1, today: '2026-02-01', ctxs: [ctx], logs });
    const i = r.insights.find((x) => x.id === 'mostSkippedWeekday')!;
    expect(formatInsight(i, strings.insights)).toBe('You skip most on Monday');
  });
});
