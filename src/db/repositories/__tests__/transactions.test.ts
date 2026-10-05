import { createTestDb } from '../../../test/testDb';
import type { TrekDb } from '../../client';
import { withTransaction } from '../../transaction';
import * as r from '..';

let db: TrekDb;
let raw: ReturnType<typeof createTestDb>['raw'];
const count = (table: string) => (raw.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;

beforeEach(() => {
  const t = createTestDb();
  db = t.db as unknown as TrekDb;
  raw = t.raw;
});

describe('withTransaction', () => {
  it('serializes concurrent calls on the same db so both commit', async () => {
    const a = withTransaction(db, async (tx) => {
      await r.createGroup(tx, { name: 'A', color: '#111111', icon: 'star' });
      await new Promise((res) => setTimeout(res, 20));
      await r.createGroup(tx, { name: 'A2', color: '#111111', icon: 'star' });
    });
    const b = withTransaction(db, async (tx) => {
      await r.createGroup(tx, { name: 'B', color: '#111111', icon: 'star' });
    });
    await expect(Promise.all([a, b])).resolves.toBeDefined();
    expect(count('groups')).toBe(3);
  });

  it('commits on success and returns the result', async () => {
    const out = await withTransaction(db, async (tx) => (await r.createGroup(tx, { name: 'A', color: '#111111', icon: 'star' })).name);
    expect(out).toBe('A');
    expect(count('groups')).toBe(1);
  });

  it('rolls back a write followed by a throw and rethrows', async () => {
    await expect(
      withTransaction(db, async (tx) => {
        await r.createGroup(tx, { name: 'A', color: '#111111', icon: 'star' });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(count('groups')).toBe(0);
    expect(raw.isTransaction).toBe(false);
  });

  it('setGroupGoals with a bad goal id keeps the old links', async () => {
    const g = await r.createGoal(db, { name: 'G' }, '2026-10-05');
    const grp = await r.createGroup(db, { name: 'A', color: '#111111', icon: 'star' });
    await r.setGroupGoals(db, grp.id, [g.id]);
    raw.exec('PRAGMA foreign_keys = ON');
    await expect(r.setGroupGoals(db, grp.id, ['missing-goal'])).rejects.toThrow();
    expect(await r.listGroupGoals(db, grp.id)).toEqual([{ groupId: grp.id, goalId: g.id }]);
  });
});
