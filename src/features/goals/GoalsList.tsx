import { useRouter } from "expo-router";
import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type ViewProps,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useDb } from "../../db/DbProvider";
import { useLiveGoals } from "../../db/live";
import type { Goal } from "../../db/schema";
import {
  archiveGoal,
  duplicateGoal,
  pauseGoal,
  reorderGoals,
  resumeGoal,
} from "../../db/repositories";
import { strings } from "../../strings/en";
import {
  AppText,
  Button,
  Card,
  Chip,
  GoalIcon,
  Icon,
  IconButton,
} from "../../ui/components";
import { SlideUp, springs, useReduceMotion } from "../../ui/motion";
import { useTheme } from "../../ui/ThemeProvider";
import { staggerDelay } from "../../ui/motion/tokens";
import { minTapTarget, spacing } from "../../ui/tokens";
import { GroupsSection } from "../groups/GroupsSection";
import { haptic } from "../tracking/haptics";
import { useLogicalToday } from "../tracking/useLogicalToday";
import { GoalActionSheet, type GoalAction } from "./GoalActionSheet";
import { moveItem } from "./reorder";
import { templateKeys } from "./templates";

const s = strings.goals;
const ROW_HEIGHT = 72;
const ROW_GAP = spacing.sm;

type RowProps = {
  goal: Goal;
  index: number;
  onOpen: () => void;
  onMenu: () => void;
  onHistory: () => void;
  onDragStart: (index: number) => void;
  onDragEnd: (from: number, to: number) => void;
};

function GoalRow({
  goal,
  index,
  onOpen,
  onMenu,
  onHistory,
  onDragStart,
  onDragEnd,
}: RowProps) {
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  const y = useSharedValue(0);
  // Rows grow with the system font size; the drag step follows the measured height.
  const [rowHeight, setRowHeight] = useState(ROW_HEIGHT);
  const step = rowHeight + ROW_GAP;
  const lifted = useSharedValue(0);
  const paused = goal.pausedAt != null;

  const drag = Gesture.Pan()
    .activateAfterLongPress(250)
    .onStart(() => {
      lifted.value = 1;
      runOnJS(onDragStart)(index);
    })
    .onUpdate((e) => {
      y.value = e.translationY;
    })
    .onEnd((e) => {
      const to = index + Math.round(e.translationY / step);
      y.value = reduce ? 0 : withSpring(0, springs.snappy);
      lifted.value = 0;
      runOnJS(onDragEnd)(index, to);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { scale: 1 + lifted.value * 0.02 }],
  }));

  return (
    <Animated.View
      onLayout={(e) => setRowHeight(e.nativeEvent.layout.height)}
      style={[{ minHeight: ROW_HEIGHT, marginBottom: ROW_GAP }, animatedStyle]}
    >
      <Card style={styles.row}>
        <GestureDetector gesture={drag}>
          <View
            accessible
            accessibilityLabel={s.dragHandle(goal.name)}
            style={styles.handle}
          >
            <Icon
              name="reorder-two-outline"
              size={22}
              color={colors.textSecondary}
            />
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
                <Icon
                  name="pause-circle-outline"
                  size={16}
                  color={colors.textSecondary}
                />
                <AppText variant="caption" tone="secondary">
                  {s.paused}
                </AppText>
              </View>
            ) : null}
          </View>
        </OpenArea>
        <IconButton
          icon="calendar-outline"
          accessibilityLabel={s.historyFor(goal.name)}
          onPress={onHistory}
        />
        <IconButton
          icon="ellipsis-horizontal"
          accessibilityLabel={s.rowActions(goal.name)}
          onPress={onMenu}
        />
      </Card>
    </Animated.View>
  );
}

function OpenArea({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.open}
    >
      {children}
    </Pressable>
  );
}

const DragIndexContext = createContext<number | null>(null);

