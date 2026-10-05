import { DEFAULT_SETTINGS } from '../../../domain/settings';
import { createSettingsStore, KeyValueStorage, loadSettings, SETTINGS_KEY } from '../settingsStore';

function memoryStorage(initial?: Record<string, string>): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial ?? {}));
  return {
    data,
    getString: (key) => data.get(key),
    set: (key, value) => {
      data.set(key, value);
    },
    remove: (key) => data.delete(key),
  };
}

describe('loadSettings', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadSettings(memoryStorage())).toEqual(DEFAULT_SETTINGS);
  });

  it('returns defaults when the stored JSON is corrupt', () => {
    expect(loadSettings(memoryStorage({ [SETTINGS_KEY]: '{not json' }))).toEqual(DEFAULT_SETTINGS);
  });

  it('validates stored values field by field', () => {
    const stored = JSON.stringify({ theme: 'dark', dayEndsAt: 9 });
    const s = loadSettings(memoryStorage({ [SETTINGS_KEY]: stored }));
    expect(s.theme).toBe('dark');
    expect(s.dayEndsAt).toBe(0);
  });
});

describe('settings store', () => {
  it('hydrates synchronously from storage', () => {
    const store = createSettingsStore(memoryStorage({ [SETTINGS_KEY]: JSON.stringify({ theme: 'light' }) }));
    expect(store.getState().settings.theme).toBe('light');
  });

  it('persists updates and survives a reload', () => {
    const storage = memoryStorage();
    const store = createSettingsStore(storage);
    store.getState().update({ reduceMotionOverride: 'on', accentColor: '#4F5BD5' });
    expect(store.getState().settings.reduceMotionOverride).toBe('on');
    const reloaded = createSettingsStore(storage);
    expect(reloaded.getState().settings.accentColor).toBe('#4F5BD5');
  });

  it('ignores invalid patch values', () => {
    const store = createSettingsStore(memoryStorage());
    store.getState().update({ dayEndsAt: 12 });
    expect(store.getState().settings.dayEndsAt).toBe(0);
  });

  it('reset clears storage and restores defaults', () => {
    const storage = memoryStorage();
    const store = createSettingsStore(storage);
    store.getState().update({ theme: 'dark' });
    store.getState().reset();
    expect(store.getState().settings).toEqual(DEFAULT_SETTINGS);
    expect(storage.data.has(SETTINGS_KEY)).toBe(false);
  });
});
