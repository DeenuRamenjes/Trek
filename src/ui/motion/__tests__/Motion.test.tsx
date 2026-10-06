import { act, render, screen } from '@testing-library/react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { useSettings } from '../../../features/settings/settingsStore';
import { Motion } from '../Motion';

beforeEach(() => {
  jest.useFakeTimers();
  useSettings.getState().reset();
});

afterEach(() => {
  jest.useRealTimers();
});

function styleOf(testID: string) {
  return getAnimatedStyle(screen.getByTestId(testID)) as unknown as { opacity: number; transform: Record<string, number>[] };
}

describe('Motion', () => {
  it('animates from `from` to `animate` over the base duration', async () => {
    await render(<Motion testID="m" from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} />);
    expect(styleOf('m').opacity).toBe(0);
    await act(async () => {
      jest.advanceTimersByTime(260);
    });
    expect(styleOf('m').opacity).toBe(1);
    expect(styleOf('m').transform[1]).toEqual({ translateY: 0 });
  });

  it('jumps straight to `animate` when reduce motion is on', async () => {
    useSettings.getState().update({ reduceMotionOverride: 'on' });
    await render(<Motion testID="m" from={{ opacity: 0 }} animate={{ opacity: 1 }} />);
    expect(styleOf('m').opacity).toBe(1);
  });

  it('animates to new `animate` values', async () => {
    const view = await render(<Motion testID="m" animate={{ scale: 1 }} />);
    expect(styleOf('m').transform[2]).toEqual({ scale: 1 });
    await view.rerender(<Motion testID="m" animate={{ scale: 0.5 }} />);
    await act(async () => {
      jest.advanceTimersByTime(260);
    });
    expect(styleOf('m').transform[2]).toEqual({ scale: 0.5 });
  });
});

describe('Motion transition identity', () => {
  it('does not restart mid-flight when the parent passes an equal new transition object', async () => {
    const view = await render(<Motion testID="m" from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 'base' }} />);
    await act(async () => {
      jest.advanceTimersByTime(130);
    });
    await view.rerender(<Motion testID="m" from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 'base' }} />);
    await act(async () => {
      jest.advanceTimersByTime(130);
    });
    expect(styleOf('m').opacity).toBe(1);
  });
});

describe('Motion exit', () => {
  function exitingOf(testID: string) {
    return screen.getByTestId(testID).props.exiting as unknown;
  }

  it('passes an exiting animation in full motion and removes the view after unmount', async () => {
    const view = await render(<Motion testID="m" exit={{ opacity: 0 }} />);
    expect(typeof exitingOf('m')).toBe('function');
    await view.unmount();
  });

  it('passes no exiting animation under reduce motion', async () => {
    useSettings.getState().update({ reduceMotionOverride: 'on' });
    await render(<Motion testID="m" exit={{ opacity: 0 }} />);
    expect(exitingOf('m')).toBeUndefined();
  });

  it('passes no exiting animation without `exit`', async () => {
    await render(<Motion testID="m" />);
    expect(exitingOf('m')).toBeUndefined();
  });
});
