import { durations, easings, splashTiming, springs, staggerDelay } from '../tokens';

describe('motion tokens', () => {
  it('uses the 150/250/400 ms duration scale', () => {
    expect(durations).toEqual({ fast: 150, base: 250, slow: 400 });
  });

  it('defines gentle, snappy and bouncy springs', () => {
    expect(Object.keys(springs)).toEqual(['gentle', 'snappy', 'bouncy']);
    expect(springs.bouncy.damping).toBeLessThan(springs.gentle.damping);
  });

  it('defines standard, enter and exit easings as 4-point beziers', () => {
    for (const curve of Object.values(easings)) {
      expect(curve).toHaveLength(4);
    }
  });

  it('staggers 40 ms per item and caps at the 8th item', () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(3)).toBe(120);
    expect(staggerDelay(7)).toBe(280);
    expect(staggerDelay(20)).toBe(280);
    expect(staggerDelay(-1)).toBe(0);
  });

  it('treats NaN as the first item and floors fractional indexes', () => {
    expect(staggerDelay(Number.NaN)).toBe(0);
    expect(staggerDelay(2.5)).toBe(80);
  });

  it('orders springs from soft to stiff', () => {
    expect(springs.gentle.stiffness).toBeLessThan(springs.snappy.stiffness);
    expect(springs.snappy.damping).toBeLessThan(springs.gentle.damping);
  });

  it('keeps bezier x control points within [0, 1]', () => {
    for (const [x1, , x2] of Object.values(easings)) {
      expect(x1).toBeGreaterThanOrEqual(0);
      expect(x1).toBeLessThanOrEqual(1);
      expect(x2).toBeGreaterThanOrEqual(0);
      expect(x2).toBeLessThanOrEqual(1);
    }
  });

  it('keeps the animated splash within 1.2 s', () => {
    expect(splashTiming.totalMs).toBeLessThanOrEqual(1200);
    expect(splashTiming.crossFadeStartMs + splashTiming.crossFadeMs).toBe(splashTiming.totalMs);
    expect(splashTiming.crossFadeMs).toBe(durations.base);
    expect(splashTiming.markDrawMs).toBeLessThan(splashTiming.crossFadeStartMs);
    expect(splashTiming.wordmarkDelayMs + splashTiming.wordmarkMs).toBeLessThan(splashTiming.crossFadeStartMs);
  });
});
