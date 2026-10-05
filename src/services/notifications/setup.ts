import { router, type Href } from 'expo-router';
import { getDb, type TrekDb } from '../../db/client';
import { useSettings } from '../../features/settings/settingsStore';
import { strings } from '../../strings/en';
import { notificationsAdapter, type NotificationResponse } from './adapter';
import { GOAL_CATEGORY, RESPONSE_TASK } from './categories';
import './runtime';
import { recordResponse, routeFromResponse, MARK_DONE_ACTION, SNOOZE_ACTION } from './responses';

export { GOAL_CATEGORY, RESPONSE_TASK };

function navigate(path: string, retries = 3): void {
  try {
    router.push(path as Href);
  } catch {
    // Router not mounted yet (cold start): retry shortly.
    if (retries > 0) setTimeout(() => navigate(path, retries - 1), 500);
  }
}

async function handle(response: NotificationResponse): Promise<void> {
  const route = routeFromResponse(response);
  if (route) navigate(route);
  try {
    const db: TrekDb = getDb();
    await recordResponse(db, response, useSettings.getState().settings.dayEndsAt);
  } catch {
    // Row stays pending (or was never enqueued); it is retried on next start or foreground.
  }
}

// Module scope: must run before first render and in headless background launches.
notificationsAdapter.setHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

notificationsAdapter.defineTask(RESPONSE_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const response = (data as { actionIdentifier?: string; notification?: unknown }).actionIdentifier
    ? (data as unknown as NotificationResponse)
    : null;
  if (response) await handle(response);
});

void notificationsAdapter.registerResponseTask(RESPONSE_TASK).catch(() => undefined);
void notificationsAdapter
  .setCategory(GOAL_CATEGORY, [
    { identifier: MARK_DONE_ACTION, buttonTitle: strings.notifications.markDone, options: { opensAppToForeground: false } },
    { identifier: SNOOZE_ACTION, buttonTitle: strings.notifications.snooze, options: { opensAppToForeground: false } },
  ])
  .catch(() => undefined);

notificationsAdapter.addResponseListener((r) => void handle(r));
void notificationsAdapter
  .getLastResponse()
  .then((r) => (r ? handle(r) : undefined))
  .catch(() => undefined);
