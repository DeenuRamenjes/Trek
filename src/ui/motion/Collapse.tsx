import { ReactNode } from 'react';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useReduceMotion } from './preference';
import { durations } from './tokens';

type Props = { open: boolean; children: ReactNode };

/** Shows or hides its children; content fades and surrounding layout reflows. Instant under reduce motion. */
export function Collapse({ open, children }: Props) {
  const reduce = useReduceMotion();
  return (
    <Animated.View layout={reduce ? undefined : LinearTransition.duration(durations.base)}>
      {open ? (
        <Animated.View
          entering={reduce ? undefined : FadeIn.duration(durations.base)}
          exiting={reduce ? undefined : FadeOut.duration(durations.fast)}
        >
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
