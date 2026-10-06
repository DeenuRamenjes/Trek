import { ReactNode, useEffect, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { durations, useReduceMotion } from '../../../ui/motion';

type Props = {
  /** bottom: bars grow up from the baseline; left: bars grow right from the start. */
  axis: 'y' | 'x';
  /** Replays the animation when this value changes. */
  version: string;
  children: ReactNode;
};

/** Reveals a chart by scaling it from its baseline (transform only). Instant under reduce motion. */
export function GrowIn({ axis, version, children }: Props) {
  const reduce = useReduceMotion();
  const [size, setSize] = useState(0);
  const progress = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration: durations.slow, easing: Easing.bezier(0, 0, 0, 1) });
  }, [version, reduce, progress]);

  const style = useAnimatedStyle(() => {
    const s = Math.max(progress.value, 0.001);
    // Scaling is about the center, so shift by half the lost size to keep the baseline fixed.
    return axis === 'y'
      ? { transform: [{ translateY: (size / 2) * (1 - s) }, { scaleY: s }] }
      : { transform: [{ translateX: -(size / 2) * (1 - s) }, { scaleX: s }] };
  });

  const onLayout = (e: LayoutChangeEvent) => setSize(axis === 'y' ? e.nativeEvent.layout.height : e.nativeEvent.layout.width);

  return (
    <Animated.View onLayout={onLayout} style={[{ flex: 1 }, style]}>
      {children}
    </Animated.View>
  );
}
