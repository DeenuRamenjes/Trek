import { useEffect } from 'react';
import { onDbChanged } from '../../db/changes';
import { refreshWidgets } from '../../services/widgetBridge';
import { useSettings } from '../settings/settingsStore';
import { useLogicalToday } from '../tracking/useLogicalToday';

const DEBOUNCE_MS = 500;

/** Mount once: pushes a widget snapshot on data changes, widget/day-end settings changes and the day rollover. */
export function useWidgetSync(): void {
  const { today } = useLogicalToday();

  useEffect(() => {
    void refreshWidgets().catch(() => undefined);
  }, [today]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void refreshWidgets().catch(() => undefined);
      }, DEBOUNCE_MS);
    };
    const offDb = onDbChanged(schedule);
    const offSettings = useSettings.subscribe((state, prev) => {
      const a = state.settings;
      const b = prev.settings;
      if (a.dayEndsAt !== b.dayEndsAt || a.accentColor !== b.accentColor) schedule();
    });
    return () => {
      if (timer) clearTimeout(timer);
      offDb();
      offSettings();
    };
  }, []);
}
