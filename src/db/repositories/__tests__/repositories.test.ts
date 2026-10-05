import { createTestDb } from '../../../test/testDb';
import type { TrekDb } from '../../client';
import * as r from '..';

const TODAY = '2026-10-05';
let db: TrekDb;
let raw: ReturnType<typeof createTestDb>['raw'];

beforeEach(() => {
  const t = createTestDb();
  db = t.db as unknown as TrekDb;
  raw = t.raw;
});

const count = (table: string) => (raw.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;

describe('goals', () => {
  it('name-only goal gets defaults and one daily version', async () => {
    const g = await r.createGoal(db, { name: 'Water' }, TODAY);
    expect(g).toMatchObject({
      name: 'Water', icon: 'flag', color: '#2E7D5B', trackingType: 'check', targetValue: 1, unit: null,
      startDate: TODAY, endDate: null, targetDays: null, pausedAt: null, archivedAt: null, sortOrder: 0,
    });
    const versions = await r.listScheduleVersions(db, g.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ scheduleType: 'daily', scheduleDays: 127, effectiveFrom: TODAY });
  });

  it('uses explicit startDate for the first version', async () => {
    const g = await r.createGoal(db, { name: 'A', startDate: '2026-01-01' }, TODAY);
    expect((await r.listScheduleVersions(db, g.id))[0].effectiveFrom).toBe('2026-01-01');
  });

  it('update, get, archive, list', async () => {
    const a = await r.createGoal(db, { name: 'A' }, TODAY);
    const b = await r.createGoal(db, { name: 'B' }, TODAY);
    await r.updateGoal(db, a.id, { name: 'A2', targetValue: 5 });
    const got = await r.getGoal(db, a.id);
    expect(got).toMatchObject({ name: 'A2', targetValue: 5 });
    expect(got!.updatedAt >= a.updatedAt).toBe(true);
    await r.archiveGoal(db, b.id, '2026-10-05T00:00:00.000Z');
    expect((await r.listGoals(db)).map((g) => g.id)).toEqual([a.id]);
    expect(await r.listGoals(db, { includeArchived: true })).toHaveLength(2);
    expect(await r.getGoal(db, 'nope')).toBeUndefined();
  });

  it('reorders by sortOrder', async () => {
    const a = await r.createGoal(db, { name: 'A' }, TODAY);
    const b = await r.createGoal(db, { name: 'B' }, TODAY);
    const c = await r.createGoal(db, { name: 'C' }, TODAY);
    await r.reorderGoals(db, [c.id, a.id, b.id]);
    expect((await r.listGoals(db)).map((g) => g.name)).toEqual(['C', 'A', 'B']);
  });

  it('duplicate copies goal, current schedule, slots and reminders with new ids', async () => {
    const g = await r.createGoal(db, { name: 'Run', color: '#112233', startDate: '2026-01-01' }, TODAY);
    await r.addScheduleVersion(db, g.id, '2026-06-01', { scheduleType: 'customDays', scheduleDays: 0b0101010 }, [
      { weekday: 1, time: '07:00', label: 'am' },
      { weekday: 3, time: '18:30' },
    ]);
    await r.setReminders(db, g.id, [{ weekday: 1, time: '06:45', offsetMin: 5 }]);
    await r.pauseGoal(db, g.id, '2026-07-01');
    const copy = await r.duplicateGoal(db, g.id, TODAY);
    expect(copy.id).not.toBe(g.id);
    expect(copy).toMatchObject({ name: 'Run', color: '#112233', pausedAt: null, archivedAt: null });
    const versions = await r.listScheduleVersions(db, copy.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ scheduleType: 'customDays', scheduleDays: 0b0101010 });
    const slots = await r.listSlots(db, versions[0].id);
    expect(slots.map((s) => [s.weekday, s.time, s.label])).toEqual([[1, '07:00', 'am'], [3, '18:30', null]]);
    const rems = await r.listReminders(db, copy.id);
    expect(rems).toHaveLength(1);
    expect(rems[0]).toMatchObject({ weekday: 1, time: '06:45', offsetMin: 5, enabled: true });
    expect(rems[0].id).not.toBe((await r.listReminders(db, g.id))[0].id);
    expect(await r.listPauses(db, copy.id)).toHaveLength(0);
  });

  it('delete cascades', async () => {
    const g = await r.createGoal(db, { name: 'A' }, TODAY);
    await r.upsertLog(db, { goalId: g.id, date: TODAY, value: 1, status: 'done' });
    await r.deleteGoal(db, g.id);
    expect(count('goals') + count('goal_schedule_versions') + count('logs')).toBe(0);
  });
});

