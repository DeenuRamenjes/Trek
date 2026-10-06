import { useEffect } from 'react';
import { AppState } from 'react-native';
import { runDailyAutoBackup } from './files';

/** Mount once: first app open of each logical day (and each foreground check) writes the silent JSON backup. */
export function useAutoBackup(): void {
  useEffect(() => {
    const run = () => void runDailyAutoBackup().catch(() => undefined);
    run();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') run();
    });
    return () => sub.remove();
  }, []);
}
