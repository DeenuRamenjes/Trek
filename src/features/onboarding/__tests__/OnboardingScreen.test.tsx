import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { strings } from '../../../strings/en';
import { renderWithTheme } from '../../../test/renderWithTheme';
import { useSettings } from '../../settings/settingsStore';
import { OnboardingScreen } from '../OnboardingScreen';
import { isOnboardingDone, onboardingStorage } from '../onboardingStore';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockEnsure = jest.fn();
jest.mock('../../../services/notifications/permissions', () => ({
  ensureNotificationPermission: (...args: unknown[]) => mockEnsure(...args),
}));
jest.mock('../../../services/notifications/adapter', () => ({ notificationsAdapter: {} }));

const o = strings.onboarding;

beforeEach(() => {
  mockReplace.mockClear();
  mockEnsure.mockReset().mockResolvedValue(true);
  useSettings.getState().reset();
  onboardingStorage.set('done', false);
});

it('walks three pages and requests permission only on the last', async () => {
  await renderWithTheme(<OnboardingScreen />);
  await screen.findByText(o.pages[0].title);
  await fireEvent.press(screen.getByLabelText(o.next));
  await screen.findByText(o.pages[1].title);
  expect(mockEnsure).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText(o.next));
  await screen.findByText(o.pages[2].title);
  expect(mockEnsure).not.toHaveBeenCalled();
  expect(isOnboardingDone(onboardingStorage)).toBe(false);

  await fireEvent.press(screen.getByLabelText(o.enable));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/today'));
  expect(mockEnsure).toHaveBeenCalledTimes(1);
  expect(isOnboardingDone(onboardingStorage)).toBe(true);
});

it('still routes to Today when permission is denied', async () => {
  mockEnsure.mockResolvedValue(false);
  await renderWithTheme(<OnboardingScreen />);
  await fireEvent.press(screen.getByLabelText(o.next));
  await fireEvent.press(screen.getByLabelText(o.next));
  await fireEvent.press(await screen.findByLabelText(o.enable));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/today'));
  expect(isOnboardingDone(onboardingStorage)).toBe(true);
});

it('not now skips the permission request', async () => {
  await renderWithTheme(<OnboardingScreen />);
  await fireEvent.press(screen.getByLabelText(o.next));
  await fireEvent.press(screen.getByLabelText(o.next));
  await fireEvent.press(await screen.findByLabelText(o.notNow));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/today'));
  expect(mockEnsure).not.toHaveBeenCalled();
  expect(isOnboardingDone(onboardingStorage)).toBe(true);
});

it('reduce motion renders the page at its final state immediately', async () => {
  useSettings.getState().update({ reduceMotionOverride: 'on' });
  await renderWithTheme(<OnboardingScreen />);
  const page = await screen.findByTestId('onboarding-page');
  const style = StyleSheet.flatten(page.props.style);
  expect(style.opacity).toBe(1);
});
