import { createMMKV } from 'react-native-mmkv';

/** The subset of MMKV the onboarding flag uses; lets tests pass an in-memory fake. */
export type OnboardingStorage = {
  getBoolean(key: string): boolean | undefined;
  set(key: string, value: boolean): void;
};

const KEY = 'done';

// A separate instance keeps the settings schema unchanged.
export const onboardingStorage: OnboardingStorage = createMMKV({ id: 'trek-onboarding' });

export function isOnboardingDone(storage: OnboardingStorage = onboardingStorage): boolean {
  return storage.getBoolean(KEY) === true;
}

export function markOnboardingDone(storage: OnboardingStorage = onboardingStorage): void {
  storage.set(KEY, true);
}
