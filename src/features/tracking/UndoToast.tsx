import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { strings } from '../../strings/en';
import { AppText, Button } from '../../ui/components';
import { durations, useReduceMotion } from '../../ui/motion';
import { useTheme } from '../../ui/ThemeProvider';
import { radii, spacing } from '../../ui/tokens';

export const UNDO_TOAST_MS = 4000;

type Props = { toastKey: number; message: string; onUndo: () => void; onDismiss: () => void };

/** Bottom toast with an Undo action; dismisses itself after 4 s. */
export function UndoToast({ toastKey, message, onUndo, onDismiss }: Props) {
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  useEffect(() => {
    const t = setTimeout(onDismiss, UNDO_TOAST_MS);
    return () => clearTimeout(t);
  }, [toastKey, onDismiss]);
  return (
    <Animated.View
      key={toastKey}
      pointerEvents="box-none"
      entering={reduce ? undefined : FadeIn.duration(durations.base)}
      exiting={reduce ? undefined : FadeOut.duration(durations.fast)}
      style={styles.wrap}
    >
      <View accessibilityLiveRegion="polite" style={[styles.toast, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <AppText style={styles.message}>
          {message}
        </AppText>
        <Button label={strings.today.undo} variant="plain" onPress={onUndo} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md },
  toast: { flexDirection: 'row', alignItems: 'center', borderRadius: radii.lg, borderWidth: 1, paddingLeft: spacing.md, paddingRight: spacing.sm },
  message: { flex: 1 },
});
