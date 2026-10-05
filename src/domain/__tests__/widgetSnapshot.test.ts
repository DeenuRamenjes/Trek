import { buildWidgetSnapshot } from '../widgetSnapshot';
import { mkCtx, mkGoal, mkLog, mkVacation, mkVersion } from './fixtures';

const today = '2026-10-05';
const ctxOf = (id: string, o: Parameters<typeof mkGoal>[0] = {}) =>
  mkCtx({ goal: mkGoal({ id, name: `Goal ${id}`, startDate: '2026-01-01', ...o }), versions: [mkVersion({ id: `v-${id}`, goalId: id })] });

describe('buildWidgetSnapshot', () => {
  it('counts done/total and orders pending before done', () => {
    const ctxs = [ctxOf('a', { sortOrder: 0 }), ctxOf('b', { sortOrder: 1 })];
    const snap = buildWidgetSnapshot({ ctxs, logs: [mkLog({ goalId: 'a', date: today })], today, hideGoalNames: false });
    expect(snap).toEqual({
      date: today, done: 1, total: 2,
      items: [
        { goalId: 'b', name: 'Goal b', status: 'pending', progress: 0 },
        { goalId: 'a', name: 'Goal a', status: 'done', progress: 1 },
      ],
    });
  });
  it('partial progress for count goals', () => {
    const c = ctxOf('a', { trackingType: 'count', targetValue: 4 });
    const snap = buildWidgetSnapshot({ ctxs: [c], logs: [mkLog({ goalId: 'a', date: today, value: 1, status: 'partial' })], today, hideGoalNames: false });
    expect(snap.items[0]).toMatchObject({ status: 'partial', progress: 0.25 });
  });
  it('hides names', () => {
    const snap = buildWidgetSnapshot({ ctxs: [ctxOf('a')], logs: [], today, hideGoalNames: true });
    expect(snap.items[0].name).toBeNull();
  });
  it('caps items at 4 but counts all', () => {
    const ctxs = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => ctxOf(id, { sortOrder: i }));
    const snap = buildWidgetSnapshot({ ctxs, logs: [], today, hideGoalNames: false });
    expect(snap.items).toHaveLength(4);
    expect(snap.total).toBe(6);
  });
  it('filters by group and drops non-due, skipped and vacation goals', () => {
    const ctxs = [
      ctxOf('a'),
      ctxOf('b'),
      ctxOf('c', { startDate: '2026-12-01' }),
      ctxOf('d'),
      { ...ctxOf('e'), vacations: [mkVacation({ startDate: today, endDate: today, goalIds: [], scope: 'all' })] },
    ];
    const logs = [mkLog({ goalId: 'd', date: today, status: 'skipped', value: 0 })];
    const snap = buildWidgetSnapshot({ ctxs, logs, today, groupGoalIds: ['a', 'c', 'd', 'e'], hideGoalNames: false });
    expect(snap.items.map((i) => i.goalId)).toEqual(['a']);
    expect(snap.total).toBe(1);
  });
  it('empty day', () => {
    expect(buildWidgetSnapshot({ ctxs: [], logs: [], today, hideGoalNames: false })).toEqual({ date: today, done: 0, total: 0, items: [] });
  });
});
