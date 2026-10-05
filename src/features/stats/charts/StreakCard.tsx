import { StyleSheet, View } from 'react-native';
import { strings } from '../../../strings/en';
import { AppText, Card } from '../../../ui/components';
import { AnimatedNumber } from '../../../ui/motion';
import { spacing } from '../../../ui/tokens';
import type { StatsModel } from '../statsModel';

const t = strings.stats;

export function StreakCard({ model }: { model: StatsModel }) {
  const unit = (n: number, u: 'days' | 'weeks') => (u === 'weeks' ? t.weeks(n) : t.days(n));
  const label = `${t.currentStreak}: ${unit(model.currentStreak, model.currentStreakUnit)}. ${t.bestStreak}: ${unit(model.bestStreak, model.bestStreakUnit)}`;
  return (
    <Card accessible accessibilityLabel={label} testID="stats-streaks">
      <View style={styles.row}>
        <View style={styles.cell}>
          <AppText tone="secondary">{t.currentStreak}</AppText>
          <AnimatedNumber value={model.currentStreak} variant="display" accessibilityLabel={String(model.currentStreak)} />
          <AppText variant="caption" tone="secondary">{model.currentStreakUnit === 'weeks' ? t.unitWeeks : t.unitDays}</AppText>
        </View>
        <View style={styles.cell}>
          <AppText tone="secondary">{t.bestStreak}</AppText>
          <AnimatedNumber value={model.bestStreak} variant="display" accessibilityLabel={String(model.bestStreak)} />
          <AppText variant="caption" tone="secondary">{model.bestStreakUnit === 'weeks' ? t.unitWeeks : t.unitDays}</AppText>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.lg },
  cell: { flex: 1, gap: spacing.xs },
});
