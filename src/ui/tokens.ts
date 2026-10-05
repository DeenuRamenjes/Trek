import { readableOn, tonalPalette } from './color';

export type ColorMode = 'light' | 'dark';

/** 8pt grid. `xs` (4) is the only half step and is reserved for icon-to-label gaps. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/** Minimum tap target in points. */
export const minTapTarget = 44;

/** At most two font weights. */
export const fontWeights = {
  regular: '400',
  semibold: '600',
} as const;

export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: fontWeights.semibold },
  title: { fontSize: 22, lineHeight: 28, fontWeight: fontWeights.semibold },
  headline: { fontSize: 17, lineHeight: 24, fontWeight: fontWeights.semibold },
  body: { fontSize: 15, lineHeight: 20, fontWeight: fontWeights.regular },
  label: { fontSize: 13, lineHeight: 16, fontWeight: fontWeights.semibold },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: fontWeights.regular },
} as const;

export type TypographyVariant = keyof typeof typography;

export const DEFAULT_ACCENT = '#2E7D5B';

export type StatusKey = 'done' | 'partial' | 'skipped' | 'vacation' | 'missed' | 'pending' | 'notDue';

type Neutrals = {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
};

const neutrals: Record<ColorMode, Neutrals> = {
  light: {
    background: '#F7F7F5',
    surface: '#FFFFFF',
    surfaceMuted: '#EFEFEC',
    border: '#E2E2DE',
    textPrimary: '#1B1C1E',
    textSecondary: '#5C5F66',
  },
  dark: {
    background: '#111214',
    surface: '#1B1C1F',
    surfaceMuted: '#25262A',
    border: '#34363B',
    textPrimary: '#F2F2F3',
    textSecondary: '#A3A6AD',
  },
};

const statusColors: Record<ColorMode, Record<StatusKey, string>> = {
  light: {
    done: '#2E7D5B',
    partial: '#B26A00',
    skipped: '#6B6F76',
    vacation: '#2F6FB0',
    missed: '#C0392B',
    pending: '#6B6F76',
    notDue: '#6B6F76',
  },
  dark: {
    done: '#5CC49A',
    partial: '#F0A443',
    skipped: '#9EA2A9',
    vacation: '#7DB3F0',
    missed: '#F07A6E',
    pending: '#9EA2A9',
    notDue: '#9EA2A9',
  },
};

/** Curated goal and group colors; index i is the same color in both modes. */
export const goalPalette: Record<ColorMode, readonly string[]> = {
  light: ['#2E7D5B', '#2F6FB0', '#7A4FC2', '#B23A7A', '#C0392B', '#B26A00', '#8A6D00', '#1F7A8C', '#4F5BD5', '#5C6B73'],
  dark: ['#5CC49A', '#7DB3F0', '#B596F2', '#F08CC0', '#F07A6E', '#F0A443', '#E0C35A', '#5FC6D8', '#9AA3F5', '#A9B6BD'],
};

export type ColorTokens = Neutrals & {
  accent: string;
  onAccent: string;
  accentMuted: string;
  status: Record<StatusKey, string>;
  overlay: string;
};

export function buildColors(mode: ColorMode, accentHex: string = DEFAULT_ACCENT): ColorTokens {
  const tones = tonalPalette(accentHex);
  const accent = mode === 'light' ? tones[40] : tones[80];
  return {
    ...neutrals[mode],
    accent,
    onAccent: readableOn(accent),
    accentMuted: mode === 'light' ? tones[95] : tones[20],
    status: statusColors[mode],
    overlay: mode === 'light' ? 'rgba(17, 18, 20, 0.4)' : 'rgba(0, 0, 0, 0.6)',
  };
}

/** Theme-aware variant of a curated goal color stored by its light-mode hex. */
export function goalColorFor(mode: ColorMode, storedHex: string): string {
  const index = goalPalette.light.indexOf(storedHex.toUpperCase());
  return index === -1 ? storedHex : goalPalette[mode][index];
}
