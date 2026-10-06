import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { strings } from '../../strings/en';
import { AppText, Button, Card, IconButton, Screen, StatusGlyph, statusLabel } from '../../ui/components';
import { uiIcons } from '../../ui/icons';
import { useTheme } from '../../ui/ThemeProvider';
import { minTapTarget, radii, spacing, StatusKey, typography } from '../../ui/tokens';
import { PreviewHistoryDay, previewHistory } from '../mockData';

const LEGEND: StatusKey[] = ['done', 'partial', 'skipped', 'vacation', 'missed', 'pending'];

function DayCell({ day }: { day: PreviewHistoryDay }) {
  const { colors } = useTheme();
  const label = strings.history.dayLabel(`${previewHistory.monthLabel} ${day.day}`, statusLabel(day.status));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: day.status === 'notDue' }}
      style={[styles.cell, { backgroundColor: day.status === 'notDue' ? 'transparent' : colors.surface }]}
    >
      <AppText variant="caption" tone={day.status === 'notDue' ? 'secondary' : 'primary'}>
        {String(day.day)}
      </AppText>
      <StatusGlyph status={day.status} size={16} />
      {day.value ? (
        <AppText variant="caption" tone="secondary">
          {day.value}
        </AppText>
      ) : null}
    </Pressable>
  );
}

export function HistoryPreview() {
  const { colors } = useTheme();
  const h = strings.history;
  const cells: (PreviewHistoryDay | null)[] = [...Array.from({ length: previewHistory.leadingBlanks }, () => null), ...previewHistory.days];
  return (
    <Screen>
      <AppText variant="display">{previewHistory.goalName}</AppText>
      <View style={styles.headerStats}>
        <Card style={styles.flex}>
          <AppText variant="title">{strings.stats.days(previewHistory.currentStreak)}</AppText>
          <AppText variant="caption" tone="secondary">
            {h.currentStreak}
          </AppText>
        </Card>
        <Card style={styles.flex}>
          <AppText variant="title">{strings.stats.days(previewHistory.bestStreak)}</AppText>
          <AppText variant="caption" tone="secondary">
            {h.bestStreak}
          </AppText>
        </Card>
        <Card style={styles.flex}>
          <AppText variant="title">{`${Math.round(previewHistory.monthCompletion * 100)}%`}</AppText>
          <AppText variant="caption" tone="secondary">
            {h.monthCompletion}
          </AppText>
        </Card>
      </View>
      <View style={styles.monthNav}>
        <IconButton icon={uiIcons.back} accessibilityLabel={h.previousMonth} />
        <AppText variant="headline">{previewHistory.monthLabel}</AppText>
        <IconButton icon={uiIcons.forward} accessibilityLabel={h.nextMonth} />
      </View>
      <View style={styles.grid}>
        {previewHistory.weekdayLabels.map((w) => (
          <View key={w} style={styles.weekday}>
            <AppText variant="caption" tone="secondary">
              {w}
            </AppText>
          </View>
        ))}
        {cells.map((day, i) => (
          <View key={i} style={styles.slot}>
            {day ? <DayCell day={day} /> : null}
          </View>
        ))}
      </View>
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
      <Card>
        <AppText variant="headline">{h.sheetTitle(previewHistory.sheet.dateLabel)}</AppText>
        <View style={styles.legendItem}>
          <StatusGlyph status={previewHistory.sheet.status} />
          <AppText>{statusLabel(previewHistory.sheet.status)}</AppText>
        </View>
        <AppText variant="label" tone="secondary">
          {h.value}
        </AppText>
        <View style={styles.stepper}>
          <IconButton icon={uiIcons.remove} accessibilityLabel={h.decrease} filled />
          <AppText variant="headline">{previewHistory.sheet.value}</AppText>
          <IconButton icon={uiIcons.add} accessibilityLabel={h.increaseValue} filled />
        </View>
        <TextInput
          accessibilityLabel={h.note}
          placeholder={h.notePlaceholder}
          placeholderTextColor={colors.textSecondary}
          defaultValue={previewHistory.sheet.note}
          maxLength={1000}
          multiline
          style={[styles.note, typography.body, { color: colors.textPrimary, borderColor: colors.border }]}
        />
        <AppText variant="caption" tone="secondary">
          {h.noteCount(previewHistory.sheet.note.length)}
        </AppText>
        <View style={styles.stepper}>
          <Button label={h.clear} variant="plain" />
          <Button label={h.save} />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerStats: { flexDirection: 'row', gap: spacing.sm },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: spacing.xs },
  slot: { width: `${100 / 7}%`, padding: 2 },
  cell: { minHeight: 64, minWidth: minTapTarget, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', gap: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  note: { minHeight: 88, borderWidth: 1, borderRadius: radii.md, padding: spacing.sm, textAlignVertical: 'top' },
});
