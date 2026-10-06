import {
  contrastRatio,
  hexToRgb,
  isHexColor,
  lightnessStar,
  meetsAA,
  readableOn,
  relativeLuminance,
  rgbToHex,
  TONES,
  tonalPalette,
  toneOf,
} from '../color';

describe('hex parsing', () => {
  it('accepts #RRGGBB only', () => {
    expect(isHexColor('#2E7D5B')).toBe(true);
    expect(isHexColor('#2e7d5b')).toBe(true);
    expect(isHexColor('2E7D5B')).toBe(false);
    expect(isHexColor('#FFF')).toBe(false);
  });

  it('round-trips hex through rgb', () => {
    expect(hexToRgb('#2E7D5B')).toEqual({ r: 46, g: 125, b: 91 });
    expect(rgbToHex({ r: 46, g: 125, b: 91 })).toBe('#2E7D5B');
  });

  it('throws on invalid hex', () => {
    expect(() => hexToRgb('red')).toThrow('Invalid hex color: red');
  });
});

describe('WCAG contrast', () => {
  it('computes luminance of black and white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 10);
  });

  it('computes the 21:1 maximum and 1:1 minimum', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#2E7D5B', '#FFFFFF')).toBeCloseTo(contrastRatio('#FFFFFF', '#2E7D5B'), 10);
  });

  it('applies AA thresholds per use', () => {
    // #767676 on white is the classic 4.54:1 boundary color.
    expect(meetsAA('#767676', '#FFFFFF', 'text')).toBe(true);
    expect(meetsAA('#777777', '#FFFFFF', 'text')).toBe(false);
    expect(meetsAA('#949494', '#FFFFFF', 'nonText')).toBe(true);
    expect(meetsAA('#959595', '#FFFFFF', 'largeText')).toBe(false);
  });

  it('picks black or white for readability', () => {
    expect(readableOn('#FFFFFF')).toBe('#000000');
    expect(readableOn('#111214')).toBe('#FFFFFF');
  });
});

describe('tonal palette', () => {
  it('has every tone', () => {
    expect(Object.keys(tonalPalette('#2E7D5B')).map(Number)).toEqual([...TONES]);
  });

  it('pins tone 0 and 100 to black and white', () => {
    const p = tonalPalette('#2E7D5B');
    expect(p[0]).toBe('#000000');
    expect(p[100]).toBe('#FFFFFF');
  });

  it.each([10, 20, 30, 40, 50, 60, 70, 80, 90, 95])('places tone %i within 1.5 L* of target', (tone) => {
    expect(Math.abs(lightnessStar(toneOf('#2E7D5B', tone)) - tone)).toBeLessThan(1.5);
  });

  it('gets lighter as tone increases', () => {
    const p = tonalPalette('#4F5BD5');
    const lums = TONES.map((t) => relativeLuminance(p[t]));
    for (let i = 1; i < lums.length; i += 1) {
      expect(lums[i]).toBeGreaterThanOrEqual(lums[i - 1]);
    }
  });

  it('gives tone 40 AA contrast with white for saturated hues', () => {
    for (const hex of ['#2E7D5B', '#4F5BD5', '#C0392B', '#B26A00', '#E0C35A']) {
      expect(meetsAA(toneOf(hex, 40), '#FFFFFF', 'text')).toBe(true);
    }
  });
});
