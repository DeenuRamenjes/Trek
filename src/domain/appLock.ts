export type LockTimeout = 'immediate' | '1m' | '5m' | '15m';

export type LockState = {
  locked: boolean;
  /** Consecutive failed attempts since the last success. */
  failures: number;
  /** Epoch ms when the app went to the background; null while in the foreground. */
  backgroundedAt: number | null;
};

export type LockEvent =
  | { type: 'background'; at: number }
  | { type: 'foreground'; at: number; enabled: boolean; timeout: LockTimeout }
  | { type: 'failure' }
  | { type: 'success' }
  | { type: 'disabled' };

/** After this many failures the device passcode is offered. */
export const LOCK_FAILURES_BEFORE_PASSCODE = 3;

const TIMEOUT_MS: Record<LockTimeout, number> = {
  immediate: 0,
  '1m': 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
};

export function timeoutMs(timeout: LockTimeout): number {
  return TIMEOUT_MS[timeout];
}

/** A cold start is locked when the lock is enabled. */
export function createLockState(enabled: boolean): LockState {
  return { locked: enabled, failures: 0, backgroundedAt: null };
}

export function lockReducer(state: LockState, event: LockEvent): LockState {
  switch (event.type) {
    case 'background':
      return state.backgroundedAt === null ? { ...state, backgroundedAt: event.at } : state;
    case 'foreground': {
      if (!event.enabled) return { ...state, locked: false, backgroundedAt: null };
      if (state.backgroundedAt === null) return state;
      const elapsed = event.at - state.backgroundedAt;
      // A clock that moved backwards cannot prove the timeout has not passed: lock.
      const expired = elapsed < 0 || elapsed >= timeoutMs(event.timeout);
      return { ...state, locked: state.locked || expired, backgroundedAt: null };
    }
    case 'failure':
      return { ...state, failures: state.failures + 1 };
    case 'success':
      return { ...state, locked: false, failures: 0 };
    case 'disabled':
      return { locked: false, failures: 0, backgroundedAt: null };
  }
}