describe('schedules', () => {
  it('inserts versions ascending and never mutates past ones', async () => {
    const g = await r.createGoal(db, { name: 'A', startDate: '2026-01-01' }, TODAY);
    const before = (await r.listScheduleVersions(db, g.id))[0];
    await r.addScheduleVersion(db, g.id, '2026-05-01', { scheduleType: 'everyNDays', scheduleDays: 127, everyNDays: 3 });
    const list = await r.listScheduleVersions(db, g.id);
    expect(list.map((v) => v.effectiveFrom)).toEqual(['2026-01-01', '2026-05-01']);
    expect(list[0]).toEqual(before);
    expect(list[1]).toMatchObject({ everyNDays: 3, timesPerWeek: null });
  });

  it('same effectiveFrom replaces that version and its slots', async () => {
    const g = await r.createGoal(db, { name: 'A' }, TODAY);
    await r.addScheduleVersion(db, g.id, '2026-10-06', { scheduleType: 'weekdays', scheduleDays: 62 }, [{ weekday: 1, time: '08:00' }]);
    await r.addScheduleVersion(db, g.id, '2026-10-06', { scheduleType: 'weekends', scheduleDays: 65 }, [{ weekday: 0, time: '09:00' }]);
    const list = await r.listScheduleVersions(db, g.id);
    expect(list).toHaveLength(2);
    expect(list[1].scheduleType).toBe('weekends');
    expect(count('goal_slots')).toBe(1);
    expect((await r.listSlots(db, list[1].id))[0].time).toBe('09:00');
  });
});

describe('pauses', () => {
  it('pause opens a row, resume closes it the day before', async () => {
    const g = await r.createGoal(db, { name: 'A', startDate: '2026-01-01' }, TODAY);
    await r.pauseGoal(db, g.id, '2026-10-01');
    expect((await r.getGoal(db, g.id))!.pausedAt).not.toBeNull();
    expect(await r.listPauses(db, g.id)).toMatchObject([{ startDate: '2026-10-01', endDate: null }]);
    await r.resumeGoal(db, g.id, '2026-10-05');
    expect((await r.getGoal(db, g.id))!.pausedAt).toBeNull();
    expect(await r.listPauses(db, g.id)).toMatchObject([{ startDate: '2026-10-01', endDate: '2026-10-04' }]);
  });

  it('resume on the pause start day deletes the row', async () => {
    const g = await r.createGoal(db, { name: 'A' }, TODAY);
    await r.pauseGoal(db, g.id, TODAY);
    await r.resumeGoal(db, g.id, TODAY);
    expect(await r.listPauses(db, g.id)).toHaveLength(0);
  });

  it('resume crosses month boundary', async () => {
    const g = await r.createGoal(db, { name: 'A' }, TODAY);
    await r.pauseGoal(db, g.id, '2026-09-20');
    await r.resumeGoal(db, g.id, '2026-10-01');
    expect((await r.listPauses(db, g.id))[0].endDate).toBe('2026-09-30');
  });
});