/** Stable cell renderer (a changing identity would remount rows mid-drag); lifts the dragged row's cell above its neighbours. */
function LiftedCell({ index, style, ...rest }: ViewProps & { index: number }) {
  const dragIndex = useContext(DragIndexContext);
  return (
    <View
      {...rest}
      style={[style, index === dragIndex ? styles.lifted : null]}
    />
  );
}

type GoalRowItem = { goal: Goal; index: number };

export function GoalsList() {
  const router = useRouter();
  const db = useDb();
  const { today } = useLogicalToday();
  const { data } = useLiveGoals();
  const [menuId, setMenuId] = useState<string | null>(null);

  const active = useMemo(
    () => data.filter((g) => g.archivedAt == null),
    [data],
  );
  const menuGoal = active.find((g) => g.id === menuId);
  const menuIndex = menuGoal ? active.indexOf(menuGoal) : -1;

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const items = useMemo<GoalRowItem[]>(
    () => active.map((goal, index) => ({ goal, index })),
    [active],
  );

  const reorder = (from: number, to: number) => {
    haptic("tap");
    void reorderGoals(
      db,
      moveItem(
        active.map((g) => g.id),
        from,
        to,
      ),
    );
  };

  const onDragEnd = (from: number, to: number) => {
    setDragIndex(null);
    if (to !== from) reorder(from, to);
  };

  const onAction = async (action: GoalAction) => {
    if (!menuGoal) return;
    const goal = menuGoal;
    setMenuId(null);
    switch (action) {
      case "edit":
        router.push(`/goal/${goal.id}`);
        break;
      case "duplicate":
        await duplicateGoal(db, goal.id, today);
        break;
      case "pauseToggle":
        await (goal.pausedAt
          ? resumeGoal(db, goal.id, today)
          : pauseGoal(db, goal.id, today));
        break;
      case "archive":
        await archiveGoal(db, goal.id);
        break;
      case "moveUp":
        reorder(menuIndex, menuIndex - 1);
        break;
      case "moveDown":
        reorder(menuIndex, menuIndex + 1);
        break;
    }
  };

  const header = (
    <View style={styles.root}>
      <GroupsSection />
      <View style={styles.header}>
        <AppText variant="display">{s.title}</AppText>
        <Button
          label={s.newGoal}
          icon="add"
          onPress={() => router.push("/goal/new")}
        />
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
                accessibilityLabel={strings.goalForm.useTemplate(
                  strings.goalForm.templateNames[key],
                )}
                onPress={() =>
                  router.push({
                    pathname: "/goal/new",
                    params: { template: key },
                  })
                }
              />
            ))}
          </View>
        </Card>
      ) : null}
    </View>
  );

  return (
    <DragIndexContext.Provider value={dragIndex}>
      <View style={styles.fill}>
        <FlatList
          data={items}
          keyExtractor={(item) => item.goal.id}
          ListHeaderComponent={header}
          ListHeaderComponentStyle={styles.listHeader}
          CellRendererComponent={LiftedCell}
          initialNumToRender={12}
          windowSize={7}
          removeClippedSubviews
          renderItem={({ item }) => (
            <SlideUp delay={staggerDelay(item.index)}>
              <GoalRow
                goal={item.goal}
                index={item.index}
                onOpen={() => router.push(`/goal/${item.goal.id}`)}
                onMenu={() => setMenuId(item.goal.id)}
                onHistory={() => router.push(`/goal/${item.goal.id}/history`)}
                onDragStart={setDragIndex}
                onDragEnd={onDragEnd}
              />
            </SlideUp>
          )}
        />
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
    </DragIndexContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  lifted: { zIndex: 10 },
  listHeader: { marginBottom: spacing.md },
  root: { gap: spacing.md },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: ROW_HEIGHT,
    paddingVertical: 0,
  },
  handle: {
    width: minTapTarget,
    height: minTapTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  open: {
    flex: 1,
    minHeight: minTapTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  text: { flex: 1, gap: 2 },
  badge: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
