import { createTestDb } from '../../../test/testDb';
import type { TrekDb } from '../../../db/client';
import * as r from '../../../db/repositories';
import { DEFAULT_SETTINGS, type Settings } from '../../../domain/settings';
import { reconcile, type ReconcilerAdapter } from '../reconciler';
import { toExpoWeekday } from '../weekday';
import { notificationUrl } from '../url';

type Req = { identifier: string; content: { title: string; body: string; data: Record<string, unknown> }; trigger: unknown };

function fakeAdapter(initial: Req[] = []) {
  const store = new Map<string, Req>(initial.map((q) => [q.identifier, q]));
  const adapter = {
    schedule: jest.fn(async (req: Req) => {
      store.set(req.identifier, req);
      return req.identifier;
    }),
    cancel: jest.fn(async (id: string) => {
      store.delete(id);
    }),
    listScheduled: jest.fn(async () => [...store.values()]),
    setChannel: jest.fn(async () => null),
    deleteChannel: jest.fn(async () => undefined),
    listChannels: jest.fn(async () => []),
  };
  return { adapter: adapter as unknown as ReconcilerAdapter, store, mocks: adapter };
}

// Monday 2026-10-05 08:00 local.
const NOW = new Date(2026, 9, 5, 8, 0);
const TODAY = '2026-10-05';
const settings = (patch: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  reviewNotifications: { weekly: false, monthly: false },
  backupReminderFrequency: 'off',
  ...patch,
});
let db: TrekDb;
beforeEach(() => {
  db = createTestDb().db as unknown as TrekDb;
});

async function goalWithDaily(name: string, times: string[], days = [0, 1, 2, 3, 4, 5, 6]) {
  const g = await r.createGoal(db, { name }, TODAY);
  await r.setReminders(
    db,
    g.id,
    days.flatMap((weekday) => times.map((time) => ({ weekday, time }))),
  );
  return g;
}

it('weekday mapping covers all 7 days', () => {
  expect([0, 1, 2, 3, 4, 5, 6].map(toExpoWeekday)).toEqual([2, 3, 4, 5, 6, 7, 1]);
});

it('notificationUrl maps routes', () => {
  expect(notificationUrl({ route: 'review/week', date: '2026-10-11' })).toBe('trek://review/week-2026-10-11');
  expect(notificationUrl({ route: 'review/month', date: '2026-11-01' })).toBe('trek://review/month-2026-11');
  expect(notificationUrl({ route: 'backup' })).toBe('trek://settings');
  expect(notificationUrl({ route: 'today' })).toBe('trek://today');
  expect(notificationUrl(undefined)).toBe('trek://today');
});

it('second run with no change makes no schedule or cancel calls', async () => {
  await goalWithDaily('Read', ['20:00']);
  const f = fakeAdapter();
  const first = await reconcile({ db, adapter: f.adapter, settings: settings(), now: NOW });
  expect(first.scheduled).toBe(7);
  f.mocks.schedule.mockClear();
  f.mocks.cancel.mockClear();
  const second = await reconcile({ db, adapter: f.adapter, settings: settings(), now: NOW });
  expect(second).toMatchObject({ scheduled: 0, cancelled: 0 });
  expect(f.mocks.schedule).not.toHaveBeenCalled();
  expect(f.mocks.cancel).not.toHaveBeenCalled();
});

it('goal rename reschedules only that goal ids', async () => {
  const a = await goalWithDaily('A', ['20:00'], [0]);
  await goalWithDaily('B', ['20:00'], [1]);
  const f = fakeAdapter();
  await reconcile({ db, adapter: f.adapter, settings: settings(), now: NOW });
  f.mocks.schedule.mockClear();
  await r.updateGoal(db, a.id, { name: 'A2' });
  const res = await reconcile({ db, adapter: f.adapter, settings: settings(), now: NOW });
  expect(res.scheduled).toBe(1);
  expect(f.mocks.schedule.mock.calls[0][0].content.title).toBe('A2');
});

it('cancels notifications that are no longer desired but keeps snoozes', async () => {
  await goalWithDaily('A', ['20:00'], [0]);
  const stale = { identifier: 'goal:gone:weekly', content: { title: 'x', body: 'y', data: {} }, trigger: null };
  const snooze = { identifier: 's:n:1:1:snooze', content: { title: 'x', body: 'y', data: {} }, trigger: null };
  const f = fakeAdapter([stale, snooze]);
  const res = await reconcile({ db, adapter: f.adapter, settings: settings(), now: NOW });
  expect(res.cancelled).toBe(1);
  expect(f.store.has('s:n:1:1:snooze')).toBe(true);
  expect(f.store.has('goal:gone:weekly')).toBe(false);
});

it('12 goals x 3 slots x 7 days stays at 64 or fewer', async () => {
  for (let i = 0; i < 12; i++) await goalWithDaily(`G${i}`, ['08:30', '13:00', '20:00']);
  const f = fakeAdapter();
  const res = await reconcile({ db, adapter: f.adapter, settings: settings(), now: NOW });
  expect(res.desired).toBeLessThanOrEqual(64);
  expect(f.store.size).toBeLessThanOrEqual(64);
});

