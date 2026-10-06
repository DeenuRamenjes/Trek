import { isOnboardingDone, markOnboardingDone, type OnboardingStorage } from '../onboardingStore';

function fakeStorage(): OnboardingStorage {
  const map = new Map<string, boolean>();
  return { getBoolean: (k) => map.get(k), set: (k, v) => void map.set(k, v) };
}

it('is not done on first run and done after marking', () => {
  const storage = fakeStorage();
  expect(isOnboardingDone(storage)).toBe(false);
  markOnboardingDone(storage);
  expect(isOnboardingDone(storage)).toBe(true);
});
