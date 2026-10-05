import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';
import { useSettings } from '../../features/settings/settingsStore';

const MODES = {
  system: ReduceMotion.System,
  on: ReduceMotion.Always,
  off: ReduceMotion.Never,
} as const;

/** Applies the reduce-motion override to every Reanimated animation, including layout animations. */
export function MotionConfig() {
  const override = useSettings((s) => s.settings.reduceMotionOverride);
  return <ReducedMotionConfig mode={MODES[override]} />;
}
