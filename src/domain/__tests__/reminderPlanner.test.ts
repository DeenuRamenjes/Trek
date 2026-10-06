import { DEFAULT_SETTINGS } from '../settings';
import { planReminders, type PlannerInput, type PlannerSettings } from '../reminderPlanner';
import type { Reminder } from '../../db/schema';
import { mkCtx, mkGoal, mkLog, mkPause, mkVacation, mkVersion } from './fixtures';

// Mon 2026-10-05 09:00 local.
const now = new Date(2026, 9, 5, 9, 0);
const settings: PlannerSettings = { ...DEFAULT_SETTINGS, reviewNotifications: { weekly: false, monthly: false }, backupReminderFrequency: 'off' };

const rem = (o: Partial<Reminder> = {}): Reminder => ({
  id: 'r1', goalId: 'g1', slotId: null, weekday: 2, time: '08:00', offsetMin: 0, enabled: true, ...o,
});
const plan = (o: Partial<PlannerInput> = {}) =>
  planReminders({ now, ctxs: [mkCtx()], reminders: [rem()], logs: [], settings, ...o });

describe('goal reminders', () => {
  it('carries slotId, and the logical date on one-shot occurrences', () => {
    const ctx = mkCtx({ vacations: [mkVacation({ startDate: '2026-10-07', endDate: '2026-10-07' })] });
    const out = plan({ ctxs: [ctx], reminders: [rem({ slotId: 's1' })] });
    expect(out[0]).toMatchObject({ kind: 'date', slotId: 's1', date: '2026-10-14' });
    expect(plan({ reminders: [rem({ slotId: 's1' })] })[0]).toMatchObject({ kind: 'weekly', slotId: 's1' });
  });
  it('all-due weekly reminder becomes one repeating weekly trigger', () => {
    const out = plan();
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: 'goal:r1:weekly', kind: 'weekly', weekday: 2, hour: 8, minute: 0, category: 'goal',
      contentKey: 'goalReminder', goalId: 'g1', goalName: 'G', priority: 0,
    });
  });
  it('never emits notes or text', () => {
    expect(JSON.stringify(plan())).not.toMatch(/note/i);
  });
  it('disabled reminders and unknown goals are skipped', () => {
    expect(plan({ reminders: [rem({ enabled: false }), rem({ id: 'r2', goalId: 'nope' })] })).toEqual([]);
  });
  it('offset shifts the fire time, crossing midnight moves the weekday', () => {
    const early = plan({ reminders: [rem({ offsetMin: -30 })] })[0];
    expect(early).toMatchObject({ kind: 'weekly', weekday: 2, hour: 7, minute: 30 });
    const cross = plan({ reminders: [rem({ time: '00:10', offsetMin: -20 })] })[0];
    expect(cross).toMatchObject({ kind: 'weekly', weekday: 1, hour: 23, minute: 50 });
  });
  it('vacation on one occurrence turns it into date triggers for the rest', () => {
    // Wed 2026-10-07 vacation; next Wed 10-14 stays.
    const ctx = mkCtx({ vacations: [mkVacation({ startDate: '2026-10-07', endDate: '2026-10-07' })] });
    const out = plan({ ctxs: [ctx] });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'date', at: new Date(2026, 9, 14, 8, 0).toISOString() });
  });
  it('vacation covering the whole horizon suppresses everything', () => {
    const ctx = mkCtx({ vacations: [mkVacation({ startDate: '2026-10-01', endDate: '2026-11-30' })] });
    expect(plan({ ctxs: [ctx] })).toEqual([]);
  });
  it('selected-scope vacation only affects its goals', () => {
    const v = mkVacation({ startDate: '2026-10-01', endDate: '2026-11-30', scope: 'selected', goalIds: ['other'] });
    expect(plan({ ctxs: [mkCtx({ vacations: [v] })] })).toHaveLength(1);
  });
  it('open pause suppresses', () => {
    expect(plan({ ctxs: [mkCtx({ pauses: [mkPause({ startDate: '2026-10-01', endDate: null })] })] })).toEqual([]);
  });
  it('endDate stops later occurrences', () => {
    const ctx = mkCtx({ goal: mkGoal({ endDate: '2026-10-08' }) });
    const out = plan({ ctxs: [ctx] });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'date', at: new Date(2026, 9, 7, 8, 0).toISOString() });
  });
  it('everyNDays gives date triggers only on due days', () => {
    // anchored 2026-10-01, every 2 days: due Oct 1,3,5,7,9,11,13,15 -> Wed 7 due, Wed 14 not.
    const ctx = mkCtx({ versions: [mkVersion({ scheduleType: 'everyNDays', everyNDays: 2, effectiveFrom: '2026-10-01' })] });
    const out = plan({ ctxs: [ctx] });
    expect(out.map((o) => o.kind)).toEqual(['date']);
    expect(out[0]).toMatchObject({ at: new Date(2026, 9, 7, 8, 0).toISOString() });
  });
  it('schedule version in effect that day decides', () => {
    // Switch to weekends on Oct 10: Wed Oct 14 not due, Wed Oct 7 still daily.
    const ctx = mkCtx({
      versions: [mkVersion(), mkVersion({ id: 'v2', effectiveFrom: '2026-10-10', scheduleType: 'weekends' })],
    });
    const out = plan({ ctxs: [ctx] });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'date', at: new Date(2026, 9, 7, 8, 0).toISOString() });
  });
  it('timesPerWeek: quota met this week suppresses this week only', () => {
    const ctx = mkCtx({ versions: [mkVersion({ scheduleType: 'timesPerWeek', timesPerWeek: 1 })] });
    const logs = [mkLog({ date: '2026-10-05' })];
    const out = plan({ ctxs: [ctx], logs });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'date', at: new Date(2026, 9, 14, 8, 0).toISOString() });
    expect(plan({ ctxs: [ctx], logs: [] })[0].kind).toBe('weekly');
  });
  it('dayEndsAt maps early-morning fire times to the previous logical day', () => {
    // Reminder Wed 01:30, dayEndsAt 3 -> logical Tue. Goal due only on Wednesday (bit 2) -> not due.
    const wedOnly = mkCtx({ versions: [mkVersion({ scheduleType: 'customDays', scheduleDays: 1 << 2 })] });
    const r = rem({ time: '01:30' });
    expect(plan({ ctxs: [wedOnly], reminders: [r], settings: { ...settings, dayEndsAt: 3 } })).toEqual([]);
    expect(plan({ ctxs: [wedOnly], reminders: [r], settings: { ...settings, dayEndsAt: 0 } })).toHaveLength(1);
    const tueOnly = mkCtx({ versions: [mkVersion({ scheduleType: 'customDays', scheduleDays: 1 << 1 })] });
    expect(plan({ ctxs: [tueOnly], reminders: [r], settings: { ...settings, dayEndsAt: 3 } })).toHaveLength(1);
  });
  it('past occurrence today is not planned', () => {
    const out = plan({ reminders: [rem({ weekday: 0, time: '08:00' })] });
    expect(out[0]).toMatchObject({ kind: 'weekly' });
    expect(out[0].nextAt).toBe(new Date(2026, 9, 12, 8, 0).toISOString());
  });
});

