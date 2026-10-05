import { strings } from '../../strings/en';

export type PermissionState = { status: string; granted: boolean; canAskAgain: boolean };
export type PermissionAdapter = {
  getPermissions: () => Promise<PermissionState>;
  requestPermissions: () => Promise<PermissionState>;
};
export type PermissionRow = { text: string; action: 'none' | 'request' | 'openSettings'; actionLabel?: string };

/** Pure mapping from permission state to the Settings row. */
export function permissionRow(state: PermissionState): PermissionRow {
  const s = strings.settings.notifications;
  if (state.granted) return { text: s.on, action: 'none' };
  if (state.status === 'denied' && !state.canAskAgain) {
    return { text: s.blocked, action: 'openSettings', actionLabel: s.openSettings };
  }
  if (state.status === 'denied') return { text: s.off, action: 'request', actionLabel: s.enable };
  return { text: s.notAsked, action: 'request', actionLabel: s.enable };
}

/** True when notifications are allowed; asks only when the OS still lets us. */
export async function ensureNotificationPermission(adapter: PermissionAdapter): Promise<boolean> {
  const current = await adapter.getPermissions();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await adapter.requestPermissions();
  return next.granted;
}
