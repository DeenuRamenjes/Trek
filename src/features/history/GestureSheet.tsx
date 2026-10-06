import { ReactNode, useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { strings } from '../../strings/en';
import { AppText } from '../../ui/components';
import { durations, springs, useReduceMotion } from '../../ui/motion';
import { useTheme } from '../../ui/ThemeProvider';
import { minTapTarget, radii, spacing } from '../../ui/tokens';

/** Distance the sheet travels off screen; larger than any sheet this app shows. */
export const SHEET_OFFSCREEN = 900;
export const DISMISS_DISTANCE = 120;
export const DISMISS_VELOCITY = 800;

type Props = { title: string; onClose: () => void; children: ReactNode };

/**
 * Bottom sheet with a drag handle. Slides up on mount; drag down past a threshold (or flick) to dismiss.
 * Under reduce motion it appears and disappears instantly and still dismisses with the drag.
 */
export function GestureSheet({ title, onClose, children }: Props) {
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  const y = useSharedValue(reduce ? 0 : SHEET_OFFSCREEN);

  useEffect(() => {
    if (!reduce) y.value = withSpring(0, springs.snappy);
    else y.value = 0;
  }, [reduce, y]);

  const dismiss = () => {
    if (reduce) {
      onClose();
      return;
    }
    y.value = withTiming(SHEET_OFFSCREEN, { duration: durations.base }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  };

  const drag = Gesture.Pan()
    .onUpdate((e) => {
      y.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        if (reduce) {
          runOnJS(onClose)();
          return;
        }
        y.value = withTiming(SHEET_OFFSCREEN, { duration: durations.base }, (finished) => {
          if (finished) runOnJS(onClose)();
        });
        return;
      }
      y.value = reduce ? 0 : withSpring(0, springs.snappy);
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Modal transparent visible animationType="none" onRequestClose={dismiss}>
      <GestureHandlerRootView style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={strings.today.closeSheet}
          style={[styles.scrim, { backgroundColor: colors.overlay }]}
          onPress={dismiss}
        />
        <Animated.View testID="gesture-sheet" style={[styles.sheet, { backgroundColor: colors.surface }, sheetStyle]}>
          <GestureDetector gesture={drag}>
            <View testID="gesture-sheet-handle" style={styles.handleArea}>
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
              <AppText variant="headline">{title}</AppText>
            </View>
          </GestureDetector>
          {children}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrim: StyleSheet.absoluteFill,
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '90%',
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  handleArea: { minHeight: minTapTarget, gap: spacing.sm, alignItems: 'stretch', justifyContent: 'center' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: radii.pill },
});
