import { actionKey, applyAction, processQueue } from '../actionQueue';
import type { PendingAction } from '../../db/schema';

const mk = (o: Partial<PendingAction> & { id: string }): PendingAction => ({
  source: 'widget', goalId: 'g1', date: '2026-10-05', slotId: null, action: 'done', value: null,
  createdAt: '2026-10-05T10:00:00.000Z', processedAt: null, ...o,
});
const count = { id: 'g1', trackingType: 'count' as const, targetValue: 8 };
const check = { id: 'g1', trackingType: 'check' as const, targetValue: 1 };

describe('actionKey', () => {
  const p = { source: 'widget' as const, goalId: 'g1', date: '2026-10-05', action: 'done' as const, nonce: 'n1' };
  it('is deterministic', () => expect(actionKey(p)).toBe(actionKey({ ...p })));
  it('differs by nonce, slot, action', () => {
    const keys = new Set([actionKey(p), actionKey({ ...p, nonce: 'n2' }), actionKey({ ...p, slotId: 's1' }), actionKey({ ...p, action: 'skip' })]);
    expect(keys.size).toBe(4);
  });
  it('null and undefined slot match', () => expect(actionKey({ ...p, slotId: null })).toBe(actionKey(p)));
});

describe('applyAction', () => {
  it('done sets target value and status', () => {
    expect(applyAction({ goal: count }, mk({ id: 'a', action: 'done' }))).toEqual({
      kind: 'log', upsert: { goalId: 'g1', date: '2026-10-05', slotId: null, value: 8, status: 'done', note: null },
    });
  });
  it('done on check goal is value 1 and keeps the note', () => {
    const r = applyAction({ goal: check, existing: { value: 0, status: 'partial', note: 'hi' } }, mk({ id: 'a' }));
    expect(r).toMatchObject({ kind: 'log', upsert: { value: 1, status: 'done', note: 'hi' } });
  });
  it('done keeps a value already above the target', () => {
    const r = applyAction({ goal: count, existing: { value: 11, status: 'done', note: null } }, mk({ id: 'a', action: 'done' }));
    expect(r).toMatchObject({ upsert: { value: 11, status: 'done' } });
  });
  it('increment adds 1 and picks partial then done', () => {
    const r1 = applyAction({ goal: count }, mk({ id: 'a', action: 'increment' }));
    expect(r1).toMatchObject({ upsert: { value: 1, status: 'partial' } });
    const r2 = applyAction({ goal: count, existing: { value: 7, status: 'partial', note: null } }, mk({ id: 'b', action: 'increment' }));
    expect(r2).toMatchObject({ upsert: { value: 8, status: 'done' } });
  });
  it('increment is uncapped and honours value', () => {
    const r = applyAction({ goal: count, existing: { value: 8, status: 'done', note: null } }, mk({ id: 'a', action: 'increment', value: 2 }));
    expect(r).toMatchObject({ upsert: { value: 10, status: 'done' } });
  });
  it('increment after skip restarts from 0', () => {
    const r = applyAction({ goal: count, existing: { value: 0, status: 'skipped', note: null } }, mk({ id: 'a', action: 'increment' }));
    expect(r).toMatchObject({ upsert: { value: 1, status: 'partial' } });
  });
  it('skip', () => {
    expect(applyAction({ goal: count }, mk({ id: 'a', action: 'skip', slotId: 's1' }))).toMatchObject({
      kind: 'log', upsert: { value: 0, status: 'skipped', slotId: 's1' },
    });
  });
  it('snooze yields reschedule, no log (default 10 min)', () => {
    expect(applyAction({ goal: count }, mk({ id: 'a', action: 'snooze' }))).toEqual({
      kind: 'reschedule', goalId: 'g1', date: '2026-10-05', slotId: null, minutes: 10,
    });
  });
});

describe('processQueue', () => {
  it('same action twice yields one op', () => {
    expect(processQueue([mk({ id: 'k' }), mk({ id: 'k' })])).toHaveLength(1);
  });
  it('skips processed rows and known processed ids', () => {
    const ops = processQueue([mk({ id: 'a', processedAt: 'x' }), mk({ id: 'b' }), mk({ id: 'c' })], ['b']);
    expect(ops.map((o) => o.id)).toEqual(['c']);
  });
  it('orders by createdAt', () => {
    const ops = processQueue([
      mk({ id: 'late', createdAt: '2026-10-05T12:00:00.000Z' }),
      mk({ id: 'early', createdAt: '2026-10-05T08:00:00.000Z' }),
    ]);
    expect(ops.map((o) => o.id)).toEqual(['early', 'late']);
  });
  it('two widget increments with different nonces add up to +2', () => {
    const k1 = actionKey({ source: 'widget', goalId: 'g1', date: '2026-10-05', action: 'increment', nonce: '1' });
    const k2 = actionKey({ source: 'widget', goalId: 'g1', date: '2026-10-05', action: 'increment', nonce: '2' });
    const ops = processQueue([mk({ id: k1, action: 'increment' }), mk({ id: k2, action: 'increment', createdAt: '2026-10-05T10:00:01.000Z' }), mk({ id: k2, action: 'increment' })]);
    expect(ops).toHaveLength(2);
    let existing: { value: number; status: 'done' | 'partial' | 'skipped'; note: string | null } | null = null;
    for (const op of ops) {
      const r = applyAction({ goal: count, existing }, op);
      if (r.kind === 'log') existing = { value: r.upsert.value, status: r.upsert.status, note: r.upsert.note };
    }
    expect(existing).toMatchObject({ value: 2, status: 'partial' });
  });
  it('replaying the queue after processing applies nothing', () => {
    const rows = [mk({ id: 'a' }), mk({ id: 'b' })];
    const first = processQueue(rows);
    expect(processQueue(rows, first.map((o) => o.id))).toEqual([]);
  });
});
