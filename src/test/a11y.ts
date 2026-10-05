import { screen } from '@testing-library/react-native';

/** Every button on screen must carry a non-empty accessibility label. */
export function expectAllButtonsLabelled(): number {
  const buttons = screen.queryAllByRole('button');
  for (const button of buttons) {
    const label = button.props.accessibilityLabel as unknown;
    expect(typeof label === 'string' && label.trim().length > 0).toBe(true);
  }
  return buttons.length;
}
