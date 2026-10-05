import { StyleSheet, View } from 'react-native';
import type { GoalReview, Insight, Review, StreakChange, TimeSlotResult } from '../../domain/reviewBuilder';
import { strings } from '../../strings/en';
import { AppText, Card, Icon } from '../../ui/components';
import { uiIcons } from '../../ui/icons';
import { AnimatedNumber, Stagger } from '../../ui/motion';
import { useTheme } from '../../ui/ThemeProvider';
import { chartSizes, goalColorFor, radii, spacing } from '../../ui/tokens';
import { GrowIn } from '../stats/charts/GrowIn';

const r = strings.review;

export function slotText(slot: TimeSlotResult | null): string {
  if (!slot) return r.noValue;
  return r.slotCount(slot.kind === 'slot' ? slot.label : r.buckets[slot.bucket], slot.count);
}

export function ChangeChip({ delta }: { delta: number | null }) {
  const { colors } = useTheme();
  if (delta === null) {
    return (
      <View style={[styles.chip, { backgroundColor: colors.surfaceMuted }]} accessibilityLabel={r.noPrevious} accessible>
        <AppText variant="label" tone="secondary">
          {r.noPrevious}
        </AppText>
      </View>
    );
  }
  const pts = Math.round(Math.abs(delta));
  const up = delta >= 0;
  return (
    <View
      style={[styles.chip, { backgroundColor: colors.accentMuted }]}
      accessible
      accessibilityLabel={pts === 0 ? r.changeFlatLabel : up ? r.changeUpLabel(pts) : r.changeDownLabel(pts)}
    >
      <Icon name={up ? uiIcons.up : uiIcons.down} size={14} color={up ? colors.status.done : colors.status.missed} />
      <AppText variant="label">{up ? r.changeUp(pts) : r.changeDown(pts)}</AppText>
    </View>
  );
}

export function OverallCard({ review }: { review: Review }) {
  const scored = review.overall.denominator > 0;
  const pct = Math.round(review.overall.percent);
  return (
    <Card style={styles.center}>
      <AppText variant="label" tone="secondary">
        {r.overall}
      </AppText>
      {scored ? (
        <AnimatedNumber value={review.overall.percent} format={(n) => `${Math.round(n)}%`} accessibilityLabel={r.overallLabel(pct)} />
      ) : (
        <AppText variant="title" tone="secondary">
          {r.noData}
        </AppText>
      )}
      <ChangeChip delta={review.delta} />
    </Card>
  );
}

export function PerGoalCard({ goals, colors: goalColors }: { goals: GoalReview[]; colors: Record<string, string> }) {
  const { colors, mode } = useTheme();
  const rows = goals.filter((g) => g.denominator > 0);
  return (
    <Card>
      <AppText variant="headline">{r.perGoal}</AppText>
      {rows.length === 0 ? (
        <AppText tone="secondary">{r.noChartData}</AppText>
      ) : (
        <View style={styles.list}>
          <Stagger>
            {rows.map((g) => (
              <View key={g.goalId} style={styles.row} accessible accessibilityLabel={r.goalPercent(g.name, Math.round(g.percent))}>
                <AppText variant="caption" style={styles.name} numberOfLines={1}>
                  {g.name}
                </AppText>
                <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
                  <View style={{ width: `${Math.min(100, Math.max(0, g.percent))}%`, height: '100%' }}>
                    <GrowIn axis="x" version={String(g.percent)}>
                      <View style={[styles.fill, { backgroundColor: goalColorFor(mode, goalColors[g.goalId] ?? colors.accent) }]} />
                    </GrowIn>
                  </View>
                </View>
                <AppText variant="caption" tone="secondary">{`${Math.round(g.percent)}%`}</AppText>
              </View>
            ))}
          </Stagger>
        </View>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.flex} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="title">{value}</AppText>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
    </Card>
  );
}

export function BestWorstRow({ review }: { review: Review }) {
  const fmt = (g: GoalReview | null) => (g ? r.goalValue(g.name, Math.round(g.percent)) : r.noValue);
  return (
    <View style={styles.rowGap}>
      <Stat label={r.best} value={fmt(review.bestGoal)} />
      <Stat label={r.worst} value={fmt(review.worstGoal)} />
    </View>
  );
}

function StreakList({ title, items }: { title: string; items: StreakChange[] }) {
  return (
    <Card style={styles.flex}>
      <AppText variant="caption" tone="secondary">
        {title}
      </AppText>
      {items.length === 0 ? (
        <AppText>{r.noStreakChange}</AppText>
      ) : (
        items.map((s) => <AppText key={s.goalId}>{r.streakChange(s.name, s.before, s.after)}</AppText>)
      )}
    </Card>
  );
}

export function StreaksRow({ review }: { review: Review }) {
  return (
    <View style={styles.rowGap}>
      <StreakList title={r.streaksGained} items={review.streaksGained} />
      <StreakList title={r.streaksLost} items={review.streaksLost} />
    </View>
  );
}

export function BestTimeRow({ review }: { review: Review }) {
  return (
    <View style={styles.rowGap}>
      <Stat label={r.bestWeekday} value={review.bestWeekday === null ? r.noValue : strings.insights.weekdays[review.bestWeekday]} />
      <Stat label={r.bestSlot} value={slotText(review.bestTimeSlot)} />
    </View>
  );
}

export function TotalsCard({ review }: { review: Review }) {
  const { done, skipped, vacation } = review.totals;
  return (
    <Card accessible accessibilityLabel={`${r.totals}. ${r.totalsSummary(done, skipped, vacation)}`}>
      <AppText variant="headline">{r.totals}</AppText>
      <AppText>{r.totalsLine(done, skipped, vacation)}</AppText>
    </Card>
  );
}

export function InsightCards({ insights, format }: { insights: Insight[]; format: (i: Insight) => string }) {
  const { colors } = useTheme();
  if (insights.length === 0) return null;
  return (
    <View style={styles.list}>
      <AppText variant="label" tone="secondary">
        {r.insights}
      </AppText>
      {insights.map((i, idx) => (
        <Card key={`${i.id}-${idx}`} testID="review-insight">
          <View style={styles.insight}>
            <Icon name={uiIcons.insight} size={18} color={colors.accent} />
            <AppText style={styles.flex}>{format(i)}</AppText>
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center' },
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowGap: { flexDirection: 'row', gap: spacing.md },
  name: { width: chartSizes.goalNameWidth },
  track: { flex: 1, height: 8, borderRadius: radii.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radii.pill },
  chip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  insight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
