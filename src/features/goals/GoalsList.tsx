import { useRouter } from 'expo-router';
import { ReactNode, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useDb } from '../../db/DbProvider';
import { useLiveGoals } from '../../db/live';
import type { Goal } from '../../db/schema';
import { archiveGoal, duplicateGoal, pauseGoal, reorderGoals, resumeGoal } from '../../db/repositories';
import { strings } from '../../strings/en';
import { AppText, Button, Card, Chip, GoalIcon, Icon, IconButton } from '../../ui/components';
import { springs, Stagger, useReduceMotion } from '../../ui/motion';
import { useTheme } from '../../ui/ThemeProvider';
import { minTapTarget, spacing } from '../../ui/tokens';
import { GroupsSection } from '../groups/GroupsSection';
import { haptic } from '../tracking/haptics';
import { useLogicalToday } from '../tracking/useLogicalToday';
import { GoalActionSheet, type GoalAction } from './GoalActionSheet';
import { moveItem } from './reorder';
import { templateKeys } from './templates';

const s = strings.goals;
const ROW_HEIGHT = 72;
const ROW_GAP = spacing.sm;
const STEP = ROW_HEIGHT + ROW_GAP;

type RowProps = {
  goal: Goal;
  index: number;
  onOpen: () => void;
  onMenu: () => void;
  onHistory: () => void;
  onDragEnd: (from: number, to: number) => void;
};

function GoalRow({ goal, index, onOpen, onMenu, onHistory, onDragEnd }: RowProps) {
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  const y = useSharedValue(0);
  const lifted = useSharedValue(0);
  const paused = goal.pausedAt != null;

  const drag = Gesture.Pan()
    .activateAfterLongPress(250)
    .onStart(() => {
      lifted.value = 1;
    })
    .onUpdate((e) => {
      y.value = e.translationY;
    })
    .onEnd((e) => {
      const to = index + Math.round(e.translationY / STEP);
      y.value = reduce ? 0 : withSpring(0, springs.snappy);
      lifted.value = 0;
      if (to !== index) runOnJS(onDragEnd)(index, to);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { scale: 1 + lifted.value * 0.02 }],
    zIndex: lifted.value ? 10 : 0,
  }));

  return (
    <Animated.View style={[{ height: ROW_HEIGHT, marginBottom: ROW_GAP }, animatedStyle]}>
      <Card style={styles.row}>
        <GestureDetector gesture={drag}>
          <View accessible accessibilityLabel={s.dragHandle(goal.name)} style={styles.handle}>
            <Icon name="reorder-two-outline" size={22} color={colors.textSecondary} />
          </View>
        </GestureDetector>
        <OpenArea label={s.openGoal(goal.name)} onPress={onOpen}>
          <GoalIcon icon={goal.icon as never} color={goal.color} />
          <View style={styles.text}>
            <AppText variant="headline" numberOfLines={1}>
              {goal.name}
            </AppText>
            {paused ? (
              <View style={styles.badge}>
                <Icon name="pause-circle-outline" size={16} color={colors.textSecondary} />
                <AppText variant="caption" tone="secondary">
                  {s.paused}
                </AppText>
              </View>
            ) : null}
          </View>
        </OpenArea>
        <IconButton icon="calendar-outline" accessibilityLabel={s.historyFor(goal.name)} onPress={onHistory} />
        <IconButton icon="ellipsis-horizontal" accessibilityLabel={s.rowActions(goal.name)} onPress={onMenu} />
      </Card>
    </Animated.View>
  );
}

function OpenArea({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.open}>
      {children}
    </Pressable>
  );
}

export function GoalsList() {
  const router = useRouter();
  const db = useDb();
  const { today } = useLogicalToday();
  const { data } = useLiveGoals();
  const [menuId, setMenuId] = useState<string | null>(null);

  const active = useMemo(() => data.filter((g) => g.archivedAt == null), [data]);
  const menuGoal = active.find((g) => g.id === menuId);
  const menuIndex = menuGoal ? active.indexOf(menuGoal) : -1;

  const reorder = (from: number, to: number) => {
    haptic('tap');
    void reorderGoals(db, moveItem(active.map((g) => g.id), from, to));
  };

  const onAction = async (action: GoalAction) => {
    if (!menuGoal) return;
    const goal = menuGoal;
    setMenuId(null);
    switch (action) {
      case 'edit':
        router.push(`/goal/${goal.id}`);
        break;
      case 'duplicate':
        await duplicateGoal(db, goal.id, today);
        break;
      case 'pauseToggle':
        await (goal.pausedAt ? resumeGoal(db, goal.id, today) : pauseGoal(db, goal.id, today));
        break;
      case 'archive':
        await archiveGoal(db, goal.id);
        break;
      case 'moveUp':
        reorder(menuIndex, menuIndex - 1);
        break;
      case 'moveDown':
        reorder(menuIndex, menuIndex + 1);
        break;
    }
  };

  return (
    <View style={styles.root}>
      <GroupsSection />
      <View style={styles.header}>
        <AppText variant="display">{s.title}</AppText>
        <Button label={s.newGoal} icon="add" onPress={() => router.push('/goal/new')} />
      </View>
      {active.length === 0 ? (
        <Card>
          <AppText variant="headline">{s.emptyTitle}</AppText>
          <AppText tone="secondary">{s.emptyBody}</AppText>
          <View style={styles.chips}>
            {templateKeys.map((key) => (
              <Chip
                key={key}
                label={strings.goalForm.templateNames[key]}
                accessibilityLabel={strings.goalForm.useTemplate(strings.goalForm.templateNames[key])}
                onPress={() => router.push({ pathname: '/goal/new', params: { template: key } })}
              />
            ))}
          </View>
        </Card>
      ) : (
        <Stagger>
          {active.map((goal, index) => (
            <GoalRow
              key={goal.id}
              goal={goal}
              index={index}
              onOpen={() => router.push(`/goal/${goal.id}`)}
              onMenu={() => setMenuId(goal.id)}
              onHistory={() => router.push(`/goal/${goal.id}/history`)}
              onDragEnd={reorder}
            />
          ))}
        </Stagger>
      )}
      {menuGoal ? (
        <GoalActionSheet
          name={menuGoal.name}
          paused={menuGoal.pausedAt != null}
          canMoveUp={menuIndex > 0}
          canMoveDown={menuIndex < active.length - 1}
          onAction={onAction}
          onClose={() => setMenuId(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', height: ROW_HEIGHT, paddingVertical: 0 },
  handle: { width: minTapTarget, height: minTapTarget, alignItems: 'center', justifyContent: 'center' },
  open: { flex: 1, minHeight: minTapTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1, gap: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
