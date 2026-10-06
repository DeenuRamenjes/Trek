import type { TrekDb } from '../../../db/client';
import { createGoal, listGoals, listGroupGoals, listGroups, reorderGroups } from '../../../db/repositories';
import { createTestDb } from '../../../test/testDb';
import { loadGroupFormValues, removeGroup, saveGroup } from '../saveGroup';

const newDb = () => createTestDb().db as unknown as TrekDb;
const goal = (db: TrekDb, name: string) => createGoal(db, { name, icon: 'flag', color: '#2E7D5B' } as never, '2026-10-01');
const base = { color: '#2e7d5b', icon: 'flag' };

describe('saveGroup', () => {
  it('creates a group with two goals', async () => {
    const db = newDb();
    const a = await goal(db, 'A');
    const b = await goal(db, 'B');
    const id = await saveGroup(db, null, { ...base, name: ' Health ', goalIds: [a.id, b.id] });
    const [g] = await listGroups(db);
    expect(g).toMatchObject({ id, name: 'Health', color: '#2E7D5B' });
    expect((await listGroupGoals(db, id)).map((l) => l.goalId).sort()).toEqual([a.id, b.id].sort());
  });

  it('rejects a blank name and writes nothing', async () => {
    const db = newDb();
    await expect(saveGroup(db, null, { ...base, name: '  ', goalIds: [] })).rejects.toThrow();
    expect(await listGroups(db)).toHaveLength(0);
  });

  it('lets a goal belong to two groups', async () => {
    const db = newDb();
    const a = await goal(db, 'A');
    const g1 = await saveGroup(db, null, { ...base, name: 'One', goalIds: [a.id] });
    const g2 = await saveGroup(db, null, { ...base, name: 'Two', goalIds: [a.id] });
    expect(await listGroupGoals(db)).toHaveLength(2);
    expect((await listGroupGoals(db, g1))[0].goalId).toBe(a.id);
    expect((await listGroupGoals(db, g2))[0].goalId).toBe(a.id);
  });

  it('edits membership and fields', async () => {
    const db = newDb();
    const a = await goal(db, 'A');
    const b = await goal(db, 'B');
    const id = await saveGroup(db, null, { ...base, name: 'One', goalIds: [a.id] });
    await saveGroup(db, id, { ...base, name: 'Renamed', goalIds: [b.id] });
    const values = await loadGroupFormValues(db, id);
    expect(values).toMatchObject({ name: 'Renamed', goalIds: [b.id] });
    expect(await listGroups(db)).toHaveLength(1);
  });

  it('appends new groups and reorders', async () => {
    const db = newDb();
    const x = await saveGroup(db, null, { ...base, name: 'X', goalIds: [] });
    const y = await saveGroup(db, null, { ...base, name: 'Y', goalIds: [] });
    expect((await listGroups(db)).map((g) => g.id)).toEqual([x, y]);
    await reorderGroups(db, [y, x]);
    expect((await listGroups(db)).map((g) => g.id)).toEqual([y, x]);
  });

  it('delete keeps goals', async () => {
    const db = newDb();
    const a = await goal(db, 'A');
    const id = await saveGroup(db, null, { ...base, name: 'One', goalIds: [a.id] });
    await removeGroup(db, id);
    expect(await listGroups(db)).toHaveLength(0);
    expect(await listGroupGoals(db)).toHaveLength(0);
    expect((await listGoals(db)).map((g) => g.id)).toEqual([a.id]);
  });
});
