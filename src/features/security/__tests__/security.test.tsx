import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { AppState, Text, View } from 'react-native';
import { DEFAULT_SETTINGS } from '../../../domain/settings';
import { authenticate } from '../../../services/appLock';
import { strings } from '../../../strings/en';
import { ThemeProvider } from '../../../ui/ThemeProvider';
import { useSettings } from '../../settings/settingsStore';
import { LockGate } from '../LockGate';
import { PrivacyOverlay } from '../PrivacyOverlay';
import { SecurityScreen } from '../SecurityScreen';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));

const auth = LocalAuthentication as jest.Mocked<typeof LocalAuthentication>;
const get = () => useSettings.getState().settings;
const t = strings.security;

function setLock(patch: Partial<typeof DEFAULT_SETTINGS.appLock>) {
  useSettings.setState({ settings: { ...DEFAULT_SETTINGS, appLock: { ...DEFAULT_SETTINGS.appLock, ...patch } } });
}

function captureAppState() {
  const handlers: ((s: string) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: string) => void) => {
    handlers.push(h);
    return { remove: jest.fn() };
  }) as never);
  return (s: string) => handlers.forEach((h) => h(s));
}

function wrap(node: React.ReactNode) {
  return <ThemeProvider mode="light">{node}</ThemeProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  setLock({});
  auth.hasHardwareAsync.mockResolvedValue(true);
  auth.isEnrolledAsync.mockResolvedValue(true);
  auth.getEnrolledLevelAsync.mockResolvedValue(2);
  auth.authenticateAsync.mockResolvedValue({ success: true });
});

describe('SecurityScreen', () => {
  it('enabling fails without enrolment, explains and stays off', async () => {
    auth.getEnrolledLevelAsync.mockResolvedValue(0);
    await render(wrap(<SecurityScreen />));
    await fireEvent(screen.getByLabelText(t.appLockLabel), 'valueChange', true);
    expect(await screen.findByText(t.notEnrolled)).toBeTruthy();
    expect(get().appLock.enabled).toBe(false);
    expect(auth.authenticateAsync).not.toHaveBeenCalled();
  });

  it('enabling stays off when authentication fails', async () => {
    auth.authenticateAsync.mockResolvedValue({ success: false, error: 'authentication_failed' });
    await render(wrap(<SecurityScreen />));
    await fireEvent(screen.getByLabelText(t.appLockLabel), 'valueChange', true);
    expect(await screen.findByText(t.authFailed)).toBeTruthy();
    expect(get().appLock.enabled).toBe(false);
  });

  it('enabling with successful auth turns the lock on', async () => {
    await render(wrap(<SecurityScreen />));
    await fireEvent(screen.getByLabelText(t.appLockLabel), 'valueChange', true);
    await waitFor(() => expect(get().appLock.enabled).toBe(true));
  });

  it('enabling works on a passcode-only device', async () => {
    auth.isEnrolledAsync.mockResolvedValue(false);
    auth.getEnrolledLevelAsync.mockResolvedValue(1);
    await render(wrap(<SecurityScreen />));
    await fireEvent(screen.getByLabelText(t.appLockLabel), 'valueChange', true);
    await waitFor(() => expect(get().appLock.enabled).toBe(true));
  });

  it('timeout and switcher options update the store when on', async () => {
    setLock({ enabled: true });
    await render(wrap(<SecurityScreen />));
    await fireEvent.press(screen.getByLabelText(t.timeoutOptions['5m']));
    expect(get().appLock.timeout).toBe('5m');
    await fireEvent(screen.getByLabelText(t.hideInSwitcherLabel), 'valueChange', false);
    expect(get().appLock.hideInAppSwitcher).toBe(false);
  });

  it('turning the lock off needs no authentication', async () => {
    setLock({ enabled: true });
    await render(wrap(<SecurityScreen />));
    await fireEvent(screen.getByLabelText(t.appLockLabel), 'valueChange', false);
    expect(get().appLock.enabled).toBe(false);
    expect(auth.authenticateAsync).not.toHaveBeenCalled();
  });
});

