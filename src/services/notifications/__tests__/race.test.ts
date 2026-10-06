import { createTestDb } from '../../../test/testDb';
import type { TrekDb } from '../../../db/client';
import * as r from '../../../db/repositories';
import { enqueueAction } from '../../../db/repositories/pendingActions';
import { onActionsApplied, processPendingActions } from '../../actionQueueProcessor';
import { notificationsAdapter } from '../adapter';

jest.mock('../adapter', () => ({ notificationsAdapter: { schedule: jest.fn(async () => 'x') } }));

const TODAY = '2026-10-05';
const schedule = notificationsAdapter.schedule as jest.Mock;
let db: TrekDb;
beforeEach(() => {
  schedule.mockClear();
  db = createTestDb().db as unknown as TrekDb;
});
const row = (id: string, goalId: string, action: 'increment' | 'snooze') => ({
  id,
  source: 'notification' as const,
  goalId,
  date: TODAY,
  slotId: null,
  action,
  value: null,
  createdAt: '2026-10-05T08:00:00.000Z',
  processedAt: null,
});

it('concurrent runs apply an increment once and notify listeners', async () => {
  const g = await r.createGoal(db, { name: 'Water', trackingType: 'count', targetValue: 8 }, TODAY);
  await enqueueAction(db, row('n:a:1:increment', g.id, 'increment'));
  const seen: number[] = [];
  const off = onActionsApplied((n) => seen.push(n));
  const counts = await Promise.all([processPendingActions(db), processPendingActions(db)]);
  off();
  expect(counts.reduce((a, b) => a + b, 0)).toBe(1);
  expect(seen).toEqual([1]);
  const logs = await r.listLogs(db, { from: TODAY });
  expect(logs.map((l) => l.value)).toEqual([1]);
});

it('concurrent runs schedule a snooze once', async () => {
  const g = await r.createGoal(db, { name: 'Water' }, TODAY);
  await enqueueAction(db, row('n:b:1:snooze', g.id, 'snooze'));
  await Promise.all([processPendingActions(db), processPendingActions(db)]);
  expect(schedule).toHaveBeenCalledTimes(1);
});
