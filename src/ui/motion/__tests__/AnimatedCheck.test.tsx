import { act, screen } from '@testing-library/react-native';
import { useSettings } from '../../../features/settings/settingsStore';
import { renderWithTheme, withTheme } from '../../../test/renderWithTheme';
import { AnimatedCheck } from '..';

// Path records its `end` shared value so the stroke progress can be read.
const mockEnds: { value: number }[] = [];
jest.mock('@shopify/react-native-skia', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Canvas: ({ children, testID }: { children: unknown; testID?: string }) => React.createElement(View, { testID }, children),
    Path: ({ end }: { end: { value: number } }) => {
      mockEnds.push(end);
      return null;
    },
  };
});

const progress = () => mockEnds[mockEnds.length - 1].value;

beforeEach(() => {
  jest.useFakeTimers();
  mockEnds.length = 0;
  useSettings.getState().reset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('AnimatedCheck progress', () => {
  it('draws the stroke over 250 ms when checked turns true', async () => {
    const view = await renderWithTheme(<AnimatedCheck checked={false} color="#000" testID="c" />);
    expect(progress()).toBe(0);
    await view.rerender(withTheme(<AnimatedCheck checked color="#000" testID="c" />));
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(progress()).toBeGreaterThan(0);
    expect(progress()).toBeLessThan(1);
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(progress()).toBe(1);
  });

  it('jumps to complete under reduce motion', async () => {
    useSettings.getState().update({ reduceMotionOverride: 'on' });
    const view = await renderWithTheme(<AnimatedCheck checked={false} color="#000" testID="c" />);
    await view.rerender(withTheme(<AnimatedCheck checked color="#000" testID="c" />));
    expect(progress()).toBe(1);
    expect(screen.getByTestId('c')).toBeTruthy();
  });

  it('starts complete when mounted checked', async () => {
    await renderWithTheme(<AnimatedCheck checked color="#000" testID="c" />);
    expect(progress()).toBe(1);
  });
});