describe('LockGate', () => {
  const content = <Text>secret content</Text>;

  it('does not lock when disabled', async () => {
    await render(wrap(<LockGate>{content}</LockGate>));
    expect(screen.queryByTestId('lock-screen')).toBeNull();
    expect(auth.authenticateAsync).not.toHaveBeenCalled();
  });

  it('shows the lock screen on start, prompts, and hides after unlock', async () => {
    setLock({ enabled: true });
    let resolve!: (r: { success: true }) => void;
    auth.authenticateAsync.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    await render(wrap(<LockGate>{content}</LockGate>));
    expect(screen.getByTestId('lock-screen')).toBeTruthy();
    expect(screen.getByText(strings.lock.title)).toBeTruthy();
    expect(auth.authenticateAsync).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ success: true }));
    await waitFor(() => expect(screen.queryByTestId('lock-screen')).toBeNull());
  });

  it('failure keeps it locked and shows the retry message', async () => {
    setLock({ enabled: true });
    auth.authenticateAsync.mockResolvedValue({ success: false, error: 'authentication_failed' });
    await render(wrap(<LockGate>{content}</LockGate>));
    expect(await screen.findByText(strings.lock.failed)).toBeTruthy();
    expect(screen.getByTestId('lock-screen')).toBeTruthy();
  });

  it('cancelling the prompt is not counted as a failure', async () => {
    setLock({ enabled: true });
    auth.authenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' });
    await render(wrap(<LockGate>{content}</LockGate>));
    await waitFor(() => expect(auth.authenticateAsync).toHaveBeenCalled());
    expect(screen.queryByText(strings.lock.failed)).toBeNull();
  });

  it('offers the passcode after three failures', async () => {
    setLock({ enabled: true });
    auth.authenticateAsync.mockResolvedValue({ success: false, error: 'authentication_failed' });
    await render(wrap(<LockGate>{content}</LockGate>));
    await waitFor(() => expect(screen.getByText(strings.lock.failed)).toBeTruthy());
    await fireEvent.press(screen.getByLabelText(strings.lock.unlock));
    await waitFor(() => expect(auth.authenticateAsync).toHaveBeenCalledTimes(2));
    await fireEvent.press(screen.getByLabelText(strings.lock.unlock));
    await waitFor(() => expect(auth.authenticateAsync).toHaveBeenCalledTimes(3));
    expect(await screen.findByText(strings.lock.usePasscode)).toBeTruthy();
    auth.authenticateAsync.mockClear();
    await fireEvent.press(screen.getByLabelText(strings.lock.unlock));
    await waitFor(() => expect(auth.authenticateAsync).toHaveBeenCalled());
    expect(auth.authenticateAsync.mock.calls[0][0]).toMatchObject({ disableDeviceFallback: false });
  });

  it('offers the passcode from the first try when no biometrics are enrolled', async () => {
    setLock({ enabled: true });
    auth.isEnrolledAsync.mockResolvedValue(false);
    await render(wrap(<LockGate>{content}</LockGate>));
    await waitFor(() => expect(auth.authenticateAsync).toHaveBeenCalled());
    expect(auth.authenticateAsync.mock.calls[0][0]).toMatchObject({ disableDeviceFallback: false });
  });

  it('keeps biometrics-only on the first try when biometrics are enrolled', async () => {
    setLock({ enabled: true });
    await render(wrap(<LockGate>{content}</LockGate>));
    await waitFor(() => expect(auth.authenticateAsync).toHaveBeenCalled());
    expect(auth.authenticateAsync.mock.calls[0][0]).toMatchObject({ disableDeviceFallback: true });
  });

  it('waits for the splash before the auto-prompt', async () => {
    setLock({ enabled: true });
    const ui = (ready: boolean) => wrap(<LockGate promptReady={ready}>{content}</LockGate>);
    const { rerender } = await render(ui(false));
    expect(screen.getByTestId('lock-screen')).toBeTruthy();
    expect(auth.authenticateAsync).not.toHaveBeenCalled();
    await rerender(ui(true));
    await waitFor(() => expect(auth.authenticateAsync).toHaveBeenCalledTimes(1));
  });

  it('ignores app state changes while the prompt is open', async () => {
    setLock({ enabled: true, timeout: 'immediate' });
    const emit = captureAppState();
    let resolve!: (r: { success: true }) => void;
    auth.authenticateAsync.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    await render(wrap(<LockGate>{content}</LockGate>));
    await act(async () => emit('background'));
    await act(async () => emit('active'));
    await act(async () => resolve({ success: true }));
    await waitFor(() => expect(screen.queryByTestId('lock-screen')).toBeNull());
  });

  it('prompts again when the app re-locks while the lock screen is already showing', async () => {
    setLock({ enabled: true, timeout: 'immediate' });
    const emit = captureAppState();
    auth.authenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' });
    await render(wrap(<LockGate>{content}</LockGate>));
    await waitFor(() => expect(auth.authenticateAsync).toHaveBeenCalledTimes(1));
    await act(async () => emit('background'));
    await act(async () => emit('active'));
    await waitFor(() => expect(auth.authenticateAsync).toHaveBeenCalledTimes(2));
  });

  it('locks again after backgrounding past the timeout', async () => {
    setLock({ enabled: true, timeout: 'immediate' });
    const emit = captureAppState();
    await render(wrap(<LockGate>{content}</LockGate>));
    await waitFor(() => expect(screen.queryByTestId('lock-screen')).toBeNull());
    let release!: (r: { success: false; error: 'user_cancel' }) => void;
    auth.authenticateAsync.mockReturnValueOnce(new Promise((r) => (release = r)));
    await act(async () => emit('background'));
    await act(async () => emit('active'));
    expect(screen.getByTestId('lock-screen')).toBeTruthy();
    await act(async () => release({ success: false, error: 'user_cancel' }));
    jest.restoreAllMocks();
  });
});

