import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../ui/ThemeProvider';
import type { ColorMode } from '../ui/tokens';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export function renderWithTheme(ui: ReactElement, mode: ColorMode = 'light') {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider mode={mode}>{ui}</ThemeProvider>
    </SafeAreaProvider>,
  );
}
