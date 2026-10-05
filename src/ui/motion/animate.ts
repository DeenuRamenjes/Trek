import { Easing, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { durations, easings, springs } from './tokens';

/** Values a motion primitive may animate: transform and opacity only. */
export type MotionValues = {
  opacity?: number;
  translateX?: number;
  translateY?: number;
  scale?: number;
};

export type MotionTransition = {
  type?: 'timing' | 'spring';
  duration?: keyof typeof durations;
  easing?: keyof typeof easings;
  spring?: keyof typeof springs;
  delay?: number;
};

export const IDENTITY: Required<MotionValues> = { opacity: 1, translateX: 0, translateY: 0, scale: 1 };

/** Fills unspecified keys with their resting value. */
export function resolveValues(values: MotionValues | undefined): Required<MotionValues> {
  return { ...IDENTITY, ...values };
}

/** Animates one number toward `to` using the transition's timing or spring preset. */
export function animateValue(to: number, transition: MotionTransition = {}): number {
  'worklet';
  const { type = 'timing', duration = 'base', easing = 'standard', spring = 'gentle', delay = 0 } = transition;
  const [x1, y1, x2, y2] = easings[easing];
  const animation =
    type === 'spring'
      ? withSpring(to, springs[spring])
      : withTiming(to, { duration: durations[duration], easing: Easing.bezier(x1, y1, x2, y2) });
  return delay > 0 ? withDelay(delay, animation) : animation;
}

/** Converts motion values into an animatable style object. */
export function toStyle(v: Required<MotionValues>) {
  'worklet';
  return {
    opacity: v.opacity,
    transform: [{ translateX: v.translateX }, { translateY: v.translateY }, { scale: v.scale }],
  };
}