describe('PrivacyOverlay', () => {
  const withAppState = captureAppState;
  afterEach(() => jest.restoreAllMocks());

  it('shows on inactive when enabled and hides when active again', async () => {
    setLock({ enabled: true });
    const emit = withAppState();
    await render(wrap(<View><PrivacyOverlay /></View>));
    expect(screen.queryByTestId('privacy-overlay', { includeHiddenElements: true })).toBeNull();
    await act(async () => emit('inactive'));
    expect(screen.getByTestId('privacy-overlay', { includeHiddenElements: true })).toBeTruthy();
    await act(async () => emit('active'));
    expect(screen.queryByTestId('privacy-overlay', { includeHiddenElements: true })).toBeNull();
  });

  it('stays hidden while the auth prompt is open', async () => {
    setLock({ enabled: true });
    const emit = withAppState();
    let resolve!: (r: { success: true }) => void;
    auth.authenticateAsync.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    await render(wrap(<View><PrivacyOverlay /></View>));
    await act(async () => emit('inactive'));
    expect(screen.getByTestId('privacy-overlay', { includeHiddenElements: true })).toBeTruthy();
    let pending!: Promise<unknown>;
    await act(async () => {
      pending = authenticate({ promptMessage: 'x', allowPasscode: false });
    });
    expect(screen.queryByTestId('privacy-overlay', { includeHiddenElements: true })).toBeNull();
    await act(async () => {
      resolve({ success: true });
      await pending;
    });
    expect(screen.getByTestId('privacy-overlay', { includeHiddenElements: true })).toBeTruthy();
  });

  it('stays hidden when the lock is off', async () => {
    const emit = withAppState();
    await render(wrap(<View><PrivacyOverlay /></View>));
    await act(async () => emit('inactive'));
    expect(screen.queryByTestId('privacy-overlay', { includeHiddenElements: true })).toBeNull();
  });

  it('stays hidden when hideInAppSwitcher is off', async () => {
    setLock({ enabled: true, hideInAppSwitcher: false });
    const emit = withAppState();
    await render(wrap(<View><PrivacyOverlay /></View>));
    await act(async () => emit('background'));
    expect(screen.queryByTestId('privacy-overlay', { includeHiddenElements: true })).toBeNull();
  });
});