describe('quiet hours', () => {
  it('suppresses reminders inside a window wrapping midnight', () => {
    const q = { quietHours: { start: '22:00', end: '07:30' } };
    expect(plan({ settings: { ...settings, ...q }, reminders: [rem({ time: '23:00' })] })).toEqual([]);
    expect(plan({ settings: { ...settings, ...q }, reminders: [rem({ time: '07:00' })] })).toEqual([]);
    expect(plan({ settings: { ...settings, ...q }, reminders: [rem({ time: '07:30' })] })).toHaveLength(1);
    expect(plan({ settings: { ...settings, ...q }, reminders: [rem({ time: '12:00' })] })).toHaveLength(1);
  });
  it('same-day window', () => {
    const q = { quietHours: { start: '12:00', end: '14:00' } };
    expect(plan({ settings: { ...settings, ...q }, reminders: [rem({ time: '13:00' })] })).toEqual([]);
    expect(plan({ settings: { ...settings, ...q }, reminders: [rem({ time: '14:00' })] })).toHaveLength(1);
  });
});

describe('review reminders', () => {
  const s = { ...settings, reviewNotifications: { weekly: true, monthly: true } };
  it('weekly: last day of week at 19:00 per weekStart (Monday start -> Sunday)', () => {
    const out = plan({ reminders: [], settings: s });
    const weekly = out.find((o) => o.contentKey === 'weeklyReview');
    expect(weekly).toMatchObject({ id: 'review:weekly', kind: 'weekly', weekday: 6, hour: 19, minute: 0, route: 'review/week', category: 'review' });
  });
  it('weekly follows weekStart (Sunday start -> Saturday)', () => {
    const out = plan({ reminders: [], settings: { ...s, weekStart: 0 } });
    expect(out.find((o) => o.contentKey === 'weeklyReview')).toMatchObject({ weekday: 5 });
  });
  it('monthly: next two 1sts at 09:00', () => {
    const monthly = plan({ reminders: [], settings: s }).filter((o) => o.contentKey === 'monthlyReview');
    expect(monthly.map((m) => (m as { at: string }).at)).toEqual([
      new Date(2026, 10, 1, 9, 0).toISOString(),
      new Date(2026, 11, 1, 9, 0).toISOString(),
    ]);
    expect(monthly[0]).toMatchObject({ route: 'review/month' });
  });
  it('toggles off removes them', () => {
    expect(plan({ reminders: [], settings })).toEqual([]);
  });
  it('are not suppressed by vacation, but are by quiet hours', () => {
    const q = { ...s, quietHours: { start: '18:00', end: '20:00' } };
    const out = plan({ reminders: [], settings: q });
    expect(out.map((o) => o.contentKey)).toEqual(['monthlyReview', 'monthlyReview']);
  });
});

