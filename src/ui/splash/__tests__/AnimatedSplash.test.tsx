import { act, screen, waitFor } from '@testing-library/react-native';
import { useSettings } from '../../../features/settings/settingsStore';
import { renderWithTheme } from '../../../test/renderWithTheme';
import { AnimatedSplash } from '../AnimatedSplash';

beforeEach(() => {
  jest.useFakeTimers();
  useSettings.getState().reset();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('AnimatedSplash', () => {
  it('renders the overlay at the start', async () => {
    await renderWithTheme(<AnimatedSplash onFinish={jest.fn()} />);
    expect(screen.getByTestId('animated-splash', { includeHiddenElements: true })).toBeTruthy();
  });

  it('finishes at 1200 ms and not before', async () => {
    const onFinish = jest.fn();
    await renderWithTheme(<AnimatedSplash onFinish={onFinish} />);
    await act(async () => {
      jest.advanceTimersByTime(1199);
    });
    expect(onFinish).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('finishes immediately without an overlay under reduce motion', async () => {
    useSettings.getState().update({ reduceMotionOverride: 'on' });
    const onFinish = jest.fn();
    await renderWithTheme(<AnimatedSplash onFinish={onFinish} />);
    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('animated-splash', { includeHiddenElements: true })).toBeNull();
  });
});
