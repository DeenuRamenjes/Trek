import { Motion, MotionProps } from './Motion';

type PresetProps = Omit<MotionProps, 'from' | 'animate' | 'exit' | 'transition'> & { delay?: number };

/** Fades in on mount and out on unmount. */
export function FadeIn({ delay = 0, ...rest }: PresetProps) {
  return (
    <Motion
      {...rest}
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 'base', easing: 'enter', delay }}
    />
  );
}

/** Fades in while rising 12 pt; fades out on unmount. */
export function SlideUp({ delay = 0, ...rest }: PresetProps) {
  return (
    <Motion
      {...rest}
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      exit={{ opacity: 0, translateY: 12 }}
      transition={{ duration: 'base', easing: 'enter', delay }}
    />
  );
}

/** Fades in while scaling from 0.92 with the snappy spring. */
export function ScaleIn({ delay = 0, ...rest }: PresetProps) {
  return (
    <Motion
      {...rest}
      from={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ type: 'spring', spring: 'snappy', delay }}
    />
  );
}
