import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { onDbChanged } from '../../db/changes';
import { useDb } from '../../db/DbProvider';
import { useLiveLogs } from '../../db/live';
import { deleteLogTx, upsertLogTx } from '../../db/repositories';
import { withTransaction } from '../../db/transaction';
import { parseDate } from '../../domain/dates';
import { slotsForDate } from '../../domain/dayStatus';
import type { GoalContext } from '../../domain/types';
import { strings } from '../../strings/en';
import { AppText, Card, GoalIcon, IconButton, Screen, StatusGlyph, statusLabel } from '../../ui/components';
import { uiIcons } from '../../ui/icons';
import { durations, springs, useReduceMotion } from '../../ui/motion';
import type { StatusKey } from '../../ui/tokens';
import { spacing } from '../../ui/tokens';
import { loadGoalContexts } from '../goals/goalContexts';
import { useSettings } from '../settings/settingsStore';
import { haptic } from '../tracking/haptics';
import { useLogicalToday } from '../tracking/useLogicalToday';
import { initialEditState, planDayEdit, type EditState } from './dayEdit';
import { DayEditorSheet } from './DayEditorSheet';
import { MonthGrid } from './MonthGrid';
import { buildMonthModel, shiftMonth } from './monthModel';

const h = strings.history;
const COMMIT_FRACTION = 0.25;
const FLICK_VELOCITY = 800;
const LEGEND: StatusKey[] = ['done', 'partial', 'skipped', 'vacation', 'missed', 'pending'];

