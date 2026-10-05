import type { TrekDb } from '../../../db/client';
import { createGoal, listGoals, listReminders, listScheduleVersions, listSlots } from '../../../db/repositories';
import { createTestDb } from '../../../test/testDb';
import { defaultGoalForm, goalFormSchema } from '../goalFormSchema';
import { loadGoalFormValues, saveGoal } from '../saveGoal';

function newDb(): TrekDb {
  return createTestDb().db as unknown as TrekDb;
}

describe('goalFormSchema', () => {
  it('requires only the name and fills defaults', () => {
    const parsed = goalFormSchema.parse({ name: '  Read  ' });
    expect(parsed).toMatchObject({
      name: 'Read',
      icon: 'flag',
      color: '#2E7D5B',
      trackingType: 'check',
      targetValue: 1,
      scheduleType: 'daily',
      durationMode: 'open',
      reminderEnabled: false,
      slots: [],
    });
    expect(goalFormSchema.safeParse({ name: ' ' }).success).toBe(false);
  });

  it('rejects bad dates, times and empty custom days', () => {
    expect(goalFormSchema.safeParse({ name: 'a', durationMode: 'endDate', endDate: '2026-02-30' }).success).toBe(false);
    expect(goalFormSchema.safeParse({ name: 'a', slots: [{ weekday: 0, time: '25:00' }] }).success).toBe(false);
    expect(goalFormSchema.safeParse({ name: 'a', scheduleType: 'customDays', days: [] }).success).toBe(false);
    expect(goalFormSchema.safeParse({ name: 'a', trackingType: 'count', targetValue: '0' }).success).toBe(false);
  });
});

describe('saveGoal', () => {
  it('creates a name-only goal with defaults', async () => {
    const db = newDb();
    const id = await saveGoal(db, null, { ...defaultGoalForm(), name: 'Stretch' }, '2026-10-05');
    const [goal] = await listGoals(db);
    expect(goal).toMatchObject({ id, name: 'Stretch', icon: 'flag', color: '#2E7D5B', trackingType: 'check', targetValue: 1, unit: null, endDate: null, targetDays: null, startDate: '2026-10-05' });
    const versions = await listScheduleVersions(db, id);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ scheduleType: 'daily', scheduleDays: 127, effectiveFrom: '2026-10-05' });
    expect(await listReminders(db, id)).toHaveLength(0);
  });

  it('stores customDays mask, tracking, duration and reminders', async () => {
    const db = newDb();
    const id = await saveGoal(
      db,
      null,
      {
        ...defaultGoalForm(),
        name: 'Run',
        scheduleType: 'customDays',
        days: [0, 2, 4],
        trackingType: 'duration',
        targetValue: '30',
        unit: 'min',
        durationMode: 'targetDays',
        targetDays: '60',
        reminderEnabled: true,
        reminderWeekdays: [0, 2],
        reminderTime: '07:30',
        minutesBefore: 10,
      },
      '2026-10-05',
    );
    const [goal] = await listGoals(db);
    expect(goal).toMatchObject({ trackingType: 'duration', targetValue: 30, unit: 'min', targetDays: 60, endDate: null });
    expect((await listScheduleVersions(db, id))[0].scheduleDays).toBe(0b10101);
    const rems = await listReminders(db, id);
    expect(rems.map((r) => [r.weekday, r.time, r.offsetMin, r.slotId])).toEqual([
      [0, '07:30', -10, null],
      [2, '07:30', -10, null],
    ]);
  });

  it('a schedule edit inserts a new version from today and keeps the old one', async () => {
    const db = newDb();
    const goal = await createGoal(db, { name: 'Read' }, '2026-01-01');
    const before = await loadGoalFormValues(db, goal.id, '2026-10-05');
    await saveGoal(db, goal.id, { ...before!, scheduleType: 'weekdays' }, '2026-10-05');
    const versions = await listScheduleVersions(db, goal.id);
    expect(versions.map((v) => [v.effectiveFrom, v.scheduleType])).toEqual([
      ['2026-01-01', 'daily'],
      ['2026-10-05', 'weekdays'],
    ]);
  });

  it('a non-schedule edit does not add a version', async () => {
    const db = newDb();
    const goal = await createGoal(db, { name: 'Read' }, '2026-01-01');
    const before = await loadGoalFormValues(db, goal.id, '2026-10-05');
    await saveGoal(db, goal.id, { ...before!, name: 'Read more', color: '#2F6FB0' }, '2026-10-05');
    expect(await listScheduleVersions(db, goal.id)).toHaveLength(1);
    expect((await listGoals(db))[0]).toMatchObject({ name: 'Read more', color: '#2F6FB0' });
  });

  it('remaps reminders to the new version slot ids', async () => {
    const db = newDb();
    const id = await saveGoal(
      db,
      null,
      {
        ...defaultGoalForm(),
        name: 'Meds',
        slots: [
          { weekday: 0, time: '08:00', label: 'Morning' },
          { weekday: 0, time: '20:00', label: '' },
        ],
        reminderEnabled: true,
        reminderWeekdays: [0, 1],
        reminderTime: '09:00',
        minutesBefore: 5,
      },
      '2026-10-01',
    );
    const first = await listScheduleVersions(db, id);
    const firstSlots = await listSlots(db, first[0].id);
    expect(firstSlots).toHaveLength(2);
    let rems = await listReminders(db, id);
    expect(rems.filter((r) => r.slotId !== null).map((r) => r.slotId).sort()).toEqual(firstSlots.map((s) => s.id).sort());
    expect(rems.find((r) => r.weekday === 1)).toMatchObject({ slotId: null, time: '09:00' });

    const form = (await loadGoalFormValues(db, id, '2026-10-05'))!;
    expect(form.slots).toHaveLength(2);
    expect(form.reminderEnabled).toBe(true);
    expect(form.minutesBefore).toBe(5);
    await saveGoal(db, id, { ...form, scheduleType: 'weekdays' }, '2026-10-05');
    const versions = await listScheduleVersions(db, id);
    expect(versions).toHaveLength(2);
    const newSlots = await listSlots(db, versions[1].id);
    rems = await listReminders(db, id);
    expect(rems.filter((r) => r.slotId !== null).map((r) => r.slotId).sort()).toEqual(newSlots.map((s) => s.id).sort());
  });
});
