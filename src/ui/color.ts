export type Rgb = { r: number; g: number; b: number };

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(value: string): boolean {
  return HEX_PATTERN.test(value);
}

export function hexToRgb(hex: string): Rgb {
  if (!isHexColor(hex)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const part = (c: number) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

function channelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG 2.x relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

/** WCAG 2.x contrast ratio, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export type ContrastUse = 'text' | 'largeText' | 'nonText';

const AA_MINIMUM: Record<ContrastUse, number> = { text: 4.5, largeText: 3, nonText: 3 };

export function meetsAA(foreground: string, background: string, use: ContrastUse = 'text'): boolean {
  return contrastRatio(foreground, background) >= AA_MINIMUM[use];
}

/** CIELAB L* (0 to 100) of a color, computed from its relative luminance. */
export function lightnessStar(hex: string): number {
  const y = relativeLuminance(hex);
  return y <= 216 / 24389 ? (y * 24389) / 27 : 116 * Math.cbrt(y) - 16;
}

type Hsl = { h: number; s: number; l: number };

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) {
    return { h: 0, s: 0, l };
  }
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) {
    h = (gn - bn) / d + (gn < bn ? 6 : 0);
  } else if (max === gn) {
    h = (bn - rn) / d + 2;
  } else {
    h = (rn - gn) / d + 4;
  }
  return { h: h * 60, s, l };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = l - c / 2;
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
}

/** The color with the same hue and saturation as `hex` whose L* equals `tone`. */
export function toneOf(hex: string, tone: number): string {
  if (tone <= 0) return '#000000';
  if (tone >= 100) return '#FFFFFF';
  const { h, s } = rgbToHsl(hexToRgb(hex));
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i += 1) {
    const mid = (lo + hi) / 2;
    if (lightnessStar(rgbToHex(hslToRgb({ h, s, l: mid }))) < tone) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return rgbToHex(hslToRgb({ h, s, l: (lo + hi) / 2 }));
}

export const TONES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100] as const;
export type Tone = (typeof TONES)[number];
export type TonalPalette = Record<Tone, string>;

export function tonalPalette(hex: string): TonalPalette {
  const palette = {} as TonalPalette;
  for (const tone of TONES) {
    palette[tone] = toneOf(hex, tone);
  }
  return palette;
}

/** Black or white, whichever contrasts more with `background`. */
export function readableOn(background: string): '#000000' | '#FFFFFF' {
  return contrastRatio('#000000', background) >= contrastRatio('#FFFFFF', background) ? '#000000' : '#FFFFFF';
}
