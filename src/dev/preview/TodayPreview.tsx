import { Pressable, StyleSheet, View } from 'react-native';
import { strings } from '../../strings/en';
import { AppText, Banner, Card, GoalIcon, Icon, IconButton, Screen, StatusGlyph } from '../../ui/components';
import { uiIcons } from '../../ui/icons';
import { useTheme } from '../../ui/ThemeProvider';
import { minTapTarget, radii, spacing } from '../../ui/tokens';
import { PreviewGoal, previewToday } from '../mockData';

function DateStrip() {
  const { colors } = useTheme();
  return (
    <View style={styles.strip}>
      {previewToday.strip.map((d) => {
        const selected = d.key === previewToday.selectedKey;
        return (
          <Pressable
            key={d.key}
            accessibilityRole="button"
            accessibilityLabel={strings.today.selectDay(`${d.weekday} ${d.day}`)}
            accessibilityState={{ selected }}
            style={[styles.stripDay, selected && { backgroundColor: colors.accent }]}
          >
            <AppText variant="caption" tone={selected ? 'onAccent' : 'secondary'}>
              {d.weekday}
            </AppText>
            <AppText variant="headline" tone={selected ? 'onAccent' : 'primary'}>
              {String(d.day)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function GoalRow({ goal }: { goal: PreviewGoal }) {
  const { colors } = useTheme();
  const subtitle = goal.weekly ? strings.today.timesThisWeek(goal.weekly.done, goal.weekly.target) : goal.progressLabel;
  const primaryLabel = goal.kind === 'count' ? strings.today.increment(goal.name) : strings.today.markDone(goal.name);
  const primaryIcon = goal.kind === 'count' || goal.kind === 'duration' ? uiIcons.add : uiIcons.check;
  return (
    <Card>
      <View style={styles.row}>
        <GoalIcon icon={goal.icon} color={goal.color} />
        <View style={styles.rowText}>
          <AppText variant="headline">{goal.name}</AppText>
          <View style={styles.rowMeta}>
            <StatusGlyph status={goal.status} size={14} />
            <AppText variant="caption" tone="secondary">
              {`${strings.status[goal.status]}${subtitle ? ` · ${subtitle}` : ''}`}
            </AppText>
          </View>
        </View>
        {goal.status === 'done' ? (
          <StatusGlyph status="done" size={28} />
        ) : (
          <IconButton icon={primaryIcon} accessibilityLabel={primaryLabel} filled color={colors.accent} />
        )}
      </View>
      {goal.slots ? (
        <View style={styles.slots}>
          {goal.slots.map((slot) => (
            <Pressable
              key={slot.time}
              accessibilityRole="button"
              accessibilityLabel={strings.today.toggleSlot(goal.name, slot.time)}
              accessibilityState={{ checked: slot.done }}
              style={[styles.slot, { backgroundColor: slot.done ? colors.accentMuted : colors.surfaceMuted }]}
            >
              {slot.done ? <Icon name={uiIcons.check} size={14} color={colors.accent} /> : null}
              <AppText variant="label">{slot.time}</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

export function TodayPreview() {
  return (
    <Screen>
      <AppText variant="caption" tone="secondary">
        {previewToday.dateLabel}
      </AppText>
      <AppText variant="display">{strings.today.title}</AppText>
      <DateStrip />
      <Banner icon={uiIcons.vacation} message={strings.today.vacationBanner} actions={[{ label: strings.today.endVacation }]} />
      <Banner
        icon={uiIcons.backup}
        message={strings.today.backupBanner(previewToday.backupDays)}
        actions={[{ label: strings.today.backUpNow }, { label: strings.today.snoozeBackup }]}
      />
      <AppText variant="label" tone="secondary">
        {strings.today.pendingSection}
      </AppText>
      {previewToday.pending.map((goal) => (
        <GoalRow key={goal.id} goal={goal} />
      ))}
      <AppText variant="label" tone="secondary">
        {strings.today.doneSection}
      </AppText>
      {previewToday.done.map((goal) => (
        <GoalRow key={goal.id} goal={goal} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', justifyContent: 'space-between' },
  stripDay: {
    minWidth: minTapTarget,
    minHeight: 56,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, gap: spacing.xs },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  slots: { flexDirection: 'row', gap: spacing.sm },
  slot: {
    minHeight: minTapTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
