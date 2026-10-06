import { createLockState, lockReducer, LOCK_FAILURES_BEFORE_PASSCODE, timeoutMs } from '../appLock';

const MIN = 60_000;

describe('createLockState', () => {
  it('locks on cold start when enabled', () => {
    expect(createLockState(true).locked).toBe(true);
  });
  it('does not lock on cold start when disabled', () => {
    expect(createLockState(false).locked).toBe(false);
  });
});

describe('timeoutMs', () => {
  it('maps options to milliseconds', () => {
    expect(timeoutMs('immediate')).toBe(0);
    expect(timeoutMs('1m')).toBe(MIN);
    expect(timeoutMs('5m')).toBe(5 * MIN);
    expect(timeoutMs('15m')).toBe(15 * MIN);
  });
});

describe('background and foreground', () => {
  const unlocked = () => ({ ...createLockState(false), locked: false });

  it('disabled never locks', () => {
    let s = lockReducer(unlocked(), { type: 'background', at: 0 });
    s = lockReducer(s, { type: 'foreground', at: 99 * MIN, enabled: false, timeout: 'immediate' });
    expect(s.locked).toBe(false);
  });

  it('stays unlocked within the timeout', () => {
    let s = lockReducer(unlocked(), { type: 'background', at: 1000 });
    s = lockReducer(s, { type: 'foreground', at: 1000 + MIN - 1, enabled: true, timeout: '1m' });
    expect(s.locked).toBe(false);
    expect(s.backgroundedAt).toBeNull();
  });

  it('locks past the timeout', () => {
    let s = lockReducer(unlocked(), { type: 'background', at: 1000 });
    s = lockReducer(s, { type: 'foreground', at: 1000 + 5 * MIN, enabled: true, timeout: '5m' });
    expect(s.locked).toBe(true);
  });

  it('immediate locks on any background', () => {
    let s = lockReducer(unlocked(), { type: 'background', at: 1000 });
    s = lockReducer(s, { type: 'foreground', at: 1000, enabled: true, timeout: 'immediate' });
    expect(s.locked).toBe(true);
  });

  it('locks when the clock went backwards', () => {
    let s = lockReducer(unlocked(), { type: 'background', at: 5000 });
    s = lockReducer(s, { type: 'foreground', at: 1000, enabled: true, timeout: '15m' });
    expect(s.locked).toBe(true);
  });

  it('foreground without a prior background changes nothing', () => {
    const s = lockReducer(unlocked(), { type: 'foreground', at: 9 * MIN, enabled: true, timeout: 'immediate' });
    expect(s.locked).toBe(false);
  });

  it('a second background event keeps the first timestamp', () => {
    let s = lockReducer(unlocked(), { type: 'background', at: 1000 });
    s = lockReducer(s, { type: 'background', at: 1000 + 10 * MIN });
    s = lockReducer(s, { type: 'foreground', at: 1000 + 2 * MIN, enabled: true, timeout: '1m' });
    expect(s.locked).toBe(true);
  });

  it('stays locked while locked', () => {
    let s = createLockState(true);
    s = lockReducer(s, { type: 'background', at: 0 });
    s = lockReducer(s, { type: 'foreground', at: 1, enabled: true, timeout: '15m' });
    expect(s.locked).toBe(true);
  });
});

describe('failures and success', () => {
  it('counts failures and resets on success', () => {
    let s = createLockState(true);
    s = lockReducer(s, { type: 'failure' });
    s = lockReducer(s, { type: 'failure' });
    expect(s.failures).toBe(2);
    s = lockReducer(s, { type: 'success' });
    expect(s.failures).toBe(0);
    expect(s.locked).toBe(false);
  });

  it('passcode fallback threshold is three failures', () => {
    expect(LOCK_FAILURES_BEFORE_PASSCODE).toBe(3);
  });
});

describe('auth in flight', () => {
  it('ignores background and foreground while the prompt is open, then stays unlocked on success', () => {
    let s = createLockState(true);
    s = lockReducer(s, { type: 'authStarted' });
    s = lockReducer(s, { type: 'background', at: 0 });
    s = lockReducer(s, { type: 'foreground', at: 5, enabled: true, timeout: 'immediate' });
    s = lockReducer(s, { type: 'success' });
    expect(s.locked).toBe(false);
    expect(s.authInFlight).toBe(false);
    expect(s.backgroundedAt).toBeNull();
  });

  it('authEnded and failure clear the flag', () => {
    const started = lockReducer(createLockState(true), { type: 'authStarted' });
    expect(lockReducer(started, { type: 'authEnded' }).authInFlight).toBe(false);
    expect(lockReducer(started, { type: 'failure' }).authInFlight).toBe(false);
  });
});

describe('relocks', () => {
  it('counts a foreground re-lock even when already locked', () => {
    let s = createLockState(true);
    s = lockReducer(s, { type: 'background', at: 0 });
    s = lockReducer(s, { type: 'foreground', at: 1, enabled: true, timeout: 'immediate' });
    expect(s.relocks).toBe(1);
  });
  it('does not count when the timeout has not passed', () => {
    let s = lockReducer({ ...createLockState(false) }, { type: 'background', at: 0 });
    s = lockReducer(s, { type: 'foreground', at: 1, enabled: true, timeout: '1m' });
    expect(s.relocks).toBe(0);
  });
});

describe('disabled event', () => {
  it('unlocks and clears state so re-enabling does not lock at once', () => {
    let s = createLockState(true);
    s = lockReducer(s, { type: 'failure' });
    s = lockReducer(s, { type: 'disabled' });
    expect(s).toEqual(createLockState(false));
  });
});
