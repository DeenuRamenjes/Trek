import { Canvas, Path } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';

/** The Trek trail mark: a path climbing to a peak, in a 100-unit box. Also used for the app icon. */
export const TREK_MARK_PATH = 'M18 78 L40 52 L52 62 L82 22';

type Props = {
  size: number;
  color: string;
  /** Stroke draw progress, 0 to 1. Omit for a fully drawn mark. */
  progress?: SharedValue<number>;
  testID?: string;
};

/** Decorative brand mark drawn with Skia. */
export function TrekMark({ size, color, progress, testID }: Props) {
  return (
    <Canvas testID={testID} style={{ width: size, height: size }} accessible={false}>
      <Path
        path={TREK_MARK_PATH}
        transform={[{ scale: size / 100 }]}
        style="stroke"
        strokeWidth={9}
        strokeCap="round"
        strokeJoin="round"
        color={color}
        start={0}
        end={progress ?? 1}
      />
    </Canvas>
  );
}
