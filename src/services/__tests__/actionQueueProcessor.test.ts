import { createTestDb } from '../../test/testDb';
import type { TrekDb } from '../../db/client';
import * as r from '../../db/repositories';
import { enqueueAction } from '../../db/repositories/pendingActions';
import { processPendingActions } from '../actionQueueProcessor';
import { actionFromResponse, recordResponse } from '../notifications/responses';
import { notificationsAdapter } from '../notifications/adapter';

jest.mock('../notifications/adapter', () => ({
  notificationsAdapter: { schedule: jest.fn(async () => 'x') },
}));

const TODAY = '2026-10-05';
let db: TrekDb;
let raw: ReturnType<typeof createTestDb>['raw'];
const schedule = notificationsAdapter.schedule as jest.Mock;

beforeEach(() => {
  schedule.mockClear();
  const t = createTestDb();
  db = t.db as unknown as TrekDb;
  raw = t.raw;
});

const act = (id: string, goalId: string, action: 'done' | 'increment' | 'snooze', createdAt: string) => ({
  id,
  source: 'notification' as const,
  goalId,
  date: TODAY,
  slotId: null,
  action,
  value: null,
  createdAt,
  processedAt: null,
});
const logValue = async (goalId: string) => (await r.listLogs(db, { goalId }))[0]?.value;

it('replays same id once', async () => {
  const g = await r.createGoal(db, { name: 'A', trackingType: 'count', targetValue: 5 }, TODAY);
  await enqueueAction(db, act('n:1:1:x', g.id, 'increment', '2026-10-05T10:00:00Z'));
  await enqueueAction(db, act('n:1:1:x', g.id, 'increment', '2026-10-05T10:00:00Z'));
  await processPendingActions(db);
  await processPendingActions(db);
  expect(await logValue(g.id)).toBe(1);
});

it('distinct increments add up', async () => {
  const g = await r.createGoal(db, { name: 'A', trackingType: 'count', targetValue: 5 }, TODAY);
  await enqueueAction(db, act('a', g.id, 'increment', '2026-10-05T10:00:00Z'));
  await enqueueAction(db, act('b', g.id, 'increment', '2026-10-05T10:00:01Z'));
  await processPendingActions(db);
  expect(await logValue(g.id)).toBe(2);
});

it('crash mid-batch: rerun applies only the second', async () => {
  const g = await r.createGoal(db, { name: 'A', trackingType: 'count', targetValue: 5 }, TODAY);
  await enqueueAction(db, act('a', g.id, 'increment', '2026-10-05T10:00:00Z'));
  await enqueueAction(db, act('b', g.id, 'increment', '2026-10-05T10:00:01Z'));
  // Simulate crash after first: mark only first processed via a real run with a failing second.
  raw.exec("CREATE TRIGGER boom BEFORE UPDATE ON logs BEGIN SELECT RAISE(ABORT, 'boom'); END");
  await expect(processPendingActions(db)).rejects.toBeTruthy();
  expect(await logValue(g.id)).toBe(1);
  expect((raw.prepare('SELECT processed_at p FROM pending_actions WHERE id=?').get('a') as { p: string | null }).p).toBeTruthy();
  expect((raw.prepare('SELECT processed_at p FROM pending_actions WHERE id=?').get('b') as { p: string | null }).p).toBeNull();
  raw.exec('DROP TRIGGER boom');
  await processPendingActions(db);
  expect(await logValue(g.id)).toBe(2);
});

it('snooze schedules s:<id> once even if processed twice', async () => {
  const g = await r.createGoal(db, { name: 'A', trackingType: 'check', targetValue: 1 }, TODAY);
  await enqueueAction(db, act('n:1:1:snooze', g.id, 'snooze', '2026-10-05T10:00:00Z'));
  await processPendingActions(db);
  await processPendingActions(db);
  expect(schedule).toHaveBeenCalledTimes(1);
  expect(schedule.mock.calls[0][0].identifier).toBe('s:n:1:1:snooze');
  expect(await logValue(g.id)).toBeUndefined();
});

it('deleted or archived goal: processed, no log', async () => {
  const g = await r.createGoal(db, { name: 'A', trackingType: 'check', targetValue: 1 }, TODAY);
  await r.archiveGoal(db, g.id);
  await enqueueAction(db, act('a', g.id, 'done', '2026-10-05T10:00:00Z'));
  await enqueueAction(db, act('b', 'missing', 'done', '2026-10-05T10:00:01Z'));
  await processPendingActions(db);
  expect(await logValue(g.id)).toBeUndefined();
  expect((raw.prepare('SELECT COUNT(*) c FROM pending_actions WHERE processed_at IS NULL').get() as { c: number }).c).toBe(0);
});

describe('responses', () => {
  const resp = (actionIdentifier: string, data: object, date = Date.UTC(2026, 9, 6, 1, 30) / 1000) =>
    ({ actionIdentifier, notification: { date, request: { identifier: 'req', content: { data } } } }) as never;

  it('maps actions, ignores default tap', () => {
    expect(actionFromResponse(resp('expo.modules.notifications.actions.DEFAULT', { goalId: 'g' }), 0)).toBeNull();
    const a = actionFromResponse(resp('mark-done', { goalId: 'g', date: '2026-10-05' }), 0)!;
    expect(a.action).toBe('done');
    expect(a.date).toBe('2026-10-05');
    expect(a.id).toMatch(/^n:req:\d+:mark-done$/);
    expect(actionFromResponse(resp('snooze', { goalId: 'g' }), 0)!.action).toBe('snooze');
  });

  it('falls back to logical date of delivery', () => {
    const d = new Date(Date.UTC(2026, 9, 6, 1, 30));
    const a = actionFromResponse(resp('mark-done', { goalId: 'g' }), 3)!;
    expect(a.date).toBe(
      require('../../domain/dayBoundary').logicalDate(d, 3),
    );
  });

  it('recordResponse is idempotent', async () => {
    const g = await r.createGoal(db, { name: 'A', trackingType: 'count', targetValue: 5 }, TODAY);
    const x = resp('mark-done', { goalId: g.id, date: TODAY });
    await recordResponse(db, x, 0);
    await recordResponse(db, x, 0);
    expect(await logValue(g.id)).toBe(5);
    expect((raw.prepare('SELECT COUNT(*) c FROM pending_actions').get() as { c: number }).c).toBe(1);
  });
});
