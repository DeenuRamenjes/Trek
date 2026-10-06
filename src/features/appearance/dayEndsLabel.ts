import type { Settings } from '../../domain/settings';
import { strings } from '../../strings/en';

/** Label for a "My day ends at" hour (0–4): Midnight, then 1:00 AM or 01:00 per time format. */
export function dayEndsLabel(hour: number, format: Settings['timeFormat']): string {
  if (hour === 0) return strings.settings.appearanceScreen.midnight;
  return format === '12h' ? `${hour}:00 AM` : `${String(hour).padStart(2, '0')}:00`;
}
