import { useEffect, useRef, useState } from 'react';
import { AppText } from '../components/AppText';
import type { TypographyVariant } from '../tokens';
import { useReduceMotion } from './preference';
import { durations } from './tokens';

/** Ease-out cubic progress for t in [0, 1]. */
export function easeOutCubic(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return 1 - Math.pow(1 - clamped, 3);
}

type Props = {
  value: number;
  format?: (n: number) => string;
  variant?: TypographyVariant;
  accessibilityLabel?: string;
};

const defaultFormat = (n: number) => String(Math.round(n));

/** Counts from the previous value to `value` over 400 ms. Shows `value` at once under reduce motion. */
export function AnimatedNumber({ value, format = defaultFormat, variant = 'display', accessibilityLabel }: Props) {
  const reduce = useReduceMotion();
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    fromRef.current = value;
    if (reduce || from === value) {
      setShown(value);
      return;
    }
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const t = (Date.now() - start) / durations.slow;
      setShown(from + (value - from) * easeOutCubic(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduce]);

  return (
    <AppText variant={variant} accessibilityLabel={accessibilityLabel ?? format(value)}>
      {format(shown)}
    </AppText>
  );
}
