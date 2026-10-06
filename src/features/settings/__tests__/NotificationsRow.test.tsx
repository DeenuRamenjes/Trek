import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { notificationsAdapter } from '../../../services/notifications/adapter';
import { strings } from '../../../strings/en';
import { ThemeProvider } from '../../../ui/ThemeProvider';
import { NotificationsRow } from '../NotificationsRow';

jest.mock('../../../services/notifications/adapter', () => ({
  notificationsAdapter: { getPermissions: jest.fn(), requestPermissions: jest.fn() },
}));

const get = notificationsAdapter.getPermissions as jest.Mock;
const request = notificationsAdapter.requestPermissions as jest.Mock;
const t = strings.settings.notifications;
const st = (status: string, canAskAgain = true) => ({ status, granted: status === 'granted', canAskAgain });

beforeEach(() => {
  get.mockReset();
  request.mockReset();
});

it('granted shows On and no button', async () => {
  get.mockResolvedValue(st('granted'));
  await render(<ThemeProvider mode="light"><NotificationsRow /></ThemeProvider>);
  await screen.findByText(t.on);
  expect(screen.queryByText(t.enable)).toBeNull();
  expect(screen.queryByText(t.openSettings)).toBeNull();
});

it('undetermined offers Turn on and requests', async () => {
  get.mockResolvedValue(st('undetermined'));
  request.mockResolvedValue(st('granted'));
  await render(<ThemeProvider mode="light"><NotificationsRow /></ThemeProvider>);
  await screen.findByText(t.notAsked);
  await fireEvent.press(screen.getByText(t.enable));
  await screen.findByText(t.on);
  expect(request).toHaveBeenCalledTimes(1);
});

it('blocked offers Open settings', async () => {
  get.mockResolvedValue(st('denied', false));
  const spy = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
  await render(<ThemeProvider mode="light"><NotificationsRow /></ThemeProvider>);
  await screen.findByText(t.blocked);
  await fireEvent.press(screen.getByText(t.openSettings));
  await waitFor(() => expect(spy).toHaveBeenCalled());
  expect(request).not.toHaveBeenCalled();
});
