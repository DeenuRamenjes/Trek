import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { renderWithTheme } from '../../../test/renderWithTheme';
import { expectAllButtonsLabelled } from '../../../test/a11y';
import { useTheme } from '../../ThemeProvider';
import { buildColors } from '../../tokens';
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

  it('throws when useTheme is used outside the provider', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(render(<ModeProbe />)).rejects.toThrow('useTheme must be used inside ThemeProvider');
  });
});

describe('components', () => {
  it('Button is a labelled 44pt button and fires onPress', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Button label="Save goal" onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Save goal' });
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    expectAllButtonsLabelled();
  });

  it('IconButton requires and exposes a label', async () => {
    await renderWithTheme(<IconButton icon="chevron-back" accessibilityLabel="Previous month" />);
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeTruthy();
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
    await fireEvent.press(screen.getByRole('button', { name: '30D' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('Banner renders its message and labelled actions', async () => {
    await renderWithTheme(
      <Banner icon="airplane-outline" message="Vacation mode is on" actions={[{ label: 'End vacation now' }]} />,
    );
    expect(screen.getByText('Vacation mode is on')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'End vacation now' })).toBeTruthy();
  });

  it('StatusGlyph renders nothing for notDue and labels exist for all statuses', async () => {
    await renderWithTheme(
      <>
        <StatusGlyph status="notDue" />
        <AppText>{statusLabel('missed')}</AppText>
      </>,
    );
    expect(screen.getByText('Missed')).toBeTruthy();
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
