import { DEFAULT_SETTINGS, parseSettings } from '../settings';

describe('settings defaults', () => {
  it('match CLAUDE.md §3', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      theme: 'system',
      accentColor: '#2E7D5B',
      weekStart: 1,
      timeFormat: '24h',
      haptics: true,
      reduceMotionOverride: 'system',
      dayEndsAt: 0,
      quietHours: null,
      homeEmptyStateMode: 'allGoals',
      backupReminderFrequency: 'biweekly',
      backupFormat: 'both',
      autoBackupEnabled: true,
      appLock: { enabled: false, timeout: 'immediate', hideInAppSwitcher: true },
      widget: { hideGoalNames: false },
      reviewNotifications: { weekly: true, monthly: true },
    });
  });
});

describe('parseSettings', () => {
  it('returns defaults for missing or non-object input', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('nope')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid values', () => {
    const s = parseSettings({ theme: 'dark', dayEndsAt: 3, quietHours: { start: '22:00', end: '07:00' } });
    expect(s.theme).toBe('dark');
    expect(s.dayEndsAt).toBe(3);
    expect(s.quietHours).toEqual({ start: '22:00', end: '07:00' });
  });

  it('falls back per field when a value is invalid', () => {
    const s = parseSettings({ theme: 'purple', dayEndsAt: 7, haptics: false, accentColor: 'red' });
    expect(s.theme).toBe('system');
    expect(s.dayEndsAt).toBe(0);
    expect(s.accentColor).toBe('#2E7D5B');
    expect(s.haptics).toBe(false);
  });

  it('fills nested defaults for partial objects', () => {
    expect(parseSettings({ appLock: { enabled: true } }).appLock).toEqual({
      enabled: true,
      timeout: 'immediate',
      hideInAppSwitcher: true,
    });
  });

  it('falls back per nested field, keeping valid siblings', () => {
    const s = parseSettings({
      appLock: { enabled: true, timeout: '2m' },
      widget: { hideGoalNames: true, groupId: 5 },
      reviewNotifications: 'bad',
    });
    expect(s.appLock).toEqual({ enabled: true, timeout: 'immediate', hideInAppSwitcher: true });
    expect(s.widget).toEqual({ hideGoalNames: true });
    expect(s.reviewNotifications).toEqual({ weekly: true, monthly: true });
  });

  it('drops unknown keys', () => {
    expect(parseSettings({ legacy: 1 })).not.toHaveProperty('legacy');
  });

  it('rejects malformed quiet hours', () => {
    expect(parseSettings({ quietHours: { start: '25:00', end: '07:00' } }).quietHours).toBeNull();
  });
});
