import * as BackgroundTask from 'expo-background-task';
import { notificationsAdapter } from './adapter';
import { createRuntimeLifecycle } from './runtime';

export const BACKGROUND_TASK = 'trek-background-maintenance';
export const BACKGROUND_INTERVAL_MIN = 15;

// Module scope so headless launches define the task before it fires.
notificationsAdapter.defineTask(BACKGROUND_TASK, async () => {
  try {
    await createRuntimeLifecycle().runCycle();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

void notificationsAdapter.registerBackgroundTask(BACKGROUND_TASK, BACKGROUND_INTERVAL_MIN).catch(() => undefined);
