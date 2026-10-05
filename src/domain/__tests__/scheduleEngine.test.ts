import { effectiveVersion, eligibleWithoutVacation, isDue, isInActiveRange, isScheduledOn } from '../scheduleEngine';
import { mkCtx, mkGoal, mkPause, mkVacation, mkVersion } from './fixtures';

// 2026-10-05 is Monday.
const MON = '2026-10-05', TUE = '2026-10-06', SAT = '2026-10-10', SUN = '2026-10-11';

describe('effectiveVersion', () => {
  const a = mkVersion({ id: 'a', effectiveFrom: '2026-01-01' });
  const b = mkVersion({ id: 'b', effectiveFrom: '2026-02-01' });
  it('picks latest effectiveFrom <= date', () => {
    expect(effectiveVersion([a, b], '2026-01-31')?.id).toBe('a');
    expect(effectiveVersion([b, a], '2026-02-01')?.id).toBe('b');
    expect(effectiveVersion([a, b], '2026-12-01')?.id).toBe('b');
  });
  it('none before first', () => expect(effectiveVersion([a, b], '2025-12-31')).toBeUndefined());
  it('tie goes to latest createdAt', () => {
    const c = mkVersion({ id: 'c', effectiveFrom: '2026-02-01', createdAt: '2026-02-01T10:00:00.000Z' });
    const d = mkVersion({ id: 'd', effectiveFrom: '2026-02-01', createdAt: '2026-02-01T09:00:00.000Z' });
    expect(effectiveVersion([c, d], '2026-02-05')?.id).toBe('c');
    expect(effectiveVersion([d, c], '2026-02-05')?.id).toBe('c');
  });
});

describe('isScheduledOn', () => {
  it('daily', () => expect(isScheduledOn(mkVersion(), SUN)).toBe(true));
  it('weekdays Mon-Fri', () => {
    const v = mkVersion({ scheduleType: 'weekdays' });
    expect(isScheduledOn(v, MON)).toBe(true);
    expect(isScheduledOn(v, '2026-10-09')).toBe(true);
    expect(isScheduledOn(v, SAT)).toBe(false);
    expect(isScheduledOn(v, SUN)).toBe(false);
  });
  it('weekends Sat-Sun', () => {
    const v = mkVersion({ scheduleType: 'weekends' });
    expect(isScheduledOn(v, SAT)).toBe(true);
    expect(isScheduledOn(v, SUN)).toBe(true);
    expect(isScheduledOn(v, MON)).toBe(false);
  });
  it('customDays ISO bitmask (bit0=Mon)', () => {
    const v = mkVersion({ scheduleType: 'customDays', scheduleDays: (1 << 0) | (1 << 6) });
    expect(isScheduledOn(v, MON)).toBe(true);
    expect(isScheduledOn(v, SUN)).toBe(true);
    expect(isScheduledOn(v, TUE)).toBe(false);
    expect(isScheduledOn(v, SAT)).toBe(false);
  });
  it('everyNDays anchored to effectiveFrom', () => {
    const v = mkVersion({ scheduleType: 'everyNDays', everyNDays: 3, effectiveFrom: '2026-10-05' });
    expect(isScheduledOn(v, '2026-10-05')).toBe(true);
    expect(isScheduledOn(v, '2026-10-06')).toBe(false);
    expect(isScheduledOn(v, '2026-10-08')).toBe(true);
    expect(isScheduledOn(v, '2026-10-11')).toBe(true);
    expect(isScheduledOn(v, '2026-10-04')).toBe(false);
  });
  it('timesPerWeek eligible every day', () => {
    const v = mkVersion({ scheduleType: 'timesPerWeek', timesPerWeek: 3 });
    expect(isScheduledOn(v, MON)).toBe(true);
    expect(isScheduledOn(v, SUN)).toBe(true);
  });
});

