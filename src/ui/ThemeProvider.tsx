import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { Motion } from './motion/Motion';
import { useReduceMotion } from './motion/preference';
import { durations } from './motion/tokens';
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
  const reduce = useReduceMotion();
  const background = theme.colors.background;
  // Cross-fade: when the background changes, a snapshot of the old one sits over the new tree and
  // fades out (opacity only). Set during render so the new tree never shows un-covered for a frame.
  const [snap, setSnap] = useState<{ bg: string; fade: { id: number; color: string } | null }>({ bg: background, fade: null });
  if (snap.bg !== background) {
    setSnap({ bg: background, fade: reduce ? null : { id: (snap.fade?.id ?? 0) + 1, color: snap.bg } });
  }
  const fadeId = snap.fade?.id;
  useEffect(() => {
    if (fadeId === undefined) return;
    const timer = setTimeout(() => setSnap((cur) => (cur.fade?.id === fadeId ? { ...cur, fade: null } : cur)), durations.base);
    return () => clearTimeout(timer);
  }, [fadeId]);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
      {snap.fade ? (
        <Motion
          key={snap.fade.id}
          testID="theme-crossfade"
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[StyleSheet.absoluteFill, { backgroundColor: snap.fade.color }]}
          from={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 'base', easing: 'standard' }}
        />
      ) : null}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return theme;
}
