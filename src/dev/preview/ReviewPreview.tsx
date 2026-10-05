import { StyleSheet, View } from 'react-native';
import { strings } from '../../strings/en';
import { AppText, Card, Icon, IconButton, Screen } from '../../ui/components';
import { uiIcons } from '../../ui/icons';
import { useTheme } from '../../ui/ThemeProvider';
import { radii, spacing } from '../../ui/tokens';
import { previewReview } from '../mockData';
import { HorizontalBars } from './charts';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.flex}>
      <AppText variant="title">{value}</AppText>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
    </Card>
  );
}

export function ReviewPreview() {
  const { colors } = useTheme();
  const r = strings.review;
  const up = previewReview.change >= 0;
  return (
    <Screen>
      <View style={styles.nav}>
        <IconButton icon={uiIcons.back} accessibilityLabel={r.previousPeriod} />
        <AppText variant="headline">{r.weekTitle(previewReview.weekNumber)}</AppText>
        <IconButton icon={uiIcons.forward} accessibilityLabel={r.nextPeriod} />
      </View>
      <Card style={styles.center}>
        <AppText variant="label" tone="secondary">
          {r.overall}
        </AppText>
        <AppText variant="display">{`${previewReview.overall}%`}</AppText>
        <View style={[styles.chip, { backgroundColor: colors.accentMuted }]}>
          <Icon name={up ? uiIcons.up : uiIcons.down} size={14} color={up ? colors.status.done : colors.status.missed} />
          <AppText variant="label">{up ? r.changeUp(previewReview.change) : r.changeDown(Math.abs(previewReview.change))}</AppText>
        </View>
      </Card>
      <Card>
        <AppText variant="headline">{r.perGoal}</AppText>
        <HorizontalBars items={previewReview.perGoal} />
      </Card>
      <View style={styles.row}>
        <Stat label={r.best} value={`${previewReview.best.name} ${previewReview.best.value}%`} />
        <Stat label={r.worst} value={`${previewReview.worst.name} ${previewReview.worst.value}%`} />
      </View>
      <View style={styles.row}>
        <Stat label={r.streaksGained} value={String(previewReview.streaksGained)} />
        <Stat label={r.streaksLost} value={String(previewReview.streaksLost)} />
      </View>
      <View style={styles.row}>
        <Stat label={r.bestWeekday} value={previewReview.bestWeekday} />
        <Stat label={r.bestSlot} value={previewReview.bestSlot} />
      </View>
      <Card>
        <AppText variant="headline">{r.totals}</AppText>
        <AppText>{`${strings.status.done} ${previewReview.totals.done} · ${strings.status.skipped} ${previewReview.totals.skipped} · ${strings.status.vacation} ${previewReview.totals.vacation}`}</AppText>
      </Card>
      <AppText variant="label" tone="secondary">
        {r.insights}
      </AppText>
      {previewReview.insights.map((text) => (
        <Card key={text}>
          <View style={styles.insight}>
            <Icon name={uiIcons.insight} size={18} color={colors.accent} />
            <AppText style={styles.flex}>{text}</AppText>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.md },
  insight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
