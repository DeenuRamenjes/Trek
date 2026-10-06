import { renderHook, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { emitDbChanged } from '../../../db/changes';
import { useNotificationsLifecycle } from '../useNotificationsLifecycle';

const mockLc = { onForeground: jest.fn(async () => undefined), onDataChanged: jest.fn(), dispose: jest.fn(), runCycle: jest.fn() };
jest.mock('../runtime', () => ({ createRuntimeLifecycle: () => mockLc }));
jest.mock('../../../features/settings/settingsStore', () => ({
  useSettings: { subscribe: jest.fn(() => jest.fn()) },
}));

it('runs foreground on mount and when app becomes active, and cleans up', async () => {
  let handler: (s: string) => void = () => undefined;
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: string) => void) => {
    handler = h;
    return { remove };
  }) as never);
  const { unmount } = await renderHook(() => useNotificationsLifecycle());
  expect(mockLc.onForeground).toHaveBeenCalledTimes(1);
  await act(async () => handler('background'));
  expect(mockLc.onForeground).toHaveBeenCalledTimes(1);
  await act(async () => handler('active'));
  expect(mockLc.onForeground).toHaveBeenCalledTimes(2);
  emitDbChanged();
  expect(mockLc.onDataChanged).toHaveBeenCalledTimes(1);
  await unmount();
  expect(remove).toHaveBeenCalled();
  expect(mockLc.dispose).toHaveBeenCalled();
});
