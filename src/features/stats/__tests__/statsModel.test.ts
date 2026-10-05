import { mkCtx, mkGoal, mkLog, mkVersion } from '../../../domain/__tests__/fixtures';
import { seedDemoData } from '../../../db/seed';
import type { TrekDb } from '../../../db/client';
import { listLogs } from '../../../db/repositories';
import { createTestDb } from '../../../test/testDb';
import { loadGoalContexts } from '../../goals/goalContexts';
import { buildStatsModel } from '../statsModel';

// 2026-01-05 is a Monday.
const base = { range: '7D' as const, mode: 'weighted' as const, weekStart: 1 };

describe('buildStatsModel fixtures', () => {
  const a = mkCtx({ goal: mkGoal({ id: 'a', name: 'A', trackingType: 'count', targetValue: 10 }), versions: [mkVersion({ id: 'va', goalId: 'a' })] });
  const b = mkCtx({ goal: mkGoal({ id: 'b', name: 'B' }), versions: [mkVersion({ id: 'vb', goalId: 'b' })] });
  const logs = [
    mkLog({ date: '2026-01-05', goalId: 'a', value: 10 }),
    mkLog({ date: '2026-01-06', goalId: 'a', value: 5 }),
    mkLog({ date: '2026-01-05', goalId: 'b' }),
    mkLog({ date: '2026-01-06', goalId: 'b' }),
    mkLog({ date: '2026-01-07', goalId: 'b' }),
  ];
  const input = { ...base, contexts: [a, b], logs, goalIds: null, today: '2026-01-09' };

  it('computes values for the whole set', () => {
    const m = buildStatsModel(input);
    expect(m.range).toEqual({ from: '2026-01-03', to: '2026-01-09' });
    expect(m.heatmap).toHaveLength(7);
    expect(m.heatmap.find((h) => h.date === '2026-01-05')?.ratio).toBe(1);
    expect(m.perGoal.map((g) => g.name)).toEqual(['A', 'B']);
    expect(m.perGoal[1].color).toBe('#2E7D5B');
    expect(m.trend).toHaveLength(7);
    expect(m.completion.done).toBeGreaterThan(0);
    expect(m.bestStreak).toBeGreaterThanOrEqual(3);
    expect(m.bestWeekday).not.toBeNull();
  });

  it('respects the group filter', () => {
    const m = buildStatsModel({ ...input, goalIds: ['b'] });
    expect(m.perGoal.map((g) => g.goalId)).toEqual(['b']);
    expect(m.bestStreak).toBe(3);
  });

  it('empty selection yields zeros', () => {
    const m = buildStatsModel({ ...input, goalIds: [] });
    expect(m.completion).toMatchObject({ percent: 0, done: 0 });
    expect(m.perGoal).toEqual([]);
    expect(m.bestWeekday).toBeNull();
    expect(m.currentStreak).toBe(0);
    expect(m.currentStreakUnit).toBe('days');
    expect(m.trend.every((p) => p.percent === null)).toBe(true);
  });

  it('weekly goal holding the max streak is labeled weeks', () => {
    const w = mkCtx({
      goal: mkGoal({ id: 'w', name: 'W' }),
      versions: [mkVersion({ id: 'vw', goalId: 'w', scheduleType: 'timesPerWeek', timesPerWeek: 1, scheduleDays: 127 })],
    });
    const m = buildStatsModel({ ...input, contexts: [w], goalIds: null, today: '2026-01-20', logs: [mkLog({ date: '2026-01-05', goalId: 'w' }), mkLog({ date: '2026-01-12', goalId: 'w' })] });
    expect(m.bestStreakUnit).toBe('weeks');
  });

  it('weighted and strict differ when partials exist', () => {
    const w = buildStatsModel({ ...input, goalIds: ['a'], mode: 'weighted' });
    const s = buildStatsModel({ ...input, goalIds: ['a'], mode: 'strict' });
    expect(w.completion.percent).toBeGreaterThan(s.completion.percent);
  });
});

describe('buildStatsModel on the 3-year seed', () => {
  it('has the documented shape', async () => {
    const db = createTestDb().db as unknown as TrekDb;
    const today = '2026-10-05';
    await seedDemoData(db, { today });
    const contexts = await loadGoalContexts(db);
    const logs = await listLogs(db);
    const m = buildStatsModel({ ...base, range: 'All', contexts, logs, goalIds: null, today });
    expect(m.heatmap.length).toBeGreaterThan(900);
    expect(m.perGoal).toHaveLength(contexts.length);
    expect(m.completion.percent).toBeGreaterThan(0);
    expect(m.completion.percent).toBeLessThanOrEqual(100);
    expect(m.weekly.length).toBeGreaterThan(100);
    expect(m.trend).toHaveLength(m.heatmap.length);
    expect(m.bestStreak).toBeGreaterThanOrEqual(m.currentStreak);
  });
});
