import * as Haptics from 'expo-haptics';
import { useSettings } from '../settings/settingsStore';

export type HapticKind = 'tap' | 'success' | 'warning';

/** The only haptics entry point; silent unless settings.haptics is on. */
export function haptic(kind: HapticKind = 'tap', enabled: boolean = useSettings.getState().settings.haptics): void {
  if (!enabled) return;
  try {
    if (kind === 'tap') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else void Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
  } catch {
    // haptics unavailable: ignore
  }
}
