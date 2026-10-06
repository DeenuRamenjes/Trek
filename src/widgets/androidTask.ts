import { getDb } from '../db/client';
import { newId } from '../db/ids';
import { useSettings } from '../features/settings/settingsStore';
import { processPendingActions } from '../services/actionQueueProcessor';
import { widgetsAdapter } from '../services/widgets/adapter';
import { createAndroidWidgetHandler } from '../services/widgets/androidHandler';
import { createWidgetBridge } from '../services/widgets/bridge';
import { renderAndroidWidget, TAP_ACTION } from './androidWidget';

/** Production wiring of the Android widget task handler. */
export function createAndroidTaskHandler() {
  // Built on the first event so importing the entry never opens the database.
  let handler: ReturnType<typeof build> | null = null;
  return (event: Parameters<ReturnType<typeof build>>[0]) => (handler ??= build())(event);
}

function build() {
  const db = getDb();
  const bridge = createWidgetBridge({ db, adapter: widgetsAdapter, getSettings: () => useSettings.getState().settings });
  return createAndroidWidgetHandler({
    db,
    buildPayload: bridge.buildPayload,
    refreshWidgets: bridge.refreshWidgets,
    processPending: () => processPendingActions(db),
    newId,
    render: renderAndroidWidget,
    tapAction: TAP_ACTION,
  });
}
