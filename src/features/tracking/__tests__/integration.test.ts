import { completion } from '../../../domain/statsCalculator';
import { logicalDate } from '../../../domain/dayBoundary';
import { dayStatus } from '../../../domain/dayStatus';
import { createTestDb } from '../../../test/testDb';
import type { TrekDb } from '../../../db/client';
import { addScheduleVersion, createGoal, listLogs, upsertLog } from '../../../db/repositories';
import { loadGoalContexts } from '../../goals/goalContexts';

let db: TrekDb;
beforeEach(() => {
  db = createTestDb().db as unknown as TrekDb;
});

describe('logical day', () => {
  it('01:30 with dayEndsAt 3 logs against the previous day', async () => {
    const now = new Date(2026, 9, 5, 1, 30);
    const date = logicalDate(now, 3);
    expect(date).toBe('2026-10-04');
    const g = await createGoal(db, { name: 'Read', startDate: '2026-10-01' }, '2026-10-01');
    await upsertLog(db, { goalId: g.id, date, value: 1, status: 'done' });
    const logs = await listLogs(db, { goalId: g.id });
    expect(logs.map((l) => l.date)).toEqual(['2026-10-04']);
    const [ctx] = await loadGoalContexts(db, { dayEndsAt: 3 });
    expect(dayStatus(ctx, logs, '2026-10-04', date).status).toBe('done');
  });
});

describe('schedule versioning', () => {
  it('a new version effective today leaves past completion identical', async () => {
    const g = await createGoal(db, { name: 'Run', startDate: '2026-09-01' }, '2026-09-01');
    for (const d of ['2026-09-28', '2026-09-30', '2026-10-02']) {
      await upsertLog(db, { goalId: g.id, date: d, value: 1, status: 'done' });
    }
    const today = '2026-10-05';
    const range = ['2026-09-28', '2026-10-03'] as const;
    const before = completion(await loadGoalContexts(db), await listLogs(db), range[0], range[1], today, 'weighted', 1);
    await addScheduleVersion(db, g.id, today, { scheduleType: 'weekdays', scheduleDays: 31 });
    const ctxs = await loadGoalContexts(db);
    expect(ctxs[0].versions).toHaveLength(2);
    const after = completion(ctxs, await listLogs(db), range[0], range[1], today, 'weighted', 1);
    expect(after).toEqual(before);
    expect(before.done).toBeGreaterThan(0);
  });
});
