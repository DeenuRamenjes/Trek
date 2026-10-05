import type { TrekDb } from '../../../db/client';
import { createGoal, createVacation, endVacationNow, upsertLog } from '../../../db/repositories';
import { listLogs, listVacations } from '../../../db/repositories';
import { vacationCovers } from '../../../domain/vacationRules';
import { completion } from '../../../domain/statsCalculator';
import { currentStreak } from '../../../domain/streaks';
import { createTestDb } from '../../../test/testDb';
import { loadGoalContexts } from '../../goals/goalContexts';

const mk = (db: TrekDb, name: string) =>
  createGoal(db, { name, icon: 'flag', color: '#2E7D5B', startDate: '2026-09-01' } as never, '2026-09-01');
const done = (db: TrekDb, goalId: string, date: string) =>
  upsertLog(db, { goalId, date, value: 1, status: 'done' } as never);

describe('vacation integration', () => {
  it('is neutral for streaks and excluded from stats denominators', async () => {
    const db = createTestDb().db as unknown as TrekDb;
    const g = await mk(db, 'A');
    for (const d of ['2026-09-10', '2026-09-11', '2026-09-14', '2026-09-15']) await done(db, g.id, d);
    await createVacation(db, { startDate: '2026-09-12', endDate: '2026-09-13', scope: 'all' });
    const [ctx] = await loadGoalContexts(db);
    const logs = await listLogs(db, { goalId: g.id });
    // no log on the vacation days, streak still runs across them
    expect(currentStreak(ctx, logs, '2026-09-15', 1)).toBe(2 + 2);
    const c = completion([ctx], logs, '2026-09-10', '2026-09-15', '2026-09-15', 'weighted', 1);
    expect(c.denominator).toBe(4);
    expect(c.percent).toBe(100);
  });

  it('selected scope affects only selected goals', async () => {
    const db = createTestDb().db as unknown as TrekDb;
    const a = await mk(db, 'A');
    const b = await mk(db, 'B');
    await createVacation(db, { startDate: '2026-09-12', endDate: '2026-09-13', scope: 'selected', goalIds: [a.id] });
    const ctxs = await loadGoalContexts(db);
    const [ca, cb] = [ctxs.find((c) => c.goal.id === a.id)!, ctxs.find((c) => c.goal.id === b.id)!];
    expect(completion([ca], [], '2026-09-12', '2026-09-13', '2026-09-15', 'weighted', 1).denominator).toBe(0);
    expect(completion([cb], [], '2026-09-12', '2026-09-13', '2026-09-15', 'weighted', 1).denominator).toBe(2);
  });

  it('end now ends at yesterday', async () => {
    const db = createTestDb().db as unknown as TrekDb;
    const g = await mk(db, 'A');
    const v = await createVacation(db, { startDate: '2026-09-10', endDate: '2026-09-20', scope: 'all' });
    await endVacationNow(db, v.id, '2026-09-15');
    const list = await listVacations(db);
    expect(list[0].endDate).toBe('2026-09-14');
    expect(vacationCovers(list as never, g.id, '2026-09-14')).toBe(true);
    expect(vacationCovers(list as never, g.id, '2026-09-15')).toBe(false);
  });
});
