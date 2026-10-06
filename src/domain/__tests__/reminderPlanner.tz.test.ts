import { DEFAULT_SETTINGS } from '../settings';
import { planReminders, type PlannerSettings } from '../reminderPlanner';
import type { Reminder } from '../../db/schema';
import { mkCtx, mkVacation } from './fixtures';

const settings: PlannerSettings = { ...DEFAULT_SETTINGS, reviewNotifications: { weekly: false, monthly: false }, backupReminderFrequency: 'off' };
// Weekly Monday 08:00 reminder; DST spring-forward is Sunday 2026-03-08.
const monday: Reminder = { id: 'r1', goalId: 'g1', slotId: null, weekday: 0, time: '08:00', offsetMin: 0, enabled: true };
const now = new Date(2026, 2, 1, 12, 0); // Sun Mar 1 local

describe('DST week (America/New_York)', () => {
  it('test environment observes DST', () => {
    expect(new Date(2026, 2, 8, 12).getTimezoneOffset()).not.toBe(new Date(2026, 0, 1, 12).getTimezoneOffset());
  });
  it('weekly trigger stays at local 08:00 across spring-forward', () => {
    const out = planReminders({ now, ctxs: [mkCtx()], reminders: [monday], logs: [], settings });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'weekly', weekday: 0, hour: 8, minute: 0 });
  });
  it('date triggers fire at local 08:00 both before and after the change', () => {
    const before = planReminders({
      now, ctxs: [mkCtx({ vacations: [mkVacation({ startDate: '2026-03-09', endDate: '2026-03-09' })] })],
      reminders: [monday], logs: [], settings,
    });
    const after = planReminders({
      now, ctxs: [mkCtx({ vacations: [mkVacation({ startDate: '2026-03-02', endDate: '2026-03-02' })] })],
      reminders: [monday], logs: [], settings,
    });
    // Mon Mar 2 (EST, UTC-5) and Mon Mar 9 (EDT, UTC-4).
    expect(before).toHaveLength(1);
    expect((before[0] as { at: string }).at).toBe('2026-03-02T13:00:00.000Z');
    expect(after).toHaveLength(1);
    expect((after[0] as { at: string }).at).toBe('2026-03-09T12:00:00.000Z');
    for (const o of [before[0], after[0]]) {
      const d = new Date((o as { at: string }).at);
      expect([d.getHours(), d.getMinutes()]).toEqual([8, 0]);
    }
  });
});
