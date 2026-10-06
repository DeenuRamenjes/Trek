import { coalesce } from '../lifecycle';
import { routeFromResponse, DEFAULT_ACTION, actionFromResponse } from '../responses';
import { renderContent } from '../content';
import type { PlannedReminder } from '../../../domain/reminderPlanner';

const resp = (actionIdentifier: string, data: Record<string, unknown>, date = 1791187200) =>
  ({ actionIdentifier, notification: { date, request: { identifier: 'req1', content: { data } } } }) as never;

describe('coalesce', () => {
  it('never overlaps and reruns once', async () => {
    let active = 0;
    let max = 0;
    let runs = 0;
    const call = coalesce(async () => {
      runs++;
      active++;
      max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 10));
      active--;
    });
    await Promise.all([call(), call(), call(), call()]);
    expect(max).toBe(1);
    expect(runs).toBe(2);
    await call();
    expect(runs).toBe(3);
  });
});

describe('routeFromResponse', () => {
  it('maps trek urls on default tap', () => {
    expect(routeFromResponse(resp(DEFAULT_ACTION, { url: 'trek://review/week-2026-10-11' }))).toBe('/review/week-2026-10-11');
    expect(routeFromResponse(resp(DEFAULT_ACTION, { url: 'trek://today' }))).toBe('/today');
    expect(routeFromResponse(resp(DEFAULT_ACTION, { url: 'trek://settings' }))).toBe('/settings');
  });
  it('null for buttons, missing or foreign urls', () => {
    expect(routeFromResponse(resp('mark-done', { url: 'trek://today' }))).toBeNull();
    expect(routeFromResponse(resp(DEFAULT_ACTION, {}))).toBeNull();
    expect(routeFromResponse(resp(DEFAULT_ACTION, { url: 'https://x.y' }))).toBeNull();
  });
});

describe('slot carried through content', () => {
  const p: PlannedReminder = {
    id: 'goal:r1:x',
    kind: 'date',
    at: '2026-10-06T08:00:00.000Z',
    category: 'goal',
    contentKey: 'goalReminder',
    goalId: 'g1',
    goalName: 'Water',
    slotId: 's2',
    date: '2026-10-06',
    priority: 0,
    nextAt: '2026-10-06T08:00:00.000Z',
  };
  it('mark done marks that slot and date', () => {
    const { data } = renderContent(p, { appLockEnabled: false });
    expect(data).toMatchObject({ goalId: 'g1', slotId: 's2', date: '2026-10-06' });
    const row = actionFromResponse(resp('mark-done', data), 0);
    expect(row).toMatchObject({ goalId: 'g1', slotId: 's2', date: '2026-10-06', action: 'done' });
  });
});
