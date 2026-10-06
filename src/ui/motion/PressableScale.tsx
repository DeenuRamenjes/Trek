import { ReactNode } from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useReduceMotion } from './preference';
import { springs } from './tokens';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

const PRESSED_SCALE = 0.97;

/** A button that shrinks slightly while pressed (snappy spring). Static under reduce motion. */
export function PressableScale({ style, children, onPressIn, onPressOut, ...rest }: Props) {
  const reduce = useReduceMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
      onPressIn={(e) => {
        if (!reduce) scale.value = withSpring(PRESSED_SCALE, springs.snappy);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = reduce ? 1 : withSpring(1, springs.snappy);
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
