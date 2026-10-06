import { useReducedMotion } from 'react-native-reanimated';
import type { Settings } from '../../domain/settings';
import { useSettings } from '../../features/settings/settingsStore';

export type ReduceMotionOverride = Settings['reduceMotionOverride'];

/** The app reduces motion when the override says so, or when it follows the system and the system asks for it. */
export function resolveReduceMotion(override: ReduceMotionOverride, systemReduced: boolean): boolean {
  if (override === 'on') return true;
  if (override === 'off') return false;
  return systemReduced;
}

/** True when every animation must jump straight to its end state. */
export function useReduceMotion(): boolean {
  const override = useSettings((s) => s.settings.reduceMotionOverride);
  const systemReduced = useReducedMotion();
  return resolveReduceMotion(override, systemReduced);
}
