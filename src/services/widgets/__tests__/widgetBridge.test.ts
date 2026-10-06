import { createTestDb } from '../../../test/testDb';
import type { TrekDb } from '../../../db/client';
import * as r from '../../../db/repositories';
import { DEFAULT_SETTINGS, type Settings } from '../../../domain/settings';
import { processPendingActions, onActionsApplied } from '../../actionQueueProcessor';
import { createWidgetBridge } from '../bridge';
import type { WidgetsAdapter, WidgetPayload } from '../adapter';

const TODAY = '2026-10-05';
const NOW = new Date(2026, 9, 5, 12, 0, 0);
let db: TrekDb;
let pushed: WidgetPayload[];
let incoming: unknown[];
let adapter: WidgetsAdapter;
let settings: Settings;

beforeEach(() => {
  db = createTestDb().db as unknown as TrekDb;
  pushed = [];
  incoming = [];
  settings = { ...DEFAULT_SETTINGS };
  adapter = {
    pushSnapshot: jest.fn(async (p: WidgetPayload) => {
      pushed.push(p);
    }),
    readPendingActions: jest.fn(async () => incoming as never),
  };
});

const bridge = () => createWidgetBridge({ db, adapter, getSettings: () => settings, now: () => NOW });

it('snapshot respects group and hideGoalNames, carries both theme colors', async () => {
  const a = await r.createGoal(db, { name: 'Alpha', trackingType: 'check' }, TODAY);
  await r.createGoal(db, { name: 'Beta', trackingType: 'check' }, TODAY);
  const g = await r.createGroup(db, { name: 'G', color: '#2E7D5B', icon: 'x' });
  await r.setGroupGoals(db, g.id, [a.id]);
  settings = { ...settings, widget: { hideGoalNames: true, groupId: g.id } };
  await bridge().refreshWidgets();
  const p = pushed[0];
  expect(p.snapshot.total).toBe(1);
  expect(p.snapshot.items[0].goalId).toBe(a.id);
  expect(p.snapshot.items[0].name).toBeNull();
  expect(p.colors.light.background).not.toBe(p.colors.dark.background);
  expect(p.pendingActions).toEqual([]);
});

it('missing group falls back to all goals', async () => {
  await r.createGoal(db, { name: 'Alpha', trackingType: 'check' }, TODAY);
  settings = { ...settings, widget: { hideGoalNames: false, groupId: 'gone' } };
  await bridge().refreshWidgets();
  expect(pushed[0].snapshot.items[0].name).toBe('Alpha');
});

it('imports ios props actions once, then processes them into a log', async () => {
  const goal = await r.createGoal(db, { name: 'Alpha', trackingType: 'check' }, TODAY);
  incoming = [
    { id: 'w:abc', goalId: goal.id, slotId: null, date: TODAY, action: 'done' },
    { id: 'w:bad', goalId: goal.id, date: TODAY, action: 'nope' },
  ];
  const b = bridge();
  expect(await b.importWidgetActions()).toBe(1);
  expect(await b.importWidgetActions()).toBe(1);
  expect(await r.listUnprocessed(db)).toHaveLength(1);
  expect((await r.listUnprocessed(db))[0].source).toBe('widget');
  await processPendingActions(db, NOW);
  expect(await r.listLogs(db, { goalId: goal.id })).toHaveLength(1);
  await processPendingActions(db, NOW);
  expect(await r.listLogs(db, { goalId: goal.id })).toHaveLength(1);
});

it('refresh after log change reflects done and pending actions are dropped from pushed props', async () => {
  const goal = await r.createGoal(db, { name: 'Alpha', trackingType: 'check' }, TODAY);
  incoming = [{ id: 'w:1', goalId: goal.id, slotId: null, date: TODAY, action: 'done' }];
  const b = bridge();
  const off = onActionsApplied(() => void b.refreshWidgets());
  await b.importWidgetActions();
  await processPendingActions(db, NOW);
  await new Promise((res) => setTimeout(res, 20));
  off();
  expect(pushed.at(-1)?.snapshot.done).toBe(1);
  expect(pushed.at(-1)?.pendingActions).toEqual([]);
});
