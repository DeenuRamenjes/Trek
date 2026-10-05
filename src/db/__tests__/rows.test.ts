import * as r from '../rows';

const id = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const TS = '2026-10-05T08:00:00.000Z';
const D = '2026-10-05';

const goal = { id: id(1), name: 'Read', icon: 'flag', color: '#2E7D5B', trackingType: 'check', targetValue: 1, unit: null, startDate: D, endDate: null, targetDays: null, pausedAt: null, archivedAt: null, sortOrder: 0, createdAt: TS, updatedAt: TS };
const version = { id: id(2), goalId: id(1), effectiveFrom: D, scheduleType: 'daily', scheduleDays: 127, everyNDays: null, timesPerWeek: null, createdAt: TS };
const slot = { id: id(3), scheduleVersionId: id(2), weekday: 1, time: '08:00', label: null };
const reminder = { id: id(4), goalId: id(1), slotId: null, weekday: 1, time: '08:00', offsetMin: 0, enabled: true };
const group = { id: id(5), name: 'Morning', color: '#2E7D5B', icon: 'sun', sortOrder: 0, createdAt: TS, updatedAt: TS };
const groupGoal = { groupId: id(5), goalId: id(1) };
const pause = { id: id(6), goalId: id(1), startDate: D, endDate: null, createdAt: TS, updatedAt: TS };
const log = { id: id(7), goalId: id(1), date: D, slotId: null, value: 1, status: 'done', note: 'ok', loggedAt: TS, updatedAt: TS };
const vacation = { id: id(8), startDate: D, endDate: '2026-10-07', scope: 'all', note: null, createdAt: TS, updatedAt: TS };
const vacationGoal = { vacationId: id(8), goalId: id(1) };
const pending = { id: 'widget:goal:2026-10-05:done', source: 'widget', goalId: id(1), date: D, slotId: null, action: 'done', value: null, createdAt: TS, processedAt: null };

describe('row schemas accept valid fixtures', () => {
  it.each([
    ['goalRow', r.goalRow, goal],
    ['scheduleVersionRow', r.scheduleVersionRow, version],
    ['slotRow', r.slotRow, slot],
    ['reminderRow', r.reminderRow, reminder],
    ['groupRow', r.groupRow, group],
    ['groupGoalRow', r.groupGoalRow, groupGoal],
    ['goalPauseRow', r.goalPauseRow, pause],
    ['logRow', r.logRow, log],
    ['vacationRow', r.vacationRow, vacation],
    ['vacationGoalRow', r.vacationGoalRow, vacationGoal],
    ['pendingActionRow', r.pendingActionRow, pending],
  ])('%s', (_n, schema, fixture) => {
    expect(schema.safeParse(fixture).success).toBe(true);
  });
});

describe('row schemas reject invalid input', () => {
  const bad = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
    expect(schema.safeParse(v).success).toBe(false);

  it('non-uuid id', () => bad(r.goalRow, { ...goal, id: 'abc' }));
  it('impossible calendar date', () => bad(r.logRow, { ...log, date: '2026-02-30' }));
  it('malformed date', () => bad(r.logRow, { ...log, date: '2026-2-3' }));
  it('time 24:00', () => bad(r.slotRow, { ...slot, time: '24:00' }));
  it('note over 1000 chars', () => bad(r.logRow, { ...log, note: 'x'.repeat(1001) }));
  it('status missed', () => bad(r.logRow, { ...log, status: 'missed' }));
  it('goal endDate before startDate', () => bad(r.goalRow, { ...goal, endDate: '2026-10-04' }));
  it('pause endDate before startDate', () => bad(r.goalPauseRow, { ...pause, endDate: '2026-10-04' }));
  it('vacation endDate before startDate', () => bad(r.vacationRow, { ...vacation, endDate: '2026-10-04' }));
  it('everyNDays schedule without value', () => bad(r.scheduleVersionRow, { ...version, scheduleType: 'everyNDays' }));
  it('everyNDays below 2', () => bad(r.scheduleVersionRow, { ...version, scheduleType: 'everyNDays', everyNDays: 1 }));
  it('timesPerWeek schedule without value', () => bad(r.scheduleVersionRow, { ...version, scheduleType: 'timesPerWeek' }));
  it('timesPerWeek 8', () => bad(r.scheduleVersionRow, { ...version, scheduleType: 'timesPerWeek', timesPerWeek: 8 }));
  it('scheduleDays 128', () => bad(r.scheduleVersionRow, { ...version, scheduleDays: 128 }));
  it('weekday 7', () => bad(r.slotRow, { ...slot, weekday: 7 }));
  it('color red', () => bad(r.goalRow, { ...goal, color: 'red' }));
  it('blank name', () => bad(r.goalRow, { ...goal, name: '   ' }));
  it('name over 100 chars', () => bad(r.groupRow, { ...group, name: 'x'.repeat(101) }));
  it('non-ISO timestamp', () => bad(r.goalRow, { ...goal, createdAt: 'yesterday' }));
  it('empty pending action id', () => bad(r.pendingActionRow, { ...pending, id: '' }));
});
