import { Canvas, Path } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { useReduceMotion } from './preference';
import { durations } from './tokens';

/** Checkmark in a 24-unit box. */
const CHECK_PATH = 'M5 12.5 L10 17.5 L19 7';

type Props = { checked: boolean; color: string; size?: number; testID?: string };

/** Draws a checkmark stroke when `checked` turns true (250 ms). Decorative: the parent control carries the label. */
export function AnimatedCheck({ checked, color, size = 24, testID }: Props) {
  const reduce = useReduceMotion();
  const progress = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    progress.value = reduce || !checked ? (checked ? 1 : 0) : withTiming(1, { duration: durations.base });
  }, [checked, reduce, progress]);

  return (
    <Canvas testID={testID} style={{ width: size, height: size }} accessible={false}>
      <Path
        path={CHECK_PATH}
        transform={[{ scale: size / 24 }]}
        style="stroke"
        strokeWidth={2.5}
        strokeCap="round"
        strokeJoin="round"
        color={color}
        start={0}
        end={progress}
      />
    </Canvas>
  );
}
