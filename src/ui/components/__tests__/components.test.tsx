import { fireEvent, render, screen } from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { strings } from '../../../strings/en';
import { renderWithTheme } from '../../../test/renderWithTheme';
import { expectAllButtonsLabelled } from '../../../test/a11y';
import { ThemeProvider, useTheme } from '../../ThemeProvider';
import { buildColors, minTapTarget, StatusKey } from '../../tokens';
import { AppText, Banner, Button, Card, GoalIcon, IconButton, Screen, SegmentedControl, StatusGlyph, statusLabel } from '..';

function ModeProbe() {
  const { mode, colors } = useTheme();
  return <Text>{`${mode} ${colors.background}`}</Text>;
}

describe('ThemeProvider', () => {
  it('provides light and dark tokens', async () => {
    await renderWithTheme(<ModeProbe />, 'dark');
    expect(screen.getByText(`dark ${buildColors('dark').background}`)).toBeTruthy();
  });

  it('follows the system color scheme when no mode is forced', async () => {
    const spy = jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');
    try {
      await render(
        <ThemeProvider>
          <ModeProbe />
        </ThemeProvider>,
      );
      expect(screen.getByText(`dark ${buildColors('dark').background}`)).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });

  it('builds the accent from the accent prop', async () => {
    function AccentProbe() {
      const { colors } = useTheme();
      return <Text>{colors.accent}</Text>;
    }
    await render(
      <ThemeProvider mode="light" accent="#4F5BD5">
        <AccentProbe />
      </ThemeProvider>,
    );
    expect(screen.getByText(buildColors('light', '#4F5BD5').accent)).toBeTruthy();
  });

  it('throws when useTheme is used outside the provider', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(render(<ModeProbe />)).rejects.toThrow('useTheme must be used inside ThemeProvider');
    } finally {
      consoleError.mockRestore();
    }
  });
});

const STATUSES: StatusKey[] = ['done', 'partial', 'skipped', 'vacation', 'missed', 'pending', 'notDue'];

function flatStyle(element: { props: { style?: unknown } }) {
  return StyleSheet.flatten(element.props.style as never) as Record<string, unknown>;
}

describe('components', () => {
  it('Button is a labelled 44pt button and fires onPress', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Button label="Save goal" onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Save goal' });
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(flatStyle(button).minHeight).toBe(minTapTarget);
    expect(expectAllButtonsLabelled()).toBe(1);
  });

  it('IconButton requires and exposes a label', async () => {
    await renderWithTheme(<IconButton icon="chevron-back" accessibilityLabel="Previous month" />);
    const button = screen.getByRole('button', { name: 'Previous month' });
    expect(flatStyle(button).width).toBe(minTapTarget);
    expect(flatStyle(button).height).toBe(minTapTarget);
  });

  it('SegmentedControl marks the selected segment', async () => {
    const onChange = jest.fn();
    await renderWithTheme(
      <SegmentedControl
        accessibilityLabel="Date range"
        segments={[
          { value: 'a', label: '7D' },
          { value: 'b', label: '30D' },
        ]}
        selected="a"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('button', { name: '7D' }).props.accessibilityState).toEqual({ selected: true });
    expect(flatStyle(screen.getByRole('button', { name: '30D' })).minHeight).toBe(minTapTarget);
    expect(expectAllButtonsLabelled()).toBe(2);
    await fireEvent.press(screen.getByRole('button', { name: '30D' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('Banner renders its message and labelled actions', async () => {
    await renderWithTheme(
      <Banner icon="airplane-outline" message="Vacation mode is on" actions={[{ label: 'End vacation now' }]} />,
    );
    expect(screen.getByText('Vacation mode is on')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'End vacation now' })).toBeTruthy();
    expect(expectAllButtonsLabelled()).toBe(1);
  });

  it.each(STATUSES)('StatusGlyph for %s renders an icon unless the status is notDue', async (status) => {
    await renderWithTheme(
      <View testID="glyph">
        <StatusGlyph status={status} />
      </View>,
    );
    expect(screen.getByTestId('glyph').children).toHaveLength(status === 'notDue' ? 0 : 1);
  });

  it('statusLabel gives the strings label for every status', () => {
    for (const status of STATUSES) {
      expect(statusLabel(status)).toBe(strings.status[status]);
    }
    expect(statusLabel('missed')).toBe('Missed');
  });

  it('Screen pads only the requested safe-area edges', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}
      >
        <ThemeProvider mode="light">
          <Screen edges={['top']}>
            <Text>Edges</Text>
          </Screen>
        </ThemeProvider>
      </SafeAreaProvider>,
    );
    const padded = screen.getByText('Edges');
    let node: typeof padded | null = padded;
    while (node && node.props.edges === undefined) node = node.parent;
    expect(node?.props.edges).toEqual({ top: 'additive', right: 'off', bottom: 'off', left: 'off' });
  });

  it('renders Screen, Card and GoalIcon in both modes', async () => {
    for (const mode of ['light', 'dark'] as const) {
      await renderWithTheme(
        <Screen>
          <Card>
            <GoalIcon icon="book" color="#2F6FB0" />
            <AppText variant="headline">Reading</AppText>
          </Card>
        </Screen>,
        mode,
      );
      expect(screen.getByText('Reading')).toBeTruthy();
    }
  });
});
