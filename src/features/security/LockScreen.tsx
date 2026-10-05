import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { LOCK_FAILURES_BEFORE_PASSCODE } from '../../domain/appLock';
import { strings } from '../../strings/en';
import { AppText, Button } from '../../ui/components';
import { TrekMark } from '../../ui/components/TrekMark';
import { uiIcons } from '../../ui/icons';
import { Motion, SlideUp, durations, springs, useReduceMotion } from '../../ui/motion';
import { useTheme } from '../../ui/ThemeProvider';
import { spacing } from '../../ui/tokens';
import { haptic } from '../tracking/haptics';

type Props = {
  failures: number;
  /** Opens the system prompt; also called once when the screen appears. */
  onUnlock: () => void;
};

const SHAKE_PX = 12;

export function LockScreen({ failures, onUnlock }: Props) {
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  const x = useSharedValue(0);

  useEffect(() => {
    onUnlock();
    // Once on appear.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (failures === 0) return;
    haptic('warning');
    if (reduce) return;
    x.value = withSequence(withTiming(SHAKE_PX, { duration: durations.fast / 3 }), withSpring(0, springs.bouncy));
  }, [failures, reduce, x]);

  const shake = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const message =
    failures >= LOCK_FAILURES_BEFORE_PASSCODE ? strings.lock.usePasscode : failures > 0 ? strings.lock.failed : null;

  return (
    <Motion
      testID="lock-screen"
      style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: colors.background }]}
      from={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 'base', easing: 'exit' }}
    >
      <Animated.View style={[styles.center, shake]}>
        <Motion
          from={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', spring: 'bouncy' }}
        >
          <TrekMark size={96} color={colors.accent} />
        </Motion>
        <AppText variant="title" accessibilityRole="header">
          {strings.lock.title}
        </AppText>
        <AppText tone="secondary">{strings.lock.body}</AppText>
        <View style={styles.message} accessibilityLiveRegion="polite">
          {message ? <AppText tone="secondary">{message}</AppText> : null}
        </View>
        <SlideUp delay={150}>
          <Button label={strings.lock.unlock} icon={uiIcons.lock} accessibilityLabel={strings.lock.unlock} onPress={onUnlock} />
        </SlideUp>
      </Animated.View>
    </Motion>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  center: { alignItems: 'center', gap: spacing.md },
  message: { minHeight: 24 },
});
