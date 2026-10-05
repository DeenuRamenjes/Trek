import { createContext, ReactNode, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { buildColors, ColorMode, ColorTokens, DEFAULT_ACCENT } from './tokens';

export type Theme = {
  mode: ColorMode;
  colors: ColorTokens;
};

const ThemeContext = createContext<Theme | null>(null);

type Props = {
  /** Forces a mode; when omitted the system color scheme is used. */
  mode?: ColorMode;
  accent?: string;
  children: ReactNode;
};

export function ThemeProvider({ mode, accent = DEFAULT_ACCENT, children }: Props) {
  const system = useColorScheme();
  const resolved: ColorMode = mode ?? (system === 'dark' ? 'dark' : 'light');
  const theme = useMemo<Theme>(() => ({ mode: resolved, colors: buildColors(resolved, accent) }), [resolved, accent]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return theme;
}
