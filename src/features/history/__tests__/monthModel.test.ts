import { mkCtx, mkGoal, mkLog, mkVacation, mkVersion } from '../../../domain/__tests__/fixtures';
import { buildMonthModel, shiftMonth, type MonthModel } from '../monthModel';

const cell = (m: MonthModel, date: string) => m.weeks.flatMap((w) => w.cells).find((c) => c.date === date)!;

describe('buildMonthModel', () => {
  const today = '2026-01-15';

  it('always yields 6 weeks of 7 cells with padding outside the month', () => {
    const m = buildMonthModel(mkCtx(), [], '2026-01', today, 1);
    expect(m.weeks).toHaveLength(6);
    for (const w of m.weeks) expect(w.cells).toHaveLength(7);
    // Jan 1 2026 is a Thursday: Monday-start puts it at index 3.
    expect(m.weeks[0].cells.slice(0, 3).every((c) => c.date === null)).toBe(true);
    expect(m.weeks[0].cells[3].date).toBe('2026-01-01');
    expect(m.weeks.flatMap((w) => w.cells).filter((c) => c.date).length).toBe(31);
  });

  it('respects weekStart', () => {
    const sun = buildMonthModel(mkCtx(), [], '2026-01', today, 0);
    expect(sun.weeks[0].cells[4].date).toBe('2026-01-01');
  });

  it('maps statuses: done, partial, skipped, missed, pending, vacation, not-due', () => {
    const ctx = mkCtx({
      goal: mkGoal({ startDate: '2026-01-02' }),
      vacations: [mkVacation({ startDate: '2026-01-10', endDate: '2026-01-11' })],
    });
    const logs = [
      mkLog({ date: '2026-01-02' }),
      mkLog({ date: '2026-01-03', status: 'partial', value: 0 }),
      mkLog({ date: '2026-01-04', status: 'skipped', value: 0 }),
    ];
    const m = buildMonthModel(ctx, logs, '2026-01', today, 1);
    expect(cell(m, '2026-01-01').status).toBe('notDue');
    expect(cell(m, '2026-01-02').status).toBe('done');
    expect(cell(m, '2026-01-03').status).toBe('partial');
    expect(cell(m, '2026-01-04').status).toBe('skipped');
    expect(cell(m, '2026-01-05').status).toBe('missed');
    expect(cell(m, '2026-01-10').status).toBe('vacation');
    expect(cell(m, '2026-01-15').status).toBe('pending');
    expect(cell(m, '2026-01-15').isToday).toBe(true);
    expect(cell(m, '2026-01-16').status).toBe('notDue');
  });

  it('marks future days read-only and today editable', () => {
    const m = buildMonthModel(mkCtx(), [], '2026-01', today, 1);
    expect(cell(m, '2026-01-15').readOnly).toBe(false);
    expect(cell(m, '2026-01-16').readOnly).toBe(true);
    expect(buildMonthModel(mkCtx(), [], '2026-02', today, 1).weeks.flatMap((w) => w.cells).filter((c) => c.date).every((c) => c.readOnly)).toBe(true);
  });

  it('value badge only for count, duration and value goals', () => {
    const count = mkCtx({ goal: mkGoal({ trackingType: 'count', targetValue: 8 }) });
    const m = buildMonthModel(count, [mkLog({ date: '2026-01-03', value: 5, status: 'partial' })], '2026-01', today, 1);
    expect(cell(m, '2026-01-03').badge).toBe('5');
    expect(cell(m, '2026-01-04').badge).toBeNull();
    const check = buildMonthModel(mkCtx(), [mkLog({ date: '2026-01-03' })], '2026-01', today, 1);
    expect(cell(check, '2026-01-03').badge).toBeNull();
  });

  it('timesPerWeek rows carry a quota pill', () => {
    const ctx = mkCtx({ versions: [mkVersion({ scheduleType: 'timesPerWeek', timesPerWeek: 3 })] });
    // Week Mon Jan 5 - Sun Jan 11: two done days.
    const logs = [mkLog({ date: '2026-01-05' }), mkLog({ date: '2026-01-07' })];
    const m = buildMonthModel(ctx, logs, '2026-01', today, 1);
    expect(m.weeks[1].quota).toEqual({ done: 2, target: 3 });
    expect(buildMonthModel(mkCtx(), [], '2026-01', today, 1).weeks[1].quota).toBeNull();
    expect(m.header.streakUnit).toBe('weeks');
  });

  it('header streaks and month percent', () => {
    const logs = ['2026-01-12', '2026-01-13', '2026-01-14', '2026-01-15'].map((date) => mkLog({ date }));
    const m = buildMonthModel(mkCtx(), logs, '2026-01', today, 1);
    expect(m.header.currentStreak).toBe(4);
    expect(m.header.bestStreak).toBe(4);
    expect(m.header.streakUnit).toBe('days');
    // 4 done of 14 scored days (Jan 15 done counts): 4/15
    expect(m.header.monthPercent).toBeCloseTo((4 / 15) * 100, 5);
  });

  it('month percent is null for a future month', () => {
    expect(buildMonthModel(mkCtx(), [], '2026-03', today, 1).header.monthPercent).toBeNull();
  });

  it('handles year boundaries', () => {
    const m = buildMonthModel(mkCtx({ goal: mkGoal({ startDate: '2025-12-01' }), versions: [mkVersion({ effectiveFrom: '2025-12-01' })] }), [mkLog({ date: '2025-12-31' }), mkLog({ date: '2026-01-01' })], '2025-12', today, 1);
    expect(cell(m, '2025-12-31').status).toBe('done');
    expect(cell(m, '2026-01-01')).toBeUndefined();
    expect(shiftMonth('2025-12', 1)).toBe('2026-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-01', -13)).toBe('2024-12');
  });
});
