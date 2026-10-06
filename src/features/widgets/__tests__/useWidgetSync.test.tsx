import { act, renderHook } from '@testing-library/react-native';
import { emitDbChanged } from '../../../db/changes';
import { DEFAULT_SETTINGS } from '../../../domain/settings';
import { refreshWidgets } from '../../../services/widgetBridge';
import { useSettings } from '../../settings/settingsStore';
import { useWidgetSync } from '../useWidgetSync';

jest.mock('../../../services/widgetBridge', () => ({ refreshWidgets: jest.fn(async () => undefined) }));
const refresh = refreshWidgets as jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  refresh.mockClear();
  useSettings.setState({ settings: { ...DEFAULT_SETTINGS } });
});
afterEach(() => jest.useRealTimers());

it('refreshes on mount, on debounced db change, and on rollover', async () => {
  await renderHook(() => useWidgetSync());
  expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => {
    emitDbChanged();
    emitDbChanged();
    jest.advanceTimersByTime(600);
  });
  expect(refresh).toHaveBeenCalledTimes(2);
  await act(async () => {
    jest.setSystemTime(Date.now() + 26 * 3600 * 1000);
    jest.advanceTimersByTime(25 * 3600 * 1000);
  });
  expect(refresh.mock.calls.length).toBeGreaterThanOrEqual(3);
});

it('refreshes when widget group or hide-names settings change', async () => {
  await renderHook(() => useWidgetSync());
  refresh.mockClear();
  await act(async () => {
    useSettings.setState({ settings: { ...useSettings.getState().settings, widget: { hideGoalNames: true } } });
    jest.advanceTimersByTime(600);
  });
  expect(refresh).toHaveBeenCalledTimes(1);
});
