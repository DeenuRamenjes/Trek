import { bestStreak, currentStreak, milestoneReached } from '../streaks';
import type { Log } from '../types';
import { mkCtx, mkGoal, mkVacation, mkVersion, T } from './fixtures';

const lg = (date: string, status: Log['status'] = 'done'): Log =>
  ({ id: date + status, goalId: 'g1', date, slotId: null, value: 1, status, note: null, loggedAt: T, updatedAt: T }) as Log;
const days = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `2026-01-${String(from + i).padStart(2, '0')}`);
const done = (from: number, to: number) => days(from, to).map((d) => lg(d));
const WS = 1;

describe('daily streaks', () => {
  const ctx = mkCtx();
  it('counts consecutive done days', () => {
    expect(currentStreak(ctx, done(1, 5), '2026-01-05', WS)).toBe(5);
    expect(bestStreak(ctx, done(1, 5), '2026-01-05', WS)).toBe(5);
  });
  it('today pending keeps the streak', () => {
    expect(currentStreak(ctx, done(1, 4), '2026-01-05', WS)).toBe(4);
  });
  it('partial today does not break', () => {
    expect(currentStreak(ctx, [...done(1, 4), lg('2026-01-05', 'partial')], '2026-01-05', WS)).toBe(4);
  });
  it('missed day breaks, best remembers', () => {
    const logs = [...done(1, 4), ...done(6, 7)];
    expect(currentStreak(ctx, logs, '2026-01-07', WS)).toBe(2);
    expect(bestStreak(ctx, logs, '2026-01-07', WS)).toBe(4);
  });
  it('partial past day breaks', () => {
    const logs = [...done(1, 2), lg('2026-01-03', 'partial'), ...done(4, 5)];
    expect(currentStreak(ctx, logs, '2026-01-05', WS)).toBe(2);
  });
  it('skipped and vacation days are neutral', () => {
    const logs = [...done(1, 2), lg('2026-01-03', 'skipped'), lg('2026-01-04'), lg('2026-01-07')];
    const c = mkCtx({ vacations: [mkVacation({ startDate: '2026-01-05', endDate: '2026-01-06' })] });
    expect(currentStreak(c, logs, '2026-01-07', WS)).toBe(4);
  });
  it('not-due days are neutral', () => {
    const c = mkCtx({ versions: [mkVersion({ scheduleType: 'weekdays' })] });
    // Jan 2 Fri, Jan 3-4 weekend, Jan 5 Mon
    expect(currentStreak(c, [lg('2026-01-02'), lg('2026-01-05')], '2026-01-05', WS)).toBe(2);
  });
  it('no logs and empty history is 0', () => {
    expect(currentStreak(ctx, [], '2026-01-05', WS)).toBe(0);
    expect(bestStreak(mkCtx({ goal: mkGoal({ startDate: '2026-02-01' }) }), [], '2026-01-05', WS)).toBe(0);
  });
  it('ignores other goals logs', () => {
    expect(currentStreak(ctx, [{ ...lg('2026-01-05'), goalId: 'x' }], '2026-01-05', WS)).toBe(0);
  });
  it('version change keeps past scoring', () => {
    // weekdays until Jan 11, then daily: Jan 3-4 (weekend) neutral in the past.
    const c = mkCtx({
      versions: [
        mkVersion({ id: 'v1', scheduleType: 'weekdays' }),
        mkVersion({ id: 'v2', effectiveFrom: '2026-01-08', scheduleType: 'weekends' }),
      ],
    });
    const logs = [lg('2026-01-05'), lg('2026-01-06'), lg('2026-01-07'), lg('2026-01-10'), lg('2026-01-11')];
    expect(currentStreak(c, logs, '2026-01-11', WS)).toBe(5);
    // Jan 8-9 are not due under weekends: neutral, not missed
    expect(bestStreak(c, logs, '2026-01-11', WS)).toBe(5);
  });
});

