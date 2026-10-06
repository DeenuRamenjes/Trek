import { createTestDb } from '../../../test/testDb';
import type { TrekDb } from '../../../db/client';
import * as r from '../../../db/repositories';
import { DEFAULT_SETTINGS } from '../../../domain/settings';
import { processPendingActions } from '../../actionQueueProcessor';
import { createAndroidWidgetHandler, type AndroidWidgetEvent } from '../androidHandler';
import { createWidgetBridge } from '../bridge';
import type { WidgetPayload, WidgetsAdapter } from '../adapter';

const TODAY = '2026-10-05';
const NOW = new Date(2026, 9, 5, 12, 0, 0);
const TAP = 'TREK_TAP';

let db: TrekDb;
let pushed: WidgetPayload[];
let iosProps: unknown[];
let adapter: WidgetsAdapter;

beforeEach(() => {
  db = createTestDb().db as unknown as TrekDb;
  pushed = [];
  iosProps = [];
  adapter = {
    pushSnapshot: jest.fn(async (p: WidgetPayload) => {
      pushed.push(p);
    }),
    readPendingActions: jest.fn(async () => iosProps),
  };
});

const bridge = () => createWidgetBridge({ db, adapter, getSettings: () => ({ ...DEFAULT_SETTINGS }), now: () => NOW });

function androidHandler(ids: string[]) {
  const b = bridge();
  const render = jest.fn((p: WidgetPayload) => p);
  const handler = createAndroidWidgetHandler({
    db,
    buildPayload: b.buildPayload,
    refreshWidgets: b.refreshWidgets,
    processPending: () => processPendingActions(db, NOW),
    newId: () => ids.shift() ?? 'x',
    now: () => NOW,
    render,
    tapAction: TAP,
  });
  return { handler, render };
}

const click = (data: Record<string, unknown>): AndroidWidgetEvent => ({
  widgetInfo: { width: 300 },
  widgetAction: 'WIDGET_CLICK',
  clickAction: TAP,
  clickActionData: data,
  renderWidget: jest.fn(),
});

it('android click -> pending_actions -> processor -> log -> refreshed snapshot', async () => {
  const goal = await r.createGoal(db, { name: 'Alpha', trackingType: 'check' }, TODAY);
  const { handler } = androidHandler(['uuid-1']);
  await handler(click({ goalId: goal.id, date: TODAY, action: 'done' }));
  const logs = await r.listLogs(db, { goalId: goal.id });
  expect(logs).toHaveLength(1);
  expect(logs[0].status).toBe('done');
  expect(await r.listUnprocessed(db)).toHaveLength(0);
  expect(pushed).toHaveLength(1);
  expect(pushed[0].snapshot).toMatchObject({ done: 1, total: 1 });
  expect(pushed[0].snapshot.items[0]).toMatchObject({ goalId: goal.id, status: 'done', progress: 1 });
});

it('android increment on a count goal adds one per tap', async () => {
  const goal = await r.createGoal(db, { name: 'Water', trackingType: 'count', targetValue: 4 }, TODAY);
  const { handler } = androidHandler(['a', 'b']);
  await handler(click({ goalId: goal.id, date: TODAY, action: 'increment' }));
  await handler(click({ goalId: goal.id, date: TODAY, action: 'increment' }));
  expect((await r.listLogs(db, { goalId: goal.id }))[0].value).toBe(2);
  expect(pushed.at(-1)!.snapshot.items[0]).toMatchObject({ increment: true, status: 'partial', progress: 0.5 });
});

it('android render events draw the current snapshot and ignore unknown clicks', async () => {
  const goal = await r.createGoal(db, { name: 'Alpha', trackingType: 'check' }, TODAY);
  const { handler, render } = androidHandler([]);
  const ev: AndroidWidgetEvent = { widgetInfo: { width: 120 }, widgetAction: 'WIDGET_UPDATE', renderWidget: jest.fn(), clickActionData: {} };
  await handler(ev);
  expect(render).toHaveBeenCalledWith(expect.objectContaining({ snapshot: expect.objectContaining({ total: 1 }) }), 120);
  await handler(click({ goalId: 'nope' }));
  await handler({ ...click({ goalId: goal.id, date: TODAY }), clickAction: 'OTHER' });
  expect(await r.listLogs(db, { goalId: goal.id })).toHaveLength(0);
});

it('ios props action -> import -> processor -> log -> refreshed snapshot', async () => {
  const goal = await r.createGoal(db, { name: 'Alpha', trackingType: 'check' }, TODAY);
  iosProps = [{ id: 'w:ios1', goalId: goal.id, slotId: null, date: TODAY, action: 'done' }];
  await bridge().refreshWidgets();
  expect(await r.listUnprocessed(db)).toHaveLength(1);
  await processPendingActions(db, NOW);
  expect(await r.listLogs(db, { goalId: goal.id })).toHaveLength(1);
  await bridge().refreshWidgets();
  expect(pushed.at(-1)!.snapshot).toMatchObject({ done: 1, total: 1 });
});

it('duplicate delivery is applied once on both platforms', async () => {
  const goal = await r.createGoal(db, { name: 'Water', trackingType: 'count', targetValue: 5 }, TODAY);
  // iOS: the same props entry is read on every import and refresh.
  iosProps = [{ id: 'w:dup', goalId: goal.id, slotId: null, date: TODAY, action: 'increment' }];
  const b = bridge();
  await b.refreshWidgets();
  await b.refreshWidgets();
  await processPendingActions(db, NOW);
  await processPendingActions(db, NOW);
  await b.refreshWidgets();
  await processPendingActions(db, NOW);
  expect((await r.listLogs(db, { goalId: goal.id }))[0].value).toBe(1);

  // Android: a replayed row with the same id is a single row and a single increment.
  const row = { id: 'w:android-dup', source: 'widget' as const, goalId: goal.id, date: TODAY, slotId: null, action: 'increment' as const, value: null, createdAt: NOW.toISOString(), processedAt: null };
  await r.enqueueAction(db, row);
  await r.enqueueAction(db, row);
  await processPendingActions(db, NOW);
  await processPendingActions(db, NOW);
  expect((await r.listLogs(db, { goalId: goal.id }))[0].value).toBe(2);
});
