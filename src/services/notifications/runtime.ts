import { logCatch } from '../errorLog';
import { getDb, type TrekDb } from '../../db/client';
import { useSettings } from '../../features/settings/settingsStore';
import { onActionsApplied, processPendingActions } from '../actionQueueProcessor';
import { importWidgetActions, refreshWidgets } from '../widgetBridge';
import { notificationsAdapter } from './adapter';
import { coalesce, createLifecycle } from './lifecycle';
import { reconcile } from './reconciler';

// One shared, serialized reconcile for foreground, data changes, background task and actions.
const reconcileSerialized = coalesce(() => {
  const db: TrekDb = getDb();
  return reconcile({ db, adapter: notificationsAdapter, settings: useSettings.getState().settings });
});

// After actions are applied (notification response, widget): refresh reminders and widgets.
onActionsApplied(() => {
  void reconcileSerialized().catch(logCatch('reconcile'));
  void refreshWidgets().catch(logCatch('widgets.refresh'));
});

/** Wires the lifecycle to the real db, settings store and adapter. */
export function createRuntimeLifecycle(debounceMs?: number) {
  return createLifecycle({
    processActions: async () => {
      const db: TrekDb = getDb();
      await importWidgetActions().catch(() => undefined);
      return processPendingActions(db);
    },
    reconcile: reconcileSerialized,
    refreshWidgets,
    getTimeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    getLastKnownTimeZone: () => useSettings.getState().settings.lastKnownTimeZone,
    setLastKnownTimeZone: (z) => useSettings.getState().update({ lastKnownTimeZone: z }),
    debounceMs,
  });
}
