import { buildTodayRows } from '../todayModel';
import type { Goal, GoalContext, Log, ScheduleVersion, Slot } from '../../../domain/types';

const TODAY = '2026-10-07'; // Wednesday
const goal = (id: string, over: Partial<Goal> = {}): Goal => ({
  id, name: id, icon: 'flag', color: '#000', trackingType: 'check', targetValue: 1, unit: null,
  startDate: '2026-01-01', endDate: null, targetDays: null, pausedAt: null, archivedAt: null, sortOrder: 0,
  createdAt: '', updatedAt: '', ...over,
});
const version = (goalId: string, over: Partial<ScheduleVersion> = {}): ScheduleVersion => ({
  id: `v-${goalId}`, goalId, effectiveFrom: '2026-01-01', scheduleType: 'daily', scheduleDays: 127,
  everyNDays: null, timesPerWeek: null, createdAt: '', ...over,
});
const ctx = (g: Goal, v: Partial<ScheduleVersion> = {}, slots?: Slot[]): GoalContext => ({
  goal: g, versions: [version(g.id, v)], pauses: [], vacations: [], dayEndsAt: 0, slots,
});
const log = (goalId: string, date: string, over: Partial<Log> = {}): Log => ({
  id: `${goalId}${date}${over.slotId ?? ''}`, goalId, date, slotId: null, value: 1, status: 'done', note: null,
  loggedAt: '', updatedAt: '', ...over,
});

describe('buildTodayRows', () => {
  it('splits pending and done, sorted by sortOrder', () => {
    const a = ctx(goal('a', { sortOrder: 2 }));
    const b = ctx(goal('b', { sortOrder: 1 }));
    const c = ctx(goal('c', { sortOrder: 0 }));
    const m = buildTodayRows([a, b, c], [log('b', TODAY)], TODAY, TODAY, 1);
    expect(m.pending.map((r) => r.goalId)).toEqual(['c', 'a']);
    expect(m.done.map((r) => r.goalId)).toEqual(['b']);
    expect(m.done[0].status).toBe('done');
  });

  it('skips goals not due and puts skipped in done', () => {
    const wk = ctx(goal('wk'), { scheduleType: 'weekends', scheduleDays: 96 });
    const sk = ctx(goal('sk'));
    const m = buildTodayRows([wk, sk], [log('sk', TODAY, { status: 'skipped', value: 0 })], TODAY, TODAY, 1);
    expect(m.pending).toEqual([]);
    expect(m.done.map((r) => r.goalId)).toEqual(['sk']);
  });

  it('count goal progress and partial stays pending', () => {
    const c = ctx(goal('w', { trackingType: 'count', targetValue: 8, unit: 'glasses' }));
    const m = buildTodayRows([c], [log('w', TODAY, { value: 3, status: 'partial' })], TODAY, TODAY, 1);
    expect(m.pending[0].status).toBe('partial');
    expect(m.pending[0].progressText).toEqual({ key: 'amount', params: { value: 3, target: 8, unit: 'glasses' } });
  });

  it('slot goal lists per-slot done', () => {
    const slots: Slot[] = [
      { id: 's1', scheduleVersionId: 'v-p', weekday: 2, time: '08:00', label: null },
      { id: 's2', scheduleVersionId: 'v-p', weekday: 2, time: '20:00', label: 'Night' },
    ];
    const c = ctx(goal('p'), {}, slots);
    const m = buildTodayRows([c], [log('p', TODAY, { slotId: 's1' })], TODAY, TODAY, 1);
    expect(m.pending[0].slots.map((s) => s.done)).toEqual([true, false]);
    expect(m.pending[0].progressText).toEqual({ key: 'slots', params: { done: 1, total: 2 } });
  });

  it('timesPerWeek shows weekProgress while quota unmet, hides once met', () => {
    const t = ctx(goal('t'), { scheduleType: 'timesPerWeek', timesPerWeek: 2 });
    let m = buildTodayRows([t], [log('t', '2026-10-05')], TODAY, TODAY, 1);
    expect(m.pending[0].weekProgress).toEqual({ done: 1, target: 2 });
    m = buildTodayRows([t], [log('t', '2026-10-05'), log('t', '2026-10-06')], TODAY, TODAY, 1);
    expect(m.pending).toEqual([]);
    expect(m.done).toEqual([]);
    m = buildTodayRows([t], [log('t', '2026-10-05'), log('t', TODAY)], TODAY, TODAY, 1);
    expect(m.done.map((r) => r.goalId)).toEqual(['t']);
    expect(m.done[0].weekProgress).toBeNull();
  });
});
