import { createTestDb } from '../../../test/testDb';
import type { TrekDb } from '../../../db/client';
import { archiveGoal, createGoal, createVacation, pauseGoal } from '../../../db/repositories';
import { loadGoalContexts } from '../goalContexts';

describe('loadGoalContexts', () => {
  it('loads versions, pauses, vacations and hides archived by default', async () => {
    const db = createTestDb().db as unknown as TrekDb;
    const a = await createGoal(db, { name: 'A', sortOrder: 1 }, '2026-10-01');
    const b = await createGoal(db, { name: 'B', sortOrder: 0 }, '2026-10-01');
    const c = await createGoal(db, { name: 'C' }, '2026-10-01');
    await archiveGoal(db, c.id);
    await pauseGoal(db, a.id, '2026-10-02');
    await createVacation(db, { startDate: '2026-10-03', endDate: '2026-10-04', scope: 'all' });
    const ctxs = await loadGoalContexts(db, { dayEndsAt: 2 });
    expect(ctxs.map((x) => x.goal.name)).toEqual(['B', 'A']);
    expect(ctxs[0].dayEndsAt).toBe(2);
    expect(ctxs[0].versions).toHaveLength(1);
    expect(ctxs[1].pauses).toHaveLength(1);
    expect(ctxs[0].vacations).toHaveLength(1);
    expect(await loadGoalContexts(db, { includeArchived: true })).toHaveLength(3);
  });
});
