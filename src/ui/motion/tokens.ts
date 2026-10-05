/** Motion tokens. Pure data; the Reanimated mapping lives in src/ui/motion (Phase 1). */
export const durations = {
  fast: 150,
  base: 250,
  slow: 400,
} as const;

export type SpringPreset = { damping: number; stiffness: number; mass: number };

export const springs = {
  gentle: { damping: 20, stiffness: 120, mass: 1 },
  snappy: { damping: 18, stiffness: 260, mass: 1 },
  bouncy: { damping: 10, stiffness: 180, mass: 1 },
} as const satisfies Record<string, SpringPreset>;

/** Cubic bezier control points [x1, y1, x2, y2]. */
export type Bezier = readonly [number, number, number, number];

export const easings = {
  standard: [0.2, 0, 0, 1],
  enter: [0, 0, 0, 1],
  exit: [0.3, 0, 1, 1],
} as const satisfies Record<string, Bezier>;

export const stagger = {
  stepMs: 40,
  maxItems: 8,
} as const;

/** Delay for the item at `index` in a staggered list. */
export function staggerDelay(index: number): number {
  return Math.min(Math.max(index, 0), stagger.maxItems - 1) * stagger.stepMs;
}

export const splashTiming = {
  totalMs: 1200,
  markDrawMs: 500,
  wordmarkDelayMs: 300,
  wordmarkMs: 250,
  crossFadeStartMs: 950,
} as const;
