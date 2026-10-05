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

  it('keeps the animated splash within 1.2 s', () => {
    expect(splashTiming.totalMs).toBeLessThanOrEqual(1200);
    expect(splashTiming.crossFadeStartMs + durations.base).toBeLessThanOrEqual(splashTiming.totalMs);
    expect(splashTiming.wordmarkDelayMs + splashTiming.wordmarkMs).toBeLessThan(splashTiming.crossFadeStartMs);
  });
});
