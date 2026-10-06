import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import SettingsScreen from '../../../app/(tabs)/settings';
import { ThemeProvider } from '../../ui/ThemeProvider';
import { strings } from '../../strings/en';
import { expectAllPressablesLabelled } from '../../test/a11y';

const mockShare = jest.fn<Promise<boolean>, []>();
jest.mock('../errorLog', () => ({ shareErrorLog: () => mockShare() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../features/settings/NotificationsRow', () => ({ NotificationsRow: () => null }));
jest.mock('../../db/client', () => ({ getDb: jest.fn() }));
jest.mock('../../db/seed', () => ({ seedDemoData: jest.fn() }));

const renderScreen = () =>
  render(
    <ThemeProvider>
      <SettingsScreen />
    </ThemeProvider>,
  );

it('every settings pressable has a role and a name', async () => {
  await renderScreen();
  expect(expectAllPressablesLabelled()).toBeGreaterThan(3);
});

it('Export error log row shares the log', async () => {
  mockShare.mockResolvedValue(true);
  await renderScreen();
  await fireEvent.press(screen.getByLabelText(strings.errorLog.export));
  await waitFor(() => expect(mockShare).toHaveBeenCalledTimes(1));
  expect(screen.queryByText(strings.errorLog.empty)).toBeNull();
});

it('says so when nothing is logged and when sharing fails', async () => {
  mockShare.mockResolvedValueOnce(false);
  await renderScreen();
  await fireEvent.press(screen.getByLabelText(strings.errorLog.export));
  expect(await screen.findByText(strings.errorLog.empty)).toBeTruthy();
  mockShare.mockRejectedValueOnce(new Error('x'));
  await fireEvent.press(screen.getByLabelText(strings.errorLog.export));
  expect(await screen.findByText(strings.errorLog.failed)).toBeTruthy();
});
