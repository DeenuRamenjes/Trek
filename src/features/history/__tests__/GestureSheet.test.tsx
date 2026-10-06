import { act, fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { strings } from '../../../strings/en';
import { renderWithTheme } from '../../../test/renderWithTheme';
import { expectAllPressablesLabelled } from '../../../test/a11y';
import { useSettings } from '../../settings/settingsStore';
import { GestureSheet, SHEET_OFFSCREEN } from '../GestureSheet';

type Style = { transform?: Record<string, number>[] };
const translateY = () => {
  const style = getAnimatedStyle(screen.getByTestId('gesture-sheet', { includeHiddenElements: true })) as unknown as Style;
  return style.transform?.find((t) => 'translateY' in t)?.translateY;
};

beforeEach(() => {
  jest.useFakeTimers();
  useSettings.getState().reset();
});
afterEach(() => jest.useRealTimers());

describe('GestureSheet', () => {
  it('slides in from below and settles at 0', async () => {
    useSettings.getState().update({ reduceMotionOverride: 'off' });
    await renderWithTheme(
      <GestureSheet title="Title" onClose={jest.fn()}>
        <Text>Body</Text>
      </GestureSheet>,
    );
    expect(translateY()).toBe(SHEET_OFFSCREEN);
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    expect(translateY()).toBe(0);
  });

  it('is in place immediately under reduce motion and closes at once from the scrim', async () => {
    useSettings.getState().update({ reduceMotionOverride: 'on' });
    const onClose = jest.fn();
    await renderWithTheme(
      <GestureSheet title="Title" onClose={onClose}>
        <Text>Body</Text>
      </GestureSheet>,
    );
    expect(translateY()).toBe(0);
    expect(expectAllPressablesLabelled()).toBe(1);
    await fireEvent.press(screen.getByLabelText(strings.today.closeSheet));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('animates out before closing when motion is on', async () => {
    useSettings.getState().update({ reduceMotionOverride: 'off' });
    const onClose = jest.fn();
    await renderWithTheme(
      <GestureSheet title="Title" onClose={onClose}>
        <Text>Body</Text>
      </GestureSheet>,
    );
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    await fireEvent.press(screen.getByLabelText(strings.today.closeSheet));
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