describe('timesPerWeek streaks', () => {
  const ctx = mkCtx({ versions: [mkVersion({ scheduleType: 'timesPerWeek', timesPerWeek: 2 })] });
  it('counts consecutive weeks meeting the target; current week pending', () => {
    // Mon-start weeks: Jan 5-11, 12-18, 19-25 (current)
    const logs = [lg('2026-01-05'), lg('2026-01-07'), lg('2026-01-12'), lg('2026-01-14'), lg('2026-01-19')];
    expect(currentStreak(ctx, logs, '2026-01-21', WS)).toBe(2);
    expect(bestStreak(ctx, logs, '2026-01-21', WS)).toBe(2);
  });
  it('missed week breaks', () => {
    const logs = [lg('2026-01-05'), lg('2026-01-07'), lg('2026-01-12'), lg('2026-01-19'), lg('2026-01-20')];
    expect(currentStreak(ctx, logs, '2026-01-26', WS)).toBe(1);
    expect(bestStreak(ctx, logs, '2026-01-26', WS)).toBe(1);
  });
  it('neutral weeks are skipped over', () => {
    const c = mkCtx({
      versions: [mkVersion({ scheduleType: 'timesPerWeek', timesPerWeek: 2 })],
      vacations: [mkVacation({ startDate: '2026-01-12', endDate: '2026-01-18' })],
    });
    const logs = [lg('2026-01-05'), lg('2026-01-06'), lg('2026-01-19'), lg('2026-01-20')];
    expect(currentStreak(c, logs, '2026-01-27', WS)).toBe(2);
  });
  it('vacation reduces target so the week still counts', () => {
    const c = mkCtx({
      versions: [mkVersion({ scheduleType: 'timesPerWeek', timesPerWeek: 4 })],
      vacations: [mkVacation({ startDate: '2026-01-08', endDate: '2026-01-11' })],
    });
    // 3 eligible-nonvacation of 7 -> ceil(4*3/7)=2
    expect(currentStreak(c, [lg('2026-01-05'), lg('2026-01-06')], '2026-01-14', WS)).toBe(1);
  });
  it('type change between versions counts each segment by its rule', () => {
    const c = mkCtx({
      versions: [
        mkVersion({ id: 'v1', scheduleType: 'daily' }),
        mkVersion({ id: 'v2', effectiveFrom: '2026-01-12', scheduleType: 'timesPerWeek', timesPerWeek: 2 }),
      ],
    });
    const logs = [...done(5, 11), lg('2026-01-13'), lg('2026-01-15')];
    expect(currentStreak(c, logs, '2026-01-20', WS)).toBe(8);
    const broken = [...done(5, 8), lg('2026-01-13'), lg('2026-01-15')];
    expect(currentStreak(c, broken, '2026-01-20', WS)).toBe(1);
    expect(bestStreak(c, broken, '2026-01-20', WS)).toBe(4);
  });
  it('weekStart changes week grouping', () => {
    // Sun-start weeks: Jan 4-10, 11-17. Logs Jan 10 (Sat), Jan 11 (Sun)... only 1 each week with Mon-start grouping fails
    const logs = [lg('2026-01-10'), lg('2026-01-11')];
    expect(bestStreak(ctx, logs, '2026-01-25', 1)).toBe(1); // Mon weeks: Sat+Sun share a week
    expect(bestStreak(ctx, logs, '2026-01-25', 0)).toBe(0);
  });
});

describe('milestoneReached', () => {
  it('fires on exactly 7, 30, 100 when rising', () => {
    expect(milestoneReached(6, 7)).toBe(7);
    expect(milestoneReached(29, 30)).toBe(30);
    expect(milestoneReached(99, 100)).toBe(100);
  });
  it('null otherwise', () => {
    expect(milestoneReached(7, 7)).toBeNull();
    expect(milestoneReached(7, 6)).toBeNull();
    expect(milestoneReached(0, 1)).toBeNull();
    expect(milestoneReached(7, 8)).toBeNull();
  });
});
