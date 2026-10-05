import { dayStatus } from '../dayStatus';
import type { Log, Slot } from '../types';
import { mkCtx, mkGoal, mkPause, mkVacation, mkVersion, T } from './fixtures';

let n = 0;
const log = (o: Partial<Log>): Log =>
  ({ id: `l${n++}`, goalId: 'g1', date: '2026-01-05', slotId: null, value: 1, status: 'done', note: null, loggedAt: T, updatedAt: T, ...o }) as Log;
const slot = (id: string, weekday: number, versionId = 'v1'): Slot =>
  ({ id, scheduleVersionId: versionId, weekday, time: '08:00', label: null }) as Slot;

const D = '2026-01-05'; // Monday
const TODAY = '2026-01-08';

describe('dayStatus', () => {
  it('done / partial / skipped for check goals', () => {
    const ctx = mkCtx();
    expect(dayStatus(ctx, [log({})], D, TODAY)).toEqual({ status: 'done', value: 1, ratio: 1 });
    expect(dayStatus(ctx, [log({ status: 'partial', value: 0.5 })], D, TODAY).status).toBe('partial');
    expect(dayStatus(ctx, [log({ status: 'skipped', value: 0 })], D, TODAY).status).toBe('skipped');
  });

  it('missed in the past, pending today, not-due in the future', () => {
    const ctx = mkCtx();
    expect(dayStatus(ctx, [], D, TODAY).status).toBe('missed');
    expect(dayStatus(ctx, [], TODAY, TODAY).status).toBe('pending');
    expect(dayStatus(ctx, [], '2026-01-09', TODAY).status).toBe('not-due');
  });

  it('not-due: unscheduled, before start, paused', () => {
    expect(dayStatus(mkCtx({ versions: [mkVersion({ scheduleType: 'weekends' })] }), [], D, TODAY).status).toBe('not-due');
    expect(dayStatus(mkCtx({ goal: mkGoal({ startDate: '2026-01-06' }) }), [], D, TODAY).status).toBe('not-due');
    expect(dayStatus(mkCtx({ pauses: [mkPause({ startDate: '2026-01-04', endDate: '2026-01-06' })] }), [], D, TODAY).status).toBe('not-due');
  });

  it('vacation wins; logs on vacation and not-due days are ignored', () => {
    const vac = mkCtx({ vacations: [mkVacation({ startDate: D, endDate: D })] });
    expect(dayStatus(vac, [log({})], D, TODAY)).toEqual({ status: 'vacation', value: 0, ratio: 0 });
    const nd = mkCtx({ versions: [mkVersion({ scheduleType: 'weekends' })] });
    expect(dayStatus(nd, [log({})], D, TODAY)).toEqual({ status: 'not-due', value: 0, ratio: 0 });
  });

  it('ignores logs of other goals and dates', () => {
    const ctx = mkCtx();
    expect(dayStatus(ctx, [log({ goalId: 'other' }), log({ date: '2026-01-06' })], D, TODAY).status).toBe('missed');
  });

  it('slots: all done, some partial, none missed', () => {
    const slots = [slot('a', 0), slot('b', 0), slot('c', 1)]; // c is Tuesday, ignored on Monday
    const ctx = mkCtx({ slots });
    const la = log({ slotId: 'a' });
    const lb = log({ slotId: 'b' });
    expect(dayStatus(ctx, [la, lb], D, TODAY)).toEqual({ status: 'done', value: 2, ratio: 1 });
    expect(dayStatus(ctx, [la], D, TODAY)).toEqual({ status: 'partial', value: 1, ratio: 0.5 });
    expect(dayStatus(ctx, [], D, TODAY).status).toBe('missed');
  });

  it('slots come from the version effective on the date', () => {
    const ctx = mkCtx({
      versions: [mkVersion({ id: 'v1' }), mkVersion({ id: 'v2', effectiveFrom: '2026-01-06' })],
      slots: [slot('a', 0, 'v1'), slot('b', 0, 'v1'), slot('x', 0, 'v2')],
    });
    expect(dayStatus(ctx, [log({ slotId: 'a' })], D, TODAY).status).toBe('partial');
    expect(dayStatus(ctx, [log({ slotId: 'x', date: '2026-01-12' })], '2026-01-12', '2026-01-20').status).toBe('done');
  });

  it('count sums multiple logs; at least semantics', () => {
    const ctx = mkCtx({ goal: mkGoal({ trackingType: 'count', targetValue: 8 }) });
    expect(dayStatus(ctx, [log({ value: 3, status: 'partial' }), log({ value: 2, slotId: 's', status: 'partial' })], D, TODAY)).toEqual({ status: 'partial', value: 5, ratio: 5 / 8 });
    expect(dayStatus(ctx, [log({ value: 8 })], D, TODAY).status).toBe('done');
    const over = dayStatus(ctx, [log({ value: 12 })], D, TODAY);
    expect(over).toEqual({ status: 'done', value: 12, ratio: 1 });
  });

  it('skipped log beats progress', () => {
    const ctx = mkCtx({ goal: mkGoal({ trackingType: 'duration', targetValue: 30 }) });
    expect(dayStatus(ctx, [log({ value: 10, status: 'partial' }), log({ value: 0, status: 'skipped', slotId: 'z' })], D, TODAY).status).toBe('skipped');
  });

  it('partial on today stays partial; zero value is pending', () => {
    const ctx = mkCtx({ goal: mkGoal({ trackingType: 'count', targetValue: 4 }) });
    expect(dayStatus(ctx, [log({ value: 1, status: 'partial', date: TODAY })], TODAY, TODAY).status).toBe('partial');
    expect(dayStatus(ctx, [log({ value: 0, status: 'partial', date: TODAY })], TODAY, TODAY).status).toBe('pending');
  });
});
