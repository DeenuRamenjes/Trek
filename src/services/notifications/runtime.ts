import { getDb, type TrekDb } from '../../db/client';
import { useSettings } from '../../features/settings/settingsStore';
import { processPendingActions } from '../actionQueueProcessor';
import { refreshWidgets } from '../widgetBridge';
import { notificationsAdapter } from './adapter';
import { createLifecycle } from './lifecycle';
import { reconcile } from './reconciler';

/** Wires the lifecycle to the real db, settings store and adapter. */
export function createRuntimeLifecycle(debounceMs?: number) {
  return createLifecycle({
    processActions: () => {
      const db: TrekDb = getDb();
      return processPendingActions(db);
    },
    reconcile: () => {
      const db: TrekDb = getDb();
      return reconcile({ db, adapter: notificationsAdapter, settings: useSettings.getState().settings });
    },
    refreshWidgets,
    getTimeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    getLastKnownTimeZone: () => useSettings.getState().settings.lastKnownTimeZone,
    setLastKnownTimeZone: (z) => useSettings.getState().update({ lastKnownTimeZone: z }),
    debounceMs,
  });
}
