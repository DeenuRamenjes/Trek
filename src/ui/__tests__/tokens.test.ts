import { contrastRatio, meetsAA } from '../color';
import {
  buildColors,
  ColorMode,
  DEFAULT_ACCENT,
  fontWeights,
  goalColorFor,
  goalPalette,
  minTapTarget,
  spacing,
  StatusKey,
  typography,
} from '../tokens';

const MODES: ColorMode[] = ['light', 'dark'];
const STATUSES: StatusKey[] = ['done', 'partial', 'skipped', 'vacation', 'missed', 'pending', 'notDue'];

describe('layout tokens', () => {
  it('uses the 8pt grid (xs is the single 4pt half step)', () => {
    const { xs, ...rest } = spacing;
    expect(xs).toBe(4);
    for (const value of Object.values(rest)) {
      expect(value % 8).toBe(0);
    }
  });

  it('uses a 44pt minimum tap target', () => {
    expect(minTapTarget).toBe(44);
  });

  it('uses at most two font weights', () => {
    const used = new Set(Object.values(typography).map((t) => t.fontWeight));
    expect(used.size).toBeLessThanOrEqual(2);
    expect([...used].every((w) => Object.values(fontWeights).includes(w))).toBe(true);
  });
});

describe.each(MODES)('%s colors', (mode) => {
  const c = buildColors(mode);

  it.each(['background', 'surface', 'surfaceMuted'] as const)('text is AA on %s', (bg) => {
    expect(meetsAA(c.textPrimary, c[bg], 'text')).toBe(true);
    expect(meetsAA(c.textSecondary, c[bg], 'text')).toBe(true);
  });

  it('onAccent is AA on accent', () => {
    expect(meetsAA(c.onAccent, c.accent, 'text')).toBe(true);
  });

  it('accent is visible (3:1) on background and surface', () => {
    expect(contrastRatio(c.accent, c.background)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(c.accent, c.surface)).toBeGreaterThanOrEqual(3);
  });

  it.each(STATUSES)('status %s is visible (3:1) on background and surface', (status) => {
    expect(meetsAA(c.status[status], c.background, 'nonText')).toBe(true);
    expect(meetsAA(c.status[status], c.surface, 'nonText')).toBe(true);
  });

  it('every curated goal color is visible (3:1) on background and surface', () => {
    for (const hex of goalPalette[mode]) {
      expect(meetsAA(hex, c.background, 'nonText')).toBe(true);
      expect(meetsAA(hex, c.surface, 'nonText')).toBe(true);
    }
  });
});

describe('accent', () => {
  it('defaults to the Trek green', () => {
    expect(DEFAULT_ACCENT).toBe('#2E7D5B');
  });

  it('returns a fresh status object on every call', () => {
    const first = buildColors('light');
    first.status.done = '#000000';
    expect(buildColors('light').status.done).toBe('#2E7D5B');
  });

  it('derives a different accent per mode from one hex', () => {
    expect(buildColors('light', '#4F5BD5').accent).not.toBe(buildColors('dark', '#4F5BD5').accent);
  });
});

describe('goalColorFor', () => {
  it('maps a curated light color to its dark twin', () => {
    expect(goalColorFor('dark', '#2F6FB0')).toBe('#7DB3F0');
    expect(goalColorFor('light', '#2f6fb0')).toBe('#2F6FB0');
  });

  it('returns custom colors unchanged', () => {
    expect(goalColorFor('dark', '#123456')).toBe('#123456');
  });

  it('keeps both palettes the same length', () => {
    expect(goalPalette.light).toHaveLength(goalPalette.dark.length);
  });
});
