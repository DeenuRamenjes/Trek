import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { useTheme } from './ThemeProvider';

/** Keeps the status bar icons and the native root background in step with the app's theme. */
export function ThemedSystemBars() {
  const { mode, colors } = useTheme();
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}
