import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { DEFAULT_SETTINGS, parseSettings, Settings } from '../../domain/settings';

/** The subset of MMKV the settings store uses; lets tests pass an in-memory fake. */
export type KeyValueStorage = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): boolean;
};

export const SETTINGS_KEY = 'settings';

export type SettingsState = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
};

export function loadSettings(storage: KeyValueStorage): Settings {
  const raw = storage.getString(SETTINGS_KEY);
  if (raw === undefined) return DEFAULT_SETTINGS;
  try {
    return parseSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function createSettingsStore(storage: KeyValueStorage) {
  return create<SettingsState>()((set, get) => ({
    settings: loadSettings(storage),
    update: (patch) => {
      const next = parseSettings({ ...get().settings, ...patch });
      storage.set(SETTINGS_KEY, JSON.stringify(next));
      set({ settings: next });
    },
    reset: () => {
      storage.remove(SETTINGS_KEY);
      set({ settings: DEFAULT_SETTINGS });
    },
  }));
}

/** App-wide settings store, persisted synchronously in MMKV (hydrated before first render). */
export const useSettings = createSettingsStore(createMMKV({ id: 'trek-settings' }));
