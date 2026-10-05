import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { DEFAULT_SETTINGS } from '../../domain/settings';
import { useSettings } from '../../features/settings/settingsStore';
import { ThemeProvider } from '../ThemeProvider';

const HIDDEN = { includeHiddenElements: true };

beforeEach(() => {
  jest.useFakeTimers();
  useSettings.setState({ settings: DEFAULT_SETTINGS });
});
afterEach(() => jest.useRealTimers());

const tree = (mode: 'light' | 'dark') => (
  <ThemeProvider mode={mode}>
    <Text>x</Text>
  </ThemeProvider>
);

it('shows no overlay on first render', async () => {
  await render(tree('light'));
  expect(screen.queryByTestId('theme-crossfade', HIDDEN)).toBeNull();
});

it('shows overlay on theme change then removes it', async () => {
  const { rerender } = await render(tree('light'));
  await rerender(tree('dark'));
  expect(screen.getByTestId('theme-crossfade', HIDDEN)).toBeTruthy();
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  expect(screen.queryByTestId('theme-crossfade', HIDDEN)).toBeNull();
});

it('shows no overlay when reduce motion is on', async () => {
  useSettings.setState({ settings: { ...DEFAULT_SETTINGS, reduceMotionOverride: 'on' } });
  const { rerender } = await render(tree('light'));
  await rerender(tree('dark'));
  expect(screen.queryByTestId('theme-crossfade', HIDDEN)).toBeNull();
});
