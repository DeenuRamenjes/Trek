import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { dayRolloverAt, logicalToday } from '../../domain/dayBoundary';
import { useSettings } from '../settings/settingsStore';

/** Current logical date and instant; refreshes at the day rollover and on app foreground. */
export function useLogicalToday(): { today: string; now: Date } {
  const dayEndsAt = useSettings((s) => s.settings.dayEndsAt);
  const [now, setNow] = useState(() => new Date());
  const today = logicalToday(now, dayEndsAt);

  useEffect(() => {
    const delay = Math.max(dayRolloverAt(today, dayEndsAt).getTime() - Date.now(), 0) + 50;
    const t = setTimeout(() => setNow(new Date()), delay);
    return () => clearTimeout(t);
  }, [today, dayEndsAt]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setNow(new Date());
    });
    return () => sub.remove();
  }, []);

  return { today, now };
}
