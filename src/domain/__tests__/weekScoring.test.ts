import type { Log } from '../types';
import { quotaMet, scoreWeek } from '../weekScoring';
import { mkCtx, mkGoal, mkVacation, mkVersion, T } from './fixtures';

const lg = (date: string, status: Log['status'] = 'done'): Log =>
  ({ id: date + status, goalId: 'g1', date, slotId: null, value: 1, status, note: null, loggedAt: T, updatedAt: T }) as Log;

const WEEK = '2026-01-05'; // Monday
const ctx = (extra = {}, tpw = 3) =>
  mkCtx({ versions: [mkVersion({ scheduleType: 'timesPerWeek', timesPerWeek: tpw })], ...extra });

describe('scoreWeek', () => {
  it('ended week: credited capped at target, missed = target - credited', () => {
    const logs = [lg('2026-01-05'), lg('2026-01-06')];
    expect(scoreWeek(ctx(), logs, WEEK, '2026-01-13')).toEqual({
      eligibleDays: 7, vacationDays: 0, adjustedTarget: 3, doneDays: 2, credited: 2, missed: 1, ended: true, neutral: false,
    });
    const many = ['05', '06', '07', '08', '09'].map((d) => lg('2026-01-' + d));
    const s = scoreWeek(ctx(), many, WEEK, '2026-01-13');
    expect(s.doneDays).toBe(5);
    expect(s.credited).toBe(3);
    expect(s.missed).toBe(0);
  });

  it('current week is pending: nothing missed', () => {
    const s = scoreWeek(ctx(), [lg('2026-01-05')], WEEK, '2026-01-08');
    expect(s.ended).toBe(false);
    expect(s.missed).toBe(0);
  });

  it('week ends on its last day boundary', () => {
    expect(scoreWeek(ctx(), [], WEEK, '2026-01-11').ended).toBe(false);
    expect(scoreWeek(ctx(), [], WEEK, '2026-01-12').ended).toBe(true);
  });

  it('vacation days reduce the target, rounded up', () => {
    const vac = [mkVacation({ startDate: '2026-01-05', endDate: '2026-01-06' })];
    const s = scoreWeek(ctx({ vacations: vac }, 3), [], WEEK, '2026-01-13');
    expect(s.vacationDays).toBe(2);
    expect(s.adjustedTarget).toBe(Math.ceil((3 * 5) / 7)); // 3
    const vac4 = [mkVacation({ startDate: '2026-01-05', endDate: '2026-01-09' })];
    const s4 = scoreWeek(ctx({ vacations: vac4 }, 3), [], WEEK, '2026-01-13');
    expect(s4.adjustedTarget).toBe(1); // ceil(3*2/7)
    expect(s4.missed).toBe(1);
  });

  it('vacation-day logs are not credited', () => {
    const vac = [mkVacation({ startDate: '2026-01-05', endDate: '2026-01-05' })];
    expect(scoreWeek(ctx({ vacations: vac }), [lg('2026-01-05')], WEEK, '2026-01-13').doneDays).toBe(0);
  });

  it('whole week on vacation, target 0, or no eligible days is neutral', () => {
    const all = [mkVacation({ startDate: '2026-01-05', endDate: '2026-01-11' })];
    expect(scoreWeek(ctx({ vacations: all }), [], WEEK, '2026-01-13')).toMatchObject({ neutral: true, missed: 0, adjustedTarget: 0 });
    expect(scoreWeek(ctx({}, 0), [], WEEK, '2026-01-13').neutral).toBe(true);
    const before = ctx({ goal: mkGoal({ startDate: '2026-02-01' }) });
    expect(scoreWeek(before, [], WEEK, '2026-03-01')).toMatchObject({ eligibleDays: 0, neutral: true, missed: 0 });
  });

  it('caps target at available days: mid-week start', () => {
    // starts Friday 2026-01-09: Fri, Sat, Sun eligible
    const c = ctx({ goal: mkGoal({ startDate: '2026-01-09' }) }, 5);
    const s = scoreWeek(c, [], WEEK, '2026-01-13');
    expect(s.eligibleDays).toBe(3);
    expect(s.adjustedTarget).toBe(3);
    expect(s.missed).toBe(3);
  });

  it('skipped days do not count as done', () => {
    expect(scoreWeek(ctx(), [lg('2026-01-05', 'skipped')], WEEK, '2026-01-13').doneDays).toBe(0);
  });
});

describe('quotaMet', () => {
  it('true once done days reach the adjusted target', () => {
    const logs = [lg('2026-01-05'), lg('2026-01-06')];
    expect(quotaMet(ctx(), logs, '2026-01-07', '2026-01-07', 1)).toBe(false);
    expect(quotaMet(ctx(), [...logs, lg('2026-01-07')], '2026-01-07', '2026-01-07', 1)).toBe(true);
  });
  it('respects weekStart when locating the week', () => {
    // Sunday 2026-01-11 belongs to the Mon-start week of 01-05 but the Sun-start week of 01-11.
    const logs = [lg('2026-01-05'), lg('2026-01-06'), lg('2026-01-07')];
    expect(quotaMet(ctx(), logs, '2026-01-11', '2026-01-11', 1)).toBe(true);
    expect(quotaMet(ctx(), logs, '2026-01-11', '2026-01-11', 0)).toBe(false);
  });
  it('neutral week counts as met', () => {
    expect(quotaMet(ctx({}, 0), [], '2026-01-07', '2026-01-07', 1)).toBe(true);
  });
});