describe('reminders', () => {
  it('replaces the set and lists per goal or all', async () => {
    const a = await r.createGoal(db, { name: 'A' }, TODAY);
    const b = await r.createGoal(db, { name: 'B' }, TODAY);
    await r.setReminders(db, a.id, [{ weekday: 1, time: '08:00' }, { weekday: 2, time: '09:00', enabled: false }]);
    await r.setReminders(db, b.id, [{ weekday: 3, time: '10:00' }]);
    await r.setReminders(db, a.id, [{ weekday: 4, time: '07:00' }]);
    expect((await r.listReminders(db, a.id)).map((x) => x.weekday)).toEqual([4]);
    expect(await r.listReminders(db)).toHaveLength(2);
    await r.setReminders(db, a.id, []);
    expect(await r.listReminders(db, a.id)).toHaveLength(0);
  });
});

describe('groups', () => {
  it('CRUD, reorder, goal links', async () => {
    const g1 = await r.createGoal(db, { name: 'G1' }, TODAY);
    const g2 = await r.createGoal(db, { name: 'G2' }, TODAY);
    const a = await r.createGroup(db, { name: 'A', color: '#111111', icon: 'star' });
    const b = await r.createGroup(db, { name: 'B', color: '#222222', icon: 'heart' });
    await r.updateGroup(db, a.id, { name: 'A2' });
    expect((await r.getGroup(db, a.id))!.name).toBe('A2');
    await r.reorderGroups(db, [b.id, a.id]);
    expect((await r.listGroups(db)).map((x) => x.name)).toEqual(['B', 'A2']);
    await r.setGroupGoals(db, a.id, [g1.id, g2.id, g1.id]);
    await r.setGroupGoals(db, b.id, [g1.id]);
    expect(await r.listGroupGoals(db, a.id)).toHaveLength(2);
    expect(await r.listGroupGoals(db)).toHaveLength(3);
    await r.setGroupGoals(db, a.id, [g2.id]);
    expect(await r.listGroupGoals(db, a.id)).toEqual([{ groupId: a.id, goalId: g2.id }]);
    await r.deleteGroup(db, a.id);
    expect(await r.listGroups(db)).toHaveLength(1);
    expect(await r.listGroupGoals(db)).toHaveLength(1);
  });
});

describe('logs', () => {
  it('upsert on (goal, date, null slot) updates instead of duplicating, keeping loggedAt', async () => {
    const g = await r.createGoal(db, { name: 'A' }, TODAY);
    const first = await r.upsertLog(db, { goalId: g.id, date: TODAY, value: 1, status: 'partial', note: 'x' });
    const second = await r.upsertLog(db, { goalId: g.id, date: TODAY, value: 3, status: 'done' });
    expect(second.id).toBe(first.id);
    expect(second).toMatchObject({ value: 3, status: 'done', note: null, loggedAt: first.loggedAt });
    expect(count('logs')).toBe(1);
  });

  it('distinct slots are distinct rows; same slot updates', async () => {
    const g = await r.createGoal(db, { name: 'A' }, TODAY);
    await r.addScheduleVersion(db, g.id, '2026-10-06', { scheduleType: 'daily', scheduleDays: 127 }, [{ weekday: 1, time: '08:00' }, { weekday: 1, time: '20:00' }]);
    const v = (await r.listScheduleVersions(db, g.id))[1];
    const [s1, s2] = await r.listSlots(db, v.id);
    await r.upsertLog(db, { goalId: g.id, date: TODAY, slotId: s1.id, value: 1, status: 'done' });
    await r.upsertLog(db, { goalId: g.id, date: TODAY, slotId: s2.id, value: 1, status: 'done' });
    await r.upsertLog(db, { goalId: g.id, date: TODAY, slotId: s1.id, value: 0, status: 'skipped' });
    await r.upsertLog(db, { goalId: g.id, date: TODAY, value: 1, status: 'done' });
    expect(count('logs')).toBe(3);
  });

  it('list filters and delete', async () => {
    const a = await r.createGoal(db, { name: 'A' }, TODAY);
    const b = await r.createGoal(db, { name: 'B' }, TODAY);
    for (const d of ['2026-09-30', '2026-10-01', '2026-10-02']) await r.upsertLog(db, { goalId: a.id, date: d, value: 1, status: 'done' });
    await r.upsertLog(db, { goalId: b.id, date: '2026-10-01', value: 1, status: 'done' });
    expect(await r.listLogs(db)).toHaveLength(4);
    expect(await r.listLogs(db, { goalId: a.id })).toHaveLength(3);
    expect((await r.listLogs(db, { goalId: a.id, from: '2026-10-01' })).map((l) => l.date)).toEqual(['2026-10-01', '2026-10-02']);
    expect((await r.listLogs(db, { from: '2026-10-01', to: '2026-10-01' })).map((l) => l.goalId).sort()).toEqual([a.id, b.id].sort());
    const [first] = await r.listLogs(db, { goalId: a.id });
    await r.deleteLog(db, first.id);
    expect(await r.listLogs(db, { goalId: a.id })).toHaveLength(2);
  });
});

