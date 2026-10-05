import { useSyncExternalStore } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { strings } from '../strings/en';

export type AuthResult = { ok: true } | { ok: false; cancelled: boolean };

const CANCEL_ERRORS = new Set(['user_cancel', 'system_cancel', 'app_cancel']);

let promptOpen = false;
const listeners = new Set<() => void>();
function setPromptOpen(open: boolean) {
  promptOpen = open;
  listeners.forEach((l) => l());
}

/** True while the system auth prompt is open (the privacy overlay stays out of its way). */
export function useAuthPromptOpen(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => promptOpen,
  );
}

/** True when the device has any enrolled security: a passcode, PIN, pattern or biometrics. */
export async function isLockAvailable(): Promise<boolean> {
  try {
    return (await LocalAuthentication.getEnrolledLevelAsync()) >= LocalAuthentication.SecurityLevel.SECRET;
  } catch {
    return false;
  }
}

/** True when biometrics are enrolled. Without them the passcode is the only way in. */
export async function hasBiometrics(): Promise<boolean> {
  try {
    return await LocalAuthentication.isEnrolledAsync();
  } catch {
    return false;
  }
}

/**
 * Shows the system prompt. Biometrics first; with `allowPasscode` the device passcode is offered too.
 * The app never stores a PIN or any credential.
 */
export async function authenticate(opts: { promptMessage: string; allowPasscode: boolean }): Promise<AuthResult> {
  setPromptOpen(true);
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: opts.promptMessage,
      cancelLabel: strings.lock.cancelLabel,
      disableDeviceFallback: !opts.allowPasscode,
    });
    if (result.success) return { ok: true };
    return { ok: false, cancelled: CANCEL_ERRORS.has(result.error) };
  } catch {
    return { ok: false, cancelled: false };
  } finally {
    setPromptOpen(false);
  }
}
