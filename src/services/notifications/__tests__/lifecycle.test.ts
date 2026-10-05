import { createLifecycle, type LifecycleDeps } from '../lifecycle';
import { permissionRow, ensureNotificationPermission } from '../permissions';

function make(over: Partial<LifecycleDeps> = {}) {
  let tz = 'Europe/Berlin';
  let last: string | undefined = 'Europe/Berlin';
  const calls: string[] = [];
  const deps: LifecycleDeps = {
    processActions: jest.fn(async () => {
      calls.push('process');
      return 0;
    }),
    reconcile: jest.fn(async () => {
      calls.push('reconcile');
    }),
    refreshWidgets: jest.fn(async () => {
      calls.push('widgets');
    }),
    getTimeZone: () => tz,
    getLastKnownTimeZone: () => last,
    setLastKnownTimeZone: jest.fn((z: string) => {
      last = z;
    }),
    debounceMs: 500,
    ...over,
  };
  return { lc: createLifecycle(deps), deps, calls, setTz: (z: string) => (tz = z), getLast: () => last };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('lifecycle', () => {
  it('foreground processes then reconciles', async () => {
    const { lc, calls } = make();
    await lc.onForeground();
    expect(calls).toEqual(['process', 'reconcile']);
  });

  it('time zone change updates setting, reconciles and refreshes widgets', async () => {
    const { lc, deps, calls, setTz, getLast } = make();
    setTz('America/New_York');
    await lc.onForeground();
    expect(getLast()).toBe('America/New_York');
    expect(deps.setLastKnownTimeZone).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['process', 'reconcile', 'widgets']);
  });

  it('first run with no stored zone records it without widget refresh', async () => {
    const { lc, calls, deps } = make({ getLastKnownTimeZone: () => undefined });
    await lc.onForeground();
    expect(deps.setLastKnownTimeZone).toHaveBeenCalledWith('Europe/Berlin');
    expect(calls).toEqual(['process', 'reconcile']);
  });

  it('db changes trigger one debounced reconcile', async () => {
    const { lc, deps } = make();
    lc.onDataChanged();
    lc.onDataChanged();
    lc.onDataChanged();
    expect(deps.reconcile).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(500);
    expect(deps.reconcile).toHaveBeenCalledTimes(1);
    expect(deps.processActions).not.toHaveBeenCalled();
  });

  it('dispose cancels pending debounce', async () => {
    const { lc, deps } = make();
    lc.onDataChanged();
    lc.dispose();
    await jest.advanceTimersByTimeAsync(1000);
    expect(deps.reconcile).not.toHaveBeenCalled();
  });

  it('errors do not escape', async () => {
    const { lc } = make({ reconcile: jest.fn(async () => Promise.reject(new Error('x'))) });
    await expect(lc.onForeground()).resolves.toBeUndefined();
  });

  it('background run processes then reconciles', async () => {
    const { lc, calls } = make();
    await lc.runCycle();
    expect(calls).toEqual(['process', 'reconcile']);
  });
});

describe('permissions', () => {
  const st = (status: string, canAskAgain = true) => ({ status, granted: status === 'granted', canAskAgain });
  it('row states', () => {
    expect(permissionRow(st('granted')).action).toBe('none');
    expect(permissionRow(st('undetermined')).action).toBe('request');
    expect(permissionRow(st('denied', true)).action).toBe('request');
    expect(permissionRow(st('denied', false)).action).toBe('openSettings');
    expect(new Set(['granted', 'undetermined', 'denied'].map((s) => permissionRow(st(s)).text)).size).toBe(3);
  });
  it('ensure does not re-request when granted or blocked', async () => {
    const request = jest.fn(async () => st('granted'));
    const a = { getPermissions: async () => st('granted'), requestPermissions: request };
    expect(await ensureNotificationPermission(a)).toBe(true);
    expect(request).not.toHaveBeenCalled();
    const b = { getPermissions: async () => st('denied', false), requestPermissions: request };
    expect(await ensureNotificationPermission(b)).toBe(false);
    expect(request).not.toHaveBeenCalled();
    const c = { getPermissions: async () => st('undetermined'), requestPermissions: request };
    expect(await ensureNotificationPermission(c)).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
