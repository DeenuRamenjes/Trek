import { act, renderHook } from '@testing-library/react-native';
import { DEFAULT_SETTINGS } from '../../../domain/settings';
import { useSettings } from '../../../features/settings/settingsStore';
import { useNotificationsLifecycle } from '../useNotificationsLifecycle';

const mockLc = { onForeground: jest.fn(async () => undefined), onDataChanged: jest.fn(), dispose: jest.fn(), runCycle: jest.fn() };
jest.mock('../runtime', () => ({ createRuntimeLifecycle: () => mockLc }));

beforeEach(() => {
  mockLc.onDataChanged.mockClear();
  useSettings.setState({ settings: DEFAULT_SETTINGS });
});

it('reconciles when dayEndsAt or weekStart changes, not for appearance-only settings', async () => {
  await renderHook(() => useNotificationsLifecycle());
  await act(async () => useSettings.getState().update({ dayEndsAt: 3 }));
  expect(mockLc.onDataChanged).toHaveBeenCalledTimes(1);
  await act(async () => useSettings.getState().update({ weekStart: 0 }));
  expect(mockLc.onDataChanged).toHaveBeenCalledTimes(2);
  await act(async () => useSettings.getState().update({ theme: 'dark', haptics: false }));
  expect(mockLc.onDataChanged).toHaveBeenCalledTimes(2);
});
