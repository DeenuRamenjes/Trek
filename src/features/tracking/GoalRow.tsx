import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, LinearTransition, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { strings } from '../../strings/en';
import { AppText, Card, GoalIcon, Icon, StatusGlyph } from '../../ui/components';
import { uiIcons } from '../../ui/icons';
import { AnimatedCheck, durations, springs, useReduceMotion } from '../../ui/motion';
import { useTheme } from '../../ui/ThemeProvider';
import { minTapTarget, radii, spacing, type StatusKey } from '../../ui/tokens';
import { DURATION_STEP } from './useCheckOff';
import { SlotChips } from './SlotChips';
import type { TodayRow, TodaySlot } from './todayModel';

const t = strings.today;
const SWIPE = 96;

type Props = {
  row: TodayRow;
  onPrimary: () => void;
  onDone: () => void;
  onSkip: () => void;
  onLog: () => void;
  onSlot: (slot: TodaySlot) => void;
};

/** Always mounted so the stroke draws (250 ms) when the row turns done and keeps its place in the list. */
function FinishedCheck({ checked, color }: { checked: boolean; color: string }) {
  return (
    <View style={styles.check} pointerEvents="none">
      <AnimatedCheck checked={checked} color={color} size={28} />
    </View>
  );
}

function progressDetail(row: TodayRow): string {
  const p = row.progressText;
  if (row.weekProgress) return t.timesThisWeek(row.weekProgress.done, row.weekProgress.target);
  if (p.key === 'slots') return t.progressSlots(p.params.done, p.params.total);
  if (p.key === 'amount') return t.progressAmount(p.params.value, p.params.target, p.params.unit);
  return '';
}

export function GoalRow({ row, onPrimary, onDone, onSkip, onLog, onSlot }: Props) {
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  const x = useSharedValue(0);
  const finished = row.status === 'done' || row.status === 'skipped';
  const detail = progressDetail(row);
  const statusKey: StatusKey = row.status === 'not-due' ? 'notDue' : row.status;
  const statusText = strings.status[statusKey];

  const swipe = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      x.value = e.translationX;
    })
    .onEnd((e) => {
      if (e.translationX > SWIPE) runOnJS(onDone)();
      else if (e.translationX < -SWIPE) runOnJS(onSkip)();
      x.value = reduce ? 0 : withSpring(0, springs.snappy);
    });
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const primary =
    finished
      ? { icon: null, label: t.markNotDone(row.name) }
      : row.trackingType === 'count'
        ? { icon: uiIcons.add, label: t.increment(row.name) }
        : row.trackingType === 'duration'
          ? { icon: uiIcons.add, label: t.addMinutes(row.name, DURATION_STEP) }
          : row.trackingType === 'value'
            ? { icon: 'create-outline' as const, label: t.enterValue(row.name) }
            : { icon: uiIcons.check, label: t.markDone(row.name) };

  return (
    <Animated.View
      layout={reduce ? undefined : LinearTransition.duration(durations.base)}
      entering={reduce ? undefined : FadeIn.duration(durations.base)}
      exiting={reduce ? undefined : FadeOut.duration(durations.fast)}
    >
      <GestureDetector gesture={swipe}>
        <Animated.View style={[{ opacity: finished ? 0.6 : 1 }, slide]}>
          <Card>
            <View style={styles.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.rowLabel(row.name, statusText, detail)}
                accessibilityActions={[
                  { name: 'done', label: t.actionDone },
                  { name: 'skip', label: t.actionSkip },
                  { name: 'log', label: t.actionLog },
                ]}
                onAccessibilityAction={(e) => {
                  const n = e.nativeEvent.actionName;
                  if (n === 'done') onDone();
                  else if (n === 'skip') onSkip();
                  else if (n === 'log') onLog();
                }}
                onPress={onPrimary}
                onLongPress={onLog}
                style={styles.main}
              >
                <GoalIcon icon={row.icon as never} color={row.color} />
                <View style={styles.text}>
                  <AppText variant="headline" numberOfLines={1}>
                    {row.name}
                  </AppText>
                  <View style={styles.meta}>
                    <StatusGlyph status={statusKey} size={14} />
                    <AppText variant="caption" tone="secondary">
                      {detail ? `${statusText} · ${detail}` : statusText}
                    </AppText>
                  </View>
                </View>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={primary.label} onPress={onPrimary} style={[styles.primary, { backgroundColor: finished ? 'transparent' : colors.surfaceMuted }]}>
                {!finished && primary.icon ? <Icon name={primary.icon} size={22} color={colors.accent} /> : null}
                {row.status === 'skipped' ? <StatusGlyph status="skipped" size={24} /> : <FinishedCheck checked={row.status === 'done'} color={colors.status.done} />}
              </Pressable>
            </View>
            {row.slots.length > 0 ? <SlotChips goalName={row.name} slots={row.slots} onToggle={onSlot} /> : null}
          </Card>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  main: { flex: 1, minHeight: minTapTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1, gap: spacing.xs },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  check: { position: 'absolute' },
  primary: { width: minTapTarget, height: minTapTarget, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
});
