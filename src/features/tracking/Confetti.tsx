import { Canvas, Group, Path } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { runOnJS, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { Easing } from 'react-native-reanimated';
import { useReduceMotion } from '../../ui/motion';
import { useTheme } from '../../ui/ThemeProvider';

export const CONFETTI_MS = 900;
const PIECES = 18;
const PIECE_PATH = 'M0 0 H8 V4 H0 Z';

function Piece({ progress, index, cx, cy, color }: { progress: SharedValue<number>; index: number; cx: number; cy: number; color: string }) {
  const angle = (index / PIECES) * Math.PI * 2 + (index % 3) * 0.2;
  const dist = 90 + (index % 4) * 40;
  const transform = useDerivedValue(() => [
    { translateX: cx + Math.cos(angle) * dist * progress.value },
    { translateY: cy + Math.sin(angle) * dist * progress.value + 80 * progress.value * progress.value },
    { rotate: angle + progress.value * 6 },
  ]);
  const opacity = useDerivedValue(() => 1 - progress.value);
  return (
    <Group transform={transform} opacity={opacity}>
      <Path path={PIECE_PATH} color={color} />
    </Group>
  );
}

/** Skia burst, 900 ms, transform and opacity only. Renders nothing (and finishes at once) under reduce motion. */
export function Confetti({ onDone }: { onDone: () => void }) {
  const reduce = useReduceMotion();
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      onDone();
      return;
    }
    progress.value = withTiming(1, { duration: CONFETTI_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(onDone)();
    });
  }, [reduce, onDone, progress]);

  if (reduce) return null;
  const palette = [colors.accent, colors.status.done, colors.status.partial, colors.status.vacation];
  return (
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFill} accessible={false}>
      {Array.from({ length: PIECES }, (_, i) => (
        <Piece key={i} progress={progress} index={i} cx={width / 2} cy={height / 3} color={palette[i % palette.length]} />
      ))}
    </Canvas>
  );
}
