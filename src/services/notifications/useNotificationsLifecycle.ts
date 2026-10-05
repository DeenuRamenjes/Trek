import { useEffect } from 'react';
import { AppState } from 'react-native';
import { onDbChanged } from '../../db/changes';
import { useSettings } from '../../features/settings/settingsStore';
import { createRuntimeLifecycle } from './runtime';

/** Mount once under DbProvider: foreground cycle, time-zone check, debounced reconcile on data or setting changes. */
export function useNotificationsLifecycle(): void {
  useEffect(() => {
    const lc = createRuntimeLifecycle();
    void lc.onForeground();
    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void lc.onForeground();
    });
    const offDb = onDbChanged(lc.onDataChanged);
    const offSettings = useSettings.subscribe((state, prev) => {
      const a = state.settings;
      const b = prev.settings;
      if (
        a.dayEndsAt !== b.dayEndsAt ||
        a.appLock.enabled !== b.appLock.enabled ||
        a.reviewNotifications.weekly !== b.reviewNotifications.weekly ||
        a.reviewNotifications.monthly !== b.reviewNotifications.monthly ||
        a.weekStart !== b.weekStart ||
        a.backupReminderFrequency !== b.backupReminderFrequency ||
        JSON.stringify(a.quietHours) !== JSON.stringify(b.quietHours)
      ) {
        lc.onDataChanged();
      }
    });
    return () => {
      appSub.remove();
      offDb();
      offSettings();
      lc.dispose();
    };
  }, []);
}
