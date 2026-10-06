import { getDb } from '../db/client';
import { useSettings } from '../features/settings/settingsStore';
import { widgetsAdapter } from './widgets/adapter';
import { createWidgetBridge } from './widgets/bridge';

function runtime() {
  return createWidgetBridge({ db: getDb(), adapter: widgetsAdapter, getSettings: () => useSettings.getState().settings });
}

/** Imports widget taps into pending_actions, then pushes a fresh snapshot to each platform. */
export async function refreshWidgets(): Promise<void> {
  await runtime().refreshWidgets();
}

/** Moves widget-recorded taps into pending_actions (call before processing the queue). */
export async function importWidgetActions(): Promise<number> {
  return runtime().importWidgetActions();
}
