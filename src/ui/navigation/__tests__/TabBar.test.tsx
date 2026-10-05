import { act, fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { useSettings } from '../../../features/settings/settingsStore';
import { strings } from '../../../strings/en';
import { renderWithTheme } from '../../../test/renderWithTheme';
import { TabBar } from '../TabBar';

const names = ['today', 'stats', 'goals', 'settings'] as const;
const labels = [strings.tabs.today, strings.tabs.stats, strings.tabs.goals, strings.tabs.settings];

function setup(index = 0) {
  const emit = jest.fn(() => ({ defaultPrevented: false }));
  const navigate = jest.fn();
  const state = { index, routes: names.map((name) => ({ key: `${name}-key`, name })) };
  return { emit, navigate, ui: <TabBar state={state} navigation={{ emit, navigate }} /> };
}

beforeEach(() => {
  jest.useFakeTimers();
  useSettings.getState().reset();
});

afterEach(() => {
  jest.useRealTimers();
});

function translateX() {
  const style = getAnimatedStyle(screen.getByTestId('tab-indicator')) as unknown as { transform: Record<string, number>[] };
  return style.transform.find((t) => 'translateX' in t)?.translateX;
}

describe('TabBar', () => {
  it('renders four tabs with labels, role and selected state', async () => {
    const { ui } = setup(1);
    await renderWithTheme(ui);
    expect(screen.getByTestId('tab-bar').props.accessibilityLabel).toBe(strings.navigation.tabBar);
    expect(screen.getByTestId('tab-bar').props.accessibilityRole).toBe('tablist');
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    labels.forEach((label, i) => {
      const tab = screen.getByRole('tab', { name: label });
      expect(tab.props.accessibilityState.selected).toBe(i === 1);
    });
  });

  it('emits tabPress and navigates when an unfocused tab is pressed', async () => {
    const { ui, emit, navigate } = setup(0);
    await renderWithTheme(ui);
    await fireEvent.press(screen.getByRole('tab', { name: strings.tabs.goals }));
    expect(emit).toHaveBeenCalledWith({ type: 'tabPress', target: 'goals-key', canPreventDefault: true });
    expect(navigate).toHaveBeenCalledWith('goals', undefined);
  });

  it('does not navigate when the focused tab is pressed', async () => {
    const { ui, navigate } = setup(0);
    await renderWithTheme(ui);
    await fireEvent.press(screen.getByRole('tab', { name: strings.tabs.today }));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps every tab at least 44 pt tall', async () => {
    const { ui } = setup(0);
    await renderWithTheme(ui);
    for (const tab of screen.getAllByRole('tab')) {
      const flat = StyleSheet.flatten(tab.props.style) as { minHeight?: number };
      expect(flat.minHeight).toBeGreaterThanOrEqual(44);
    }
  });

  it('springs the indicator to index * tabWidth after layout', async () => {
    const { ui } = setup(2);
    await renderWithTheme(ui);
    await fireEvent(screen.getByTestId('tab-bar'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 80 } } });
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    expect(translateX()).toBeCloseTo(200, 0);
  });

  it('sets the indicator at once under reduce motion', async () => {
    useSettings.getState().update({ reduceMotionOverride: 'on' });
    const { ui } = setup(3);
    await renderWithTheme(ui);
    await fireEvent(screen.getByTestId('tab-bar'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 80 } } });
    await act(async () => {
      jest.advanceTimersByTime(20);
    });
    expect(translateX()).toBe(300);
  });
});