describe('vacations', () => {
  it('create with goals, list, update, delete', async () => {
    const g = await r.createGoal(db, { name: 'A' }, TODAY);
    const all = await r.createVacation(db, { startDate: '2026-08-01', endDate: '2026-08-10', scope: 'all', goalIds: [g.id], note: 'trip' });
    expect(all).toMatchObject({ scope: 'all', goalIds: [], note: 'trip' });
    const sel = await r.createVacation(db, { startDate: '2026-12-01', endDate: '2026-12-10', scope: 'selected', goalIds: [g.id] });
    expect(sel.goalIds).toEqual([g.id]);
    await r.updateVacation(db, sel.id, { endDate: '2026-12-12', note: 'n' });
    expect((await r.listVacations(db)).map((v) => v.endDate)).toEqual(['2026-08-10', '2026-12-12']);
    await r.updateVacation(db, sel.id, { scope: 'all' });
    expect((await r.listVacations(db))[1].goalIds).toEqual([]);
    await r.deleteVacation(db, all.id);
    expect(await r.listVacations(db)).toHaveLength(1);
    expect(count('vacation_goals')).toBe(0);
  });

  it('endVacationNow sets endDate to yesterday', async () => {
    const v = await r.createVacation(db, { startDate: '2026-10-01', endDate: '2026-10-10', scope: 'all' });
    await r.endVacationNow(db, v.id, TODAY);
    expect((await r.listVacations(db))[0].endDate).toBe('2026-10-04');
  });

  it('endVacationNow deletes a vacation that had not started', async () => {
    const future = await r.createVacation(db, { startDate: '2026-10-05', endDate: '2026-10-10', scope: 'all' });
    await r.endVacationNow(db, future.id, TODAY);
    expect(await r.listVacations(db)).toHaveLength(0);
  });
});

describe('pendingActions', () => {
  const row = { id: 'widget:g:2026-10-05:done', source: 'widget', goalId: 'g', date: TODAY, action: 'done', createdAt: '2026-10-05T08:00:00.000Z' } as const;

  it('same id twice keeps one row', async () => {
    await r.enqueueAction(db, row);
    await r.enqueueAction(db, { ...row, source: 'notification' });
    expect(count('pending_actions')).toBe(1);
    expect((await r.listUnprocessed(db))[0].source).toBe('widget');
  });

  it('lists unprocessed by createdAt and marks processed', async () => {
    await r.enqueueAction(db, { ...row, id: 'b', createdAt: '2026-10-05T09:00:00.000Z' });
    await r.enqueueAction(db, { ...row, id: 'a', createdAt: '2026-10-05T07:00:00.000Z' });
    expect((await r.listUnprocessed(db)).map((x) => x.id)).toEqual(['a', 'b']);
    await r.markProcessed(db, 'a', '2026-10-05T10:00:00.000Z');
    expect((await r.listUnprocessed(db)).map((x) => x.id)).toEqual(['b']);
  });
});