export function HistoryScreen({ goalId }: { goalId: string }) {
  const router = useRouter();
  const db = useDb();
  const reduce = useReduceMotion();
  const { today } = useLogicalToday();
  const dayEndsAt = useSettings((s) => s.settings.dayEndsAt);
  const weekStart = useSettings((s) => s.settings.weekStart);
  const [ctx, setCtx] = useState<GoalContext | null | undefined>(undefined);
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [editing, setEditing] = useState<string | null>(null);
  const { data: allLogs } = useLiveLogs();
  const logs = useMemo(() => allLogs.filter((l) => l.goalId === goalId), [allLogs, goalId]);

  useEffect(() => {
    let alive = true;
    const run = () =>
      void loadGoalContexts(db, { includeArchived: true, dayEndsAt })
        .then((list) => alive && setCtx(list.find((c) => c.goal.id === goalId) ?? null))
        .catch(() => undefined);
    run();
    const off = onDbChanged(run);
    return () => {
      alive = false;
      off();
    };
  }, [db, dayEndsAt, goalId]);

  const model = useMemo(() => (ctx ? buildMonthModel(ctx, logs, month, today, weekStart) : null), [ctx, logs, month, today, weekStart]);

  const width = useSharedValue(0);
  const x = useSharedValue(0);
  const go = useCallback((dir: 1 | -1) => setMonth((m) => shiftMonth(m, dir)), []);

  const pan = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .failOffsetY([-16, 16])
    .onUpdate((e) => {
      x.value = e.translationX;
    })
    .onEnd((e) => {
      const w = width.value || 1;
      const commit = Math.abs(e.translationX) > w * COMMIT_FRACTION || Math.abs(e.velocityX) > FLICK_VELOCITY;
      if (!commit) {
        x.value = reduce ? 0 : withSpring(0, springs.snappy);
        return;
      }
      // Swipe left shows the next month.
      const dir: 1 | -1 = e.translationX < 0 ? 1 : -1;
      if (reduce) {
        x.value = 0;
        runOnJS(go)(dir);
        return;
      }
      x.value = withTiming(-dir * w, { duration: durations.fast }, (finished) => {
        if (!finished) return;
        runOnJS(go)(dir);
        x.value = dir * w;
        x.value = withSpring(0, springs.snappy);
      });
    });

  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  if (ctx === undefined) return <Screen>{null}</Screen>;
  if (ctx === null || !model) {
    return (
      <Screen>
        <IconButton icon={uiIcons.back} accessibilityLabel={h.back} onPress={() => router.back()} />
        <AppText>{h.notFound}</AppText>
      </Screen>
    );
  }

  const { goal } = ctx;
  const unitLabel = (n: number) => (model.header.streakUnit === 'weeks' ? h.streakWeeks(n) : h.streakDays(n));
  const editingSlots = editing ? slotsForDate(ctx, editing) : [];
  const editingLogs = editing ? logs.filter((l) => l.date === editing) : [];

  const save = async (state: EditState) => {
    if (!editing) return;
    const ops = planDayEdit(goal, editingSlots, editingLogs, state);
    await withTransaction(db, async (tx) => {
      for (const op of ops) {
        if (op.kind === 'delete') await deleteLogTx(tx, op.id);
        else await upsertLogTx(tx, { goalId, date: editing, slotId: op.slotId, value: op.value, status: op.status, note: op.note });
      }
    });
    haptic('tap');
    setEditing(null);
  };
  const clear = async () => {
    await withTransaction(db, async (tx) => {
      for (const l of editingLogs) await deleteLogTx(tx, l.id);
    });
    haptic('tap');
    setEditing(null);
  };
  const open = (date: string) => date <= today && setEditing(date);

  return (
    <Screen>
      <View style={styles.titleRow}>
        <IconButton icon={uiIcons.back} accessibilityLabel={h.back} onPress={() => router.back()} />
        <GoalIcon icon={goal.icon as never} color={goal.color} />
        <AppText variant="title" accessibilityRole="header" numberOfLines={1} style={styles.flex}>
          {h.screenTitle(goal.name)}
        </AppText>
      </View>
      <View style={styles.stats}>
        <Card style={styles.flex}>
          <AppText variant="title">{unitLabel(model.header.currentStreak)}</AppText>
          <AppText variant="caption" tone="secondary">
            {h.currentStreak}
          </AppText>
        </Card>
        <Card style={styles.flex}>
          <AppText variant="title">{unitLabel(model.header.bestStreak)}</AppText>
          <AppText variant="caption" tone="secondary">
            {h.bestStreak}
          </AppText>
        </Card>
        <Card style={styles.flex}>
          <AppText variant="title">{model.header.monthPercent === null ? h.percentNone : `${Math.round(model.header.monthPercent)}%`}</AppText>
          <AppText variant="caption" tone="secondary">
            {h.monthCompletion}
          </AppText>
        </Card>
      </View>
      <View style={styles.monthNav}>
        <IconButton icon={uiIcons.back} accessibilityLabel={h.previousMonth} onPress={() => go(-1)} />
        <AppText variant="headline" accessibilityRole="header">
          {format(parseDate(`${month}-01`), 'MMMM yyyy')}
        </AppText>
        <IconButton icon={uiIcons.forward} accessibilityLabel={h.nextMonth} onPress={() => go(1)} />
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View style={slide} onLayout={(e) => (width.value = e.nativeEvent.layout.width)}>
          <MonthGrid model={model} weekStart={weekStart} onSelectDay={open} />
        </Animated.View>
      </GestureDetector>
      <Card muted>
        <AppText variant="label" tone="secondary">
          {h.legend}
        </AppText>
        <View style={styles.legend}>
          {LEGEND.map((s) => (
            <View key={s} style={styles.legendItem}>
              <StatusGlyph status={s} size={14} />
              <AppText variant="caption">{statusLabel(s)}</AppText>
            </View>
          ))}
        </View>
      </Card>
      {editing ? (
        <DayEditorSheet
          key={editing}
          goal={goal}
          date={editing}
          slots={editingSlots}
          initial={initialEditState(goal, editingSlots, editingLogs)}
          onSave={(s) => void save(s)}
          onClear={() => void clear()}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stats: { flexDirection: 'row', gap: spacing.sm },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
