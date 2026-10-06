import { Redirect } from 'expo-router';
import { isOnboardingDone } from './onboardingStore';

/** Entry route target: first run goes to onboarding, every later run to Today. */
export function OnboardingGate() {
  return <Redirect href={isOnboardingDone() ? '/today' : '/onboarding'} />;
}
