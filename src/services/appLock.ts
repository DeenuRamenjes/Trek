import * as LocalAuthentication from 'expo-local-authentication';
import { strings } from '../strings/en';

export type AuthResult = { ok: true } | { ok: false; cancelled: boolean };

const CANCEL_ERRORS = new Set(['user_cancel', 'system_cancel', 'app_cancel']);

/** True when the device has biometrics or a screen lock the app lock can use. */
export async function isLockAvailable(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

/**
 * Shows the system prompt. Biometrics first; with `allowPasscode` the device passcode is offered too.
 * The app never stores a PIN or any credential.
 */
export async function authenticate(opts: { promptMessage: string; allowPasscode: boolean }): Promise<AuthResult> {
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
  }
}
