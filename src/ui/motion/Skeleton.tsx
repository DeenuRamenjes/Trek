import { useEffect } from 'react';
import { DimensionValue } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useTheme } from '../ThemeProvider';
import { radii } from '../tokens';
import { useReduceMotion } from './preference';
import { durations } from './tokens';

type Props = { width?: DimensionValue; height: number; radius?: number; testID?: string };

/** Placeholder block that pulses while content loads. Static under reduce motion. */
export function Skeleton({ width = '100%', height, radius = radii.md, testID }: Props) {
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = reduce ? 1 : withRepeat(withTiming(0.5, { duration: durations.slow * 2 }), -1, true);
  }, [reduce, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      testID={testID}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.surfaceMuted }, animatedStyle]}
    />
  );
}