it('snoozes count against the cap', async () => {
  for (let i = 0; i < 12; i++) await goalWithDaily(`G${i}`, ['08:30', '13:00', '20:00']);
  const snoozes = Array.from({ length: 5 }, (_, i) => ({
    identifier: `s:${i}`,
    content: { title: 'x', body: 'y', data: {} },
    trigger: null,
  }));
  const f = fakeAdapter(snoozes);
  await reconcile({ db, adapter: f.adapter, settings: settings(), now: NOW });
  expect(f.store.size).toBeLessThanOrEqual(64);
  expect(f.store.size).toBe(64);
});

it('vacation range suppresses occurrences', async () => {
  await goalWithDaily('A', ['20:00'], [0, 1, 2, 3, 4, 5, 6]);
  await r.createVacation(db, { startDate: '2026-10-06', endDate: '2026-10-08', scope: 'all' });
  const f = fakeAdapter();
  await reconcile({ db, adapter: f.adapter, settings: settings(), now: NOW });
  const ids = [...f.store.keys()].filter((id) => id.startsWith('goal:'));
  const fires = [...f.store.values()]
    .map((q) => q.trigger as { date?: Date; type: string })
    .filter((t) => t.type === 'date')
    .map((t) => (t.date as Date).getDate());
  expect(ids.length).toBeGreaterThan(0);
  expect(fires).not.toContain(6);
  expect(fires.length).toBeGreaterThan(0);
  expect(fires).not.toContain(7);
  expect(fires).not.toContain(8);
});

it('review reminders follow settings toggles', async () => {
  const f = fakeAdapter();
  await reconcile({ db, adapter: f.adapter, settings: settings({ reviewNotifications: { weekly: true, monthly: true } }), now: NOW });
  const ids = [...f.store.keys()];
  expect(ids).toContain('review:weekly');
  expect(ids.some((i) => i.startsWith('review:monthly:'))).toBe(true);
  const weekly = f.store.get('review:weekly') as Req;
  expect(weekly.content.data.url).toBe('trek://review/week-2026-10-11');

  const g = fakeAdapter();
  await reconcile({ db, adapter: g.adapter, settings: settings({ reviewNotifications: { weekly: false, monthly: false } }), now: NOW });
  expect(g.store.size).toBe(0);
});

it('backup reminder when overdue', async () => {
  const f = fakeAdapter();
  const s = settings({ backupReminderFrequency: 'weekly', lastBackupAt: new Date(2026, 8, 1).toISOString() });
  await reconcile({ db, adapter: f.adapter, settings: s, now: NOW });
  const id = [...f.store.keys()].find((i) => i.startsWith('backup:'));
  expect(id).toBeDefined();
  expect((f.store.get(id as string) as Req).content.data.url).toBe('trek://settings');
  const g = fakeAdapter();
  await reconcile({ db, adapter: g.adapter, settings: settings({ backupReminderFrequency: 'weekly', lastBackupAt: NOW.toISOString() }), now: NOW });
  expect(g.store.size).toBe(0);
});

it('app lock on gives a generic body and never carries notes', async () => {
  await goalWithDaily('Read', ['20:00'], [0]);
  const off = fakeAdapter();
  await reconcile({ db, adapter: off.adapter, settings: settings(), now: NOW });
  const on = fakeAdapter();
  await reconcile({
    db,
    adapter: on.adapter,
    settings: settings({ appLock: { ...DEFAULT_SETTINGS.appLock, enabled: true } }),
    now: NOW,
  });
  const offReq = [...off.store.values()][0];
  const onReq = [...on.store.values()][0];
  expect(offReq.content.body).toBe('Time to check in');
  expect(onReq.content.body).toBe('Reminder');
  expect(onReq.content.title).toBe('Read');
  expect(JSON.stringify(onReq.content)).not.toContain('note');
});

it('lock toggle reschedules goal reminders', async () => {
  await goalWithDaily('Read', ['20:00'], [0]);
  const f = fakeAdapter();
  await reconcile({ db, adapter: f.adapter, settings: settings(), now: NOW });
  const res = await reconcile({
    db,
    adapter: f.adapter,
    settings: settings({ appLock: { ...DEFAULT_SETTINGS.appLock, enabled: true } }),
    now: NOW,
  });
  expect(res.scheduled).toBe(1);
});

it('android syncs channels per goal and removes deleted goal channels', async () => {
  const g = await goalWithDaily('Read', ['20:00'], [0]);
  const f = fakeAdapter();
  f.mocks.listChannels.mockResolvedValue([{ id: 'goal-old' }, { id: 'goal-' + g.id }, { id: 'other' }] as never);
  await reconcile({ db, adapter: f.adapter, settings: settings(), now: NOW, platform: 'android' });
  const ids = f.mocks.setChannel.mock.calls.map((c) => (c as unknown as [string])[0]);
  expect(ids).toEqual(expect.arrayContaining(['reviews', 'backup', `goal-${g.id}`]));
  expect(f.mocks.deleteChannel).toHaveBeenCalledTimes(1);
  expect(f.mocks.deleteChannel).toHaveBeenCalledWith('goal-old');
  const ios = fakeAdapter();
  await reconcile({ db, adapter: ios.adapter, settings: settings(), now: NOW, platform: 'ios' });
  expect(ios.mocks.setChannel).not.toHaveBeenCalled();
});