describe('backup reminder', () => {
  const s = { ...settings, backupReminderFrequency: 'weekly' as const };
  it('planned only when overdue, lowest priority, next 10:00', () => {
    const old = new Date(2026, 8, 1).toISOString();
    const out = plan({ settings: { ...s, lastBackupAt: old } });
    const b = out.find((o) => o.category === 'backup');
    expect(b).toMatchObject({ kind: 'date', at: new Date(2026, 9, 5, 10, 0).toISOString(), contentKey: 'backupReminder', priority: 2 });
    expect(plan({ settings: { ...s, lastBackupAt: new Date(2026, 9, 4).toISOString() } }).filter((o) => o.category === 'backup')).toEqual([]);
  });
  it('sorts after goal and review reminders', () => {
    const out = plan({
      settings: { ...s, lastBackupAt: new Date(2026, 8, 1).toISOString(), reviewNotifications: { weekly: true, monthly: false } },
      reminders: [rem({ weekday: 3 })],
    });
    expect(out.map((o) => o.category)).toEqual(['goal', 'review', 'backup']);
  });
});

describe('cap and determinism', () => {
  it('ids are deterministic', () => {
    expect(plan().map((o) => o.id)).toEqual(plan().map((o) => o.id));
  });
  it('12 goals x 3 slots x 7 days stays at or below 64, soonest goal reminders first', () => {
    const ctxs = Array.from({ length: 12 }, (_, i) =>
      mkCtx({ goal: mkGoal({ id: `g${i}`, name: `G${i}` }), versions: [mkVersion({ id: `v${i}`, goalId: `g${i}`, scheduleType: 'everyNDays', everyNDays: 2, effectiveFrom: '2026-10-01' })] }),
    );
    const reminders = ctxs.flatMap((c, i) =>
      [0, 1, 2, 3, 4, 5, 6].flatMap((wd) => ['07:00', '13:00', '20:00'].map((t, k) => rem({ id: `r-${i}-${wd}-${k}`, goalId: c.goal.id, weekday: wd, time: t }))),
    );
    const out = plan({ ctxs, reminders, settings: { ...settings, reviewNotifications: { weekly: true, monthly: true } } });
    expect(out.length).toBe(64);
    const times = out.map((o) => o.nextAt);
    expect([...times].sort()).toEqual(times);
  });
  it('property: 200 random seeds never exceed 64', () => {
    for (let seed = 1; seed <= 200; seed++) {
      let s = seed * 2654435761 % 4294967296;
      const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
      const nGoals = 1 + Math.floor(rnd() * 20);
      const ctxs = Array.from({ length: nGoals }, (_, i) => {
        const type = (['daily', 'weekdays', 'everyNDays', 'timesPerWeek'] as const)[Math.floor(rnd() * 4)];
        return mkCtx({
          goal: mkGoal({ id: `g${i}`, name: `G${i}` }),
          versions: [mkVersion({ id: `v${i}`, goalId: `g${i}`, scheduleType: type, everyNDays: type === 'everyNDays' ? 2 + Math.floor(rnd() * 3) : null, timesPerWeek: type === 'timesPerWeek' ? 3 : null, effectiveFrom: '2026-09-01' })],
        });
      });
      const reminders = Array.from({ length: Math.floor(rnd() * 150) }, (_, i) =>
        rem({
          id: `r${seed}-${i}`, goalId: `g${Math.floor(rnd() * nGoals)}`, weekday: Math.floor(rnd() * 7),
          time: `${String(Math.floor(rnd() * 24)).padStart(2, '0')}:${rnd() < 0.5 ? '00' : '30'}`,
          offsetMin: Math.floor(rnd() * 3) * 10 - 10,
        }),
      );
      const out = plan({ ctxs, reminders, settings: { ...settings, dayEndsAt: Math.floor(rnd() * 5), reviewNotifications: { weekly: true, monthly: true }, backupReminderFrequency: 'weekly' } });
      expect(out.length).toBeLessThanOrEqual(64);
      expect(new Set(out.map((o) => o.id)).size).toBe(out.length);
    }
  });
});
