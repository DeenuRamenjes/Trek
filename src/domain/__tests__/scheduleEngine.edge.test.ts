import { eligibleWithoutVacation, isDue, isScheduledOn } from '../scheduleEngine';
import { mkCtx, mkGoal, mkPause, mkVersion } from './fixtures';

describe('scheduleEngine edge cases', () => {
  it('endDate and targetDays both set: the earlier limit wins', () => {
    const a = mkCtx({ goal: mkGoal({ startDate: '2026-01-01', endDate: '2026-01-20', targetDays: 5 }) });
    expect(isDue(a, '2026-01-05')).toBe(true);
    expect(isDue(a, '2026-01-06')).toBe(false);
    const b = mkCtx({ goal: mkGoal({ startDate: '2026-01-01', endDate: '2026-01-03', targetDays: 10 }) });
    expect(isDue(b, '2026-01-03')).toBe(true);
    expect(isDue(b, '2026-01-04')).toBe(false);
  });

  it('everyNDays with null or 0 is never due', () => {
    expect(isScheduledOn(mkVersion({ scheduleType: 'everyNDays', everyNDays: null }), '2026-01-01')).toBe(false);
    expect(isScheduledOn(mkVersion({ scheduleType: 'everyNDays', everyNDays: 0 }), '2026-01-01')).toBe(false);
  });

  it('pause spanning a version change blocks both sides, scoring resumes by the right version', () => {
    const ctx = mkCtx({
      versions: [
        mkVersion({ id: 'v1', effectiveFrom: '2026-01-01', scheduleType: 'daily' }),
        mkVersion({ id: 'v2', effectiveFrom: '2026-01-12', scheduleType: 'weekends' }),
      ],
      pauses: [mkPause({ startDate: '2026-01-10', endDate: '2026-01-13' })],
    });
    expect(eligibleWithoutVacation(ctx, '2026-01-09')).toBe(true);
    for (const d of ['2026-01-10', '2026-01-11', '2026-01-12', '2026-01-13']) expect(isDue(ctx, d)).toBe(false);
    expect(isDue(ctx, '2026-01-14')).toBe(false); // Wed, weekends version
    expect(isDue(ctx, '2026-01-17')).toBe(true); // Sat
  });
});
