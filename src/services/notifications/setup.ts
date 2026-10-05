import { getDb } from '../../db/client';
import { useSettings } from '../../features/settings/settingsStore';
import { strings } from '../../strings/en';
import { notificationsAdapter, type NotificationResponse } from './adapter';
import { recordResponse, MARK_DONE_ACTION, SNOOZE_ACTION } from './responses';

export const RESPONSE_TASK = 'trek-notification-response';
export const GOAL_CATEGORY = 'goal-reminder';

async function handle(response: NotificationResponse): Promise<void> {
  try {
    await recordResponse(getDb() as never, response, useSettings.getState().settings.dayEndsAt);
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
