import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { onDbChanged } from '../../db/changes';
import { useDb } from '../../db/DbProvider';
import { useLiveGoals, useLiveGroups } from '../../db/live';
import { listGroupGoals, reorderGroups } from '../../db/repositories';
import type { Group } from '../../db/schema';
import { strings } from '../../strings/en';
import { AppText, Button, Card, GoalIcon, Icon, IconButton } from '../../ui/components';
import { springs, Stagger, useReduceMotion } from '../../ui/motion';
import { useTheme } from '../../ui/ThemeProvider';
import { minTapTarget, spacing } from '../../ui/tokens';
import { moveItem } from '../goals/reorder';
import { haptic } from '../tracking/haptics';

const s = strings.groups;
const ROW_HEIGHT = 72;
const ROW_GAP = spacing.sm;

type RowProps = {
  group: Group;
  index: number;
  count: number;
  isLast: boolean;
  onOpen: () => void;
  onMove: (from: number, to: number) => void;
};

function GroupRow({ group, index, count, isLast, onOpen, onMove }: RowProps) {
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  const y = useSharedValue(0);
  // Rows grow with the system font size; the drag step follows the measured height.
  const [rowHeight, setRowHeight] = useState(ROW_HEIGHT);
  const step = rowHeight + ROW_GAP;
  const lifted = useSharedValue(0);

  const drag = Gesture.Pan()
    .activateAfterLongPress(250)
    .onStart(() => {
      lifted.value = 1;
    })
    .onUpdate((e) => {
      y.value = e.translationY;
    })
    .onEnd((e) => {
      const to = index + Math.round(e.translationY / step);
      y.value = reduce ? 0 : withSpring(0, springs.snappy);
      lifted.value = 0;
      if (to !== index) runOnJS(onMove)(index, to);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { scale: 1 + lifted.value * 0.02 }],
    zIndex: lifted.value ? 10 : 0,
  }));

  return (
    <Animated.View onLayout={(e) => setRowHeight(e.nativeEvent.layout.height)}
      style={[{ minHeight: ROW_HEIGHT, marginBottom: ROW_GAP }, animatedStyle]}>
      <Card style={styles.row}>
        <GestureDetector gesture={drag}>
          <View accessible accessibilityLabel={s.dragHandle(group.name)} style={styles.handle}>
            <Icon name="reorder-two-outline" size={22} color={colors.textSecondary} />
          </View>
        </GestureDetector>
        <Pressable accessibilityRole="button" accessibilityLabel={s.openGroup(group.name)} onPress={onOpen} style={styles.open}>
          <GoalIcon icon={group.icon as never} color={group.color} />
          <View style={styles.text}>
            <AppText variant="headline" numberOfLines={1}>
              {group.name}
            </AppText>
            <AppText variant="caption" tone="secondary">
              {s.goalCount(count)}
            </AppText>
          </View>
        </Pressable>
        <IconButton icon="chevron-up" accessibilityLabel={s.moveUp(group.name)} disabled={index === 0} onPress={() => onMove(index, index - 1)} />
        <IconButton icon="chevron-down" accessibilityLabel={s.moveDown(group.name)} disabled={isLast} onPress={() => onMove(index, index + 1)} />
      </Card>
    </Animated.View>
  );
}

export function GroupsSection() {
  const router = useRouter();
  const db = useDb();
  const { data: groups } = useLiveGroups();
  const { data: goals } = useLiveGoals();
  const [links, setLinks] = useState<{ groupId: string; goalId: string }[]>([]);

  useEffect(() => {
    let alive = true;
    const run = () => void listGroupGoals(db).then((l) => alive && setLinks(l));
    run();
    const off = onDbChanged(run);
    return () => {
      alive = false;
      off();
    };
  }, [db]);

  const counts = useMemo(() => {
    const activeIds = new Set(goals.filter((g) => g.archivedAt == null).map((g) => g.id));
    const m = new Map<string, number>();
    for (const l of links) if (activeIds.has(l.goalId)) m.set(l.groupId, (m.get(l.groupId) ?? 0) + 1);
    return m;
  }, [links, goals]);

  const move = (from: number, to: number) => {
    haptic('tap');
    void reorderGroups(db, moveItem(groups.map((g) => g.id), from, to));
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <AppText variant="headline" accessibilityRole="header">
          {s.title}
        </AppText>
        <Button label={s.newGroup} icon="add" variant="secondary" onPress={() => router.push('/group/new')} />
      </View>
      {groups.length === 0 ? (
        <Card>
          <AppText variant="headline">{s.emptyTitle}</AppText>
          <AppText tone="secondary">{s.emptyBody}</AppText>
        </Card>
      ) : (
        <Stagger>
          {groups.map((group, index) => (
            <GroupRow
              key={group.id}
              group={group}
              index={index}
              count={counts.get(group.id) ?? 0}
              isLast={index === groups.length - 1}
              onOpen={() => router.push(`/group/${group.id}`)}
              onMove={move}
            />
          ))}
        </Stagger>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: ROW_HEIGHT, paddingVertical: 0 },
  handle: { width: minTapTarget, height: minTapTarget, alignItems: 'center', justifyContent: 'center' },
  open: { flex: 1, minHeight: minTapTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1, gap: 2 },
});
