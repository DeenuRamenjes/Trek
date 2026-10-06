import { Pressable, Text } from 'react-native';
import { screen } from '@testing-library/react-native';
import { renderWithTheme } from '../renderWithTheme';
import { expectAllPressablesLabelled } from '../a11y';

describe('expectAllPressablesLabelled', () => {
  it('passes for labelled pressables and counts them', async () => {
    await renderWithTheme(
      <>
        <Pressable accessibilityRole="button" accessibilityLabel="Go" onPress={() => undefined} />
        <Pressable accessibilityRole="button" onPress={() => undefined}>
          <Text>Visible name</Text>
        </Pressable>
      </>,
    );
    expect(expectAllPressablesLabelled()).toBe(2);
  });

  it('fails for a pressable with no name', async () => {
    await renderWithTheme(<Pressable accessibilityRole="button" onPress={() => undefined} />);
    expect(() => expectAllPressablesLabelled()).toThrow();
    expect(screen.root).toBeTruthy();
  });

  it('fails for a pressable with no role', async () => {
    await renderWithTheme(<Pressable accessibilityLabel="Go" onPress={() => undefined} />);
    expect(() => expectAllPressablesLabelled()).toThrow();
  });
});
