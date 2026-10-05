import { ReactNode, useEffect } from 'react';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { animateValue, MotionTransition, MotionValues, resolveValues, toStyle } from './animate';
import { useReduceMotion } from './preference';

export type MotionProps = Omit<ViewProps, 'style'> & {
  /** Values on mount; the view animates from these to `animate`. */
  from?: MotionValues;
  /** Target values; changing them animates to the new values. */
  animate?: MotionValues;
  /** Values the view animates to when it unmounts. */
  exit?: MotionValues;
  transition?: MotionTransition;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/**
 * Framer Motion-style view on Reanimated 4 (CLAUDE.md §1). Animates only transform and opacity.
 * With reduce motion on, every value jumps straight to its target and no exit animation runs.
 */
export function Motion({ from, animate, exit, transition, style, children, ...rest }: MotionProps) {
  const reduce = useReduceMotion();
  const target = resolveValues(animate);
  const current = useSharedValue(reduce ? target : resolveValues(from ?? animate));
  const key = `${target.opacity}|${target.translateX}|${target.translateY}|${target.scale}`;

  useEffect(() => {
    current.value = target;
    // `key` captures every field of `target`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, current]);

  const animatedStyle = useAnimatedStyle(() => {
    const v = current.value;
    if (reduce) return toStyle(v);
    return toStyle({
      opacity: animateValue(v.opacity, transition),
      translateX: animateValue(v.translateX, transition),
      translateY: animateValue(v.translateY, transition),
      scale: animateValue(v.scale, transition),
    });
  });

  const exiting =
    !reduce && exit
      ? () => {
          'worklet';
          const start = target;
          const end = resolveValues(exit);
          return {
            initialValues: toStyle(start),
            animations: toStyle({
              opacity: animateValue(end.opacity, { ...transition, delay: 0 }),
              translateX: animateValue(end.translateX, { ...transition, delay: 0 }),
              translateY: animateValue(end.translateY, { ...transition, delay: 0 }),
              scale: animateValue(end.scale, { ...transition, delay: 0 }),
            }),
          };
        }
      : undefined;

  return (
    <Animated.View {...rest} exiting={exiting} style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