describe('isInActiveRange', () => {
  it('start date', () => {
    const g = mkGoal({ startDate: '2026-02-01' });
    expect(isInActiveRange(g, [], '2026-01-31', 0)).toBe(false);
    expect(isInActiveRange(g, [], '2026-02-01', 0)).toBe(true);
  });
  it('endDate inclusive', () => {
    const g = mkGoal({ endDate: '2026-02-10' });
    expect(isInActiveRange(g, [], '2026-02-10', 0)).toBe(true);
    expect(isInActiveRange(g, [], '2026-02-11', 0)).toBe(false);
  });
  it('targetDays = exactly N days from start', () => {
    const g = mkGoal({ startDate: '2026-02-01', targetDays: 3 });
    expect(isInActiveRange(g, [], '2026-02-03', 0)).toBe(true);
    expect(isInActiveRange(g, [], '2026-02-04', 0)).toBe(false);
  });
  it('closed and open pauses', () => {
    const closed = mkPause({ startDate: '2026-01-10', endDate: '2026-01-12' });
    const g = mkGoal();
    expect(isInActiveRange(g, [closed], '2026-01-09', 0)).toBe(true);
    expect(isInActiveRange(g, [closed], '2026-01-10', 0)).toBe(false);
    expect(isInActiveRange(g, [closed], '2026-01-12', 0)).toBe(false);
    expect(isInActiveRange(g, [closed], '2026-01-13', 0)).toBe(true);
    const open = mkPause({ startDate: '2026-01-20', endDate: null });
    expect(isInActiveRange(g, [open], '2026-01-19', 0)).toBe(true);
    expect(isInActiveRange(g, [open], '2027-06-01', 0)).toBe(false);
  });
  it('archivedAt: before logical date active, on/after not', () => {
    const g = mkGoal({ archivedAt: new Date(2026, 1, 10, 15, 0).toISOString() });
    expect(isInActiveRange(g, [], '2026-02-09', 0)).toBe(true);
    expect(isInActiveRange(g, [], '2026-02-10', 0)).toBe(false);
  });
  it('archivedAt uses logical date with dayEndsAt', () => {
    const g = mkGoal({ archivedAt: new Date(2026, 1, 10, 1, 30).toISOString() });
    expect(isInActiveRange(g, [], '2026-02-09', 3)).toBe(false); // logical archive date is 02-09
    expect(isInActiveRange(g, [], '2026-02-08', 3)).toBe(true);
    expect(isInActiveRange(g, [], '2026-02-09', 0)).toBe(true);
  });
});

describe('isDue / eligibleWithoutVacation', () => {
  it('uses the version effective that day', () => {
    const ctx = mkCtx({
      versions: [
        mkVersion({ id: 'a', effectiveFrom: '2026-01-01', scheduleType: 'weekdays' }),
        mkVersion({ id: 'b', effectiveFrom: '2026-10-08', scheduleType: 'weekends' }),
      ],
    });
    expect(isDue(ctx, MON)).toBe(true);
    expect(isDue(ctx, SAT)).toBe(true); // weekends version
    expect(isDue(ctx, '2026-10-09')).toBe(false); // Friday under weekends
    expect(isDue({ ...ctx, versions: [ctx.versions[0]] }, SAT)).toBe(false);
  });
  it('everyNDays re-anchors on version change', () => {
    const ctx = mkCtx({
      versions: [
        mkVersion({ id: 'a', effectiveFrom: '2026-10-01', scheduleType: 'everyNDays', everyNDays: 2 }),
        mkVersion({ id: 'b', effectiveFrom: '2026-10-06', scheduleType: 'everyNDays', everyNDays: 2 }),
      ],
      goal: mkGoal({ startDate: '2026-10-01' }),
    });
    expect(isDue(ctx, '2026-10-03')).toBe(true); // version a anchor
    expect(isDue(ctx, '2026-10-05')).toBe(true);
    expect(isDue(ctx, '2026-10-06')).toBe(true); // version b anchor
    expect(isDue(ctx, '2026-10-07')).toBe(false);
    expect(isDue(ctx, '2026-10-08')).toBe(true);
  });
  it('no version, not due', () => expect(isDue(mkCtx({ versions: [] }), MON)).toBe(false));
  it('vacation all and selected', () => {
    const all = mkCtx({ vacations: [mkVacation({ startDate: MON, endDate: MON })] });
    expect(isDue(all, MON)).toBe(false);
    expect(eligibleWithoutVacation(all, MON)).toBe(true);
    expect(isDue(all, TUE)).toBe(true);
    const sel = mkCtx({ vacations: [mkVacation({ startDate: MON, endDate: MON, scope: 'selected', goalIds: ['other'] })] });
    expect(isDue(sel, MON)).toBe(true);
    const sel2 = mkCtx({ vacations: [mkVacation({ startDate: MON, endDate: MON, scope: 'selected', goalIds: ['g1'] })] });
    expect(isDue(sel2, MON)).toBe(false);
  });
  it('paused and archived not due', () => {
    expect(isDue(mkCtx({ pauses: [mkPause({ startDate: MON, endDate: null })] }), MON)).toBe(false);
    expect(isDue(mkCtx({ goal: mkGoal({ endDate: '2026-10-04' }) }), MON)).toBe(false);
  });
});
