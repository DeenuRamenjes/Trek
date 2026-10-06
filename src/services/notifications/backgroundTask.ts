import { logCatch, logError } from '../errorLog';
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
  } catch (e) {
    void logError('backgroundTask', e);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

void notificationsAdapter.registerBackgroundTask(BACKGROUND_TASK, BACKGROUND_INTERVAL_MIN).catch(logCatch('backgroundTask.register'));
