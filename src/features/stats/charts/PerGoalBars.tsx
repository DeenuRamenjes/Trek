import { StyleSheet, View } from 'react-native';
import { strings } from '../../../strings/en';
import { AppText, Card } from '../../../ui/components';
import { useTheme } from '../../../ui/ThemeProvider';
import { goalColorFor, radii, spacing } from '../../../ui/tokens';
import type { StatsModel } from '../statsModel';

const t = strings.stats;

export function perGoalSummary(perGoal: StatsModel['perGoal']): string {
  if (perGoal.length === 0) return t.noChartData;
  return perGoal.map((g) => t.perGoalItem(g.name, Math.round(g.percent))).join(', ');
}

export function PerGoalBars({ model }: { model: StatsModel }) {
  const { colors, mode } = useTheme();
  return (
    <Card accessible accessibilityLabel={`${t.perGoal}. ${perGoalSummary(model.perGoal)}`} testID="stats-pergoal">
      <AppText variant="headline">{t.perGoal}</AppText>
      {model.perGoal.length === 0 ? (
        <AppText tone="secondary">{t.noChartData}</AppText>
      ) : (
        <View style={styles.list} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {model.perGoal.map((g) => (
            <View key={g.goalId} style={styles.row}>
              <AppText variant="caption" style={styles.name} numberOfLines={1}>
                {g.name}
              </AppText>
              <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
                <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, g.percent))}%`, backgroundColor: goalColorFor(mode, g.color) }]} />
              </View>
              <AppText variant="caption" tone="secondary">{`${Math.round(g.percent)}%`}</AppText>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { width: 84 },
  track: { flex: 1, height: 8, borderRadius: radii.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radii.pill },
});
