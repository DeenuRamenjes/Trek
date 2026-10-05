import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { strings } from '../../strings/en';
import { AppText } from '../components/AppText';
import { TrekMark } from '../components/TrekMark';
import { Motion } from '../motion/Motion';
import { useReduceMotion } from '../motion/preference';
import { easings, splashTiming, springs } from '../motion/tokens';
import { useTheme } from '../ThemeProvider';
import { spacing } from '../tokens';

export const SPLASH_MARK_SIZE = 112;

type Props = { onFinish: () => void };

/**
 * Animated splash shown once the native splash hides: the mark draws and settles, the wordmark rises,
 * then the overlay cross-fades into the screen underneath. Total 1.2 s; never mounts under reduce motion.
 */
export function AnimatedSplash({ onFinish }: Props) {
  const reduce = useReduceMotion();
  const { colors } = useTheme();
  const draw = useSharedValue(0);
  const markScale = useSharedValue(0.92);
  const overlayOpacity = useSharedValue(1);

  useEffect(() => {
    if (reduce) {
      onFinish();
      return;
    }
    const [x1, y1, x2, y2] = easings.enter;
    draw.value = withTiming(1, { duration: splashTiming.markDrawMs, easing: Easing.bezier(x1, y1, x2, y2) });
    markScale.value = withSpring(1, springs.snappy);
    overlayOpacity.value = withDelay(
      splashTiming.crossFadeStartMs,
      withTiming(0, { duration: splashTiming.crossFadeMs }),
    );
    const timer = setTimeout(onFinish, splashTiming.totalMs);
    return () => clearTimeout(timer);
    // Runs once: the splash plays a single time per launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: markScale.value }] }));

  if (reduce) return null;
  return (
    <Animated.View
      testID="animated-splash"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.overlay, { backgroundColor: colors.background }, overlayStyle]}
    >
      <Animated.View style={markStyle}>
        <TrekMark size={SPLASH_MARK_SIZE} color={colors.accent} progress={draw} />
      </Animated.View>
      <Motion
        from={{ opacity: 0, translateY: 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ duration: 'base', easing: 'enter', delay: splashTiming.wordmarkDelayMs }}
      >
        <AppText variant="display">{strings.appName}</AppText>
      </Motion>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
});
