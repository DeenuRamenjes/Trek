import { render } from '@testing-library/react-native';
import { OnboardingGate } from '../OnboardingGate';
import { markOnboardingDone, onboardingStorage } from '../onboardingStore';

jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  return { Redirect: ({ href }: { href: string }) => <Text testID="redirect">{href}</Text> };
});

it('redirects to onboarding on first run only', async () => {
  onboardingStorage.set('done', false);
  const first = await render(<OnboardingGate />);
  expect(first.getByTestId('redirect').props.children).toBe('/onboarding');
  await first.unmount();
  markOnboardingDone(onboardingStorage);
  const second = await render(<OnboardingGate />);
  expect(second.getByTestId('redirect').props.children).toBe('/today');
});
