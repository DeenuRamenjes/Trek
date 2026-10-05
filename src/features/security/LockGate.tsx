import { ReactNode, useCallback, useEffect, useReducer, useRef } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { createLockState, LOCK_FAILURES_BEFORE_PASSCODE, lockReducer } from '../../domain/appLock';
import { authenticate, hasBiometrics } from '../../services/appLock';
import { strings } from '../../strings/en';
import { Motion } from '../../ui/motion';
import { haptic } from '../tracking/haptics';
import { useSettings } from '../settings/settingsStore';
import { LockScreen } from './LockScreen';

/** Covers its children with the lock screen on cold start and after the background timeout. */
export function LockGate({ children, promptReady = true }: { children: ReactNode; /** False while the animated splash is up; the auto-prompt waits. */ promptReady?: boolean }) {
  const { enabled, timeout } = useSettings((s) => s.settings.appLock);
  const [state, dispatch] = useReducer(lockReducer, enabled, createLockState);
  const busy = useRef(false);
  const failuresRef = useRef(state.failures);
  failuresRef.current = state.failures;
  const config = useRef({ enabled, timeout });
  config.current = { enabled, timeout };

  const locked = enabled && state.locked;

  useEffect(() => {
    if (!enabled) dispatch({ type: 'disabled' });
  }, [enabled]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') dispatch({ type: 'background', at: Date.now() });
      else if (next === 'active') dispatch({ type: 'foreground', at: Date.now(), ...config.current });
    });
    return () => sub.remove();
  }, []);

  const unlock = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    dispatch({ type: 'authStarted' });
    try {
      // Without enrolled biometrics the passcode is the only way in, so offer it from the first try.
      const allowPasscode = failuresRef.current >= LOCK_FAILURES_BEFORE_PASSCODE || !(await hasBiometrics());
      const result = await authenticate({ promptMessage: strings.lock.prompt, allowPasscode });
      if (result.ok) {
        haptic('success');
        dispatch({ type: 'success' });
      } else if (!result.cancelled) {
        dispatch({ type: 'failure' });
      } else {
        dispatch({ type: 'authEnded' });
      }
    } finally {
      busy.current = false;
    }
  }, []);

  return (
    <>
      <Motion
        style={styles.fill}
        animate={{ scale: locked ? 0.98 : 1 }}
        transition={{ duration: 'base', easing: 'standard' }}
        accessibilityElementsHidden={locked}
        importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </Motion>
      {locked ? <LockScreen failures={state.failures} onUnlock={unlock} promptKey={state.relocks} promptReady={promptReady} /> : null}
    </>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
