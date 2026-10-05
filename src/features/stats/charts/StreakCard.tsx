import { StyleSheet, View } from 'react-native';
import { strings } from '../../../strings/en';
import { AppText, Card } from '../../../ui/components';
import { AnimatedNumber } from '../../../ui/motion';
import { spacing } from '../../../ui/tokens';
import type { StatsModel } from '../statsModel';

const t = strings.stats;

export function StreakCard({ model }: { model: StatsModel }) {
  const label = `${t.currentStreak}: ${t.days(model.currentStreak)}. ${t.bestStreak}: ${t.days(model.bestStreak)}`;
  return (
    <Card accessible accessibilityLabel={label} testID="stats-streaks">
      <View style={styles.row}>
        <View style={styles.cell}>
          <AppText tone="secondary">{t.currentStreak}</AppText>
          <AnimatedNumber value={model.currentStreak} variant="display" accessibilityLabel={String(model.currentStreak)} />
        </View>
        <View style={styles.cell}>
          <AppText tone="secondary">{t.bestStreak}</AppText>
          <AnimatedNumber value={model.bestStreak} variant="display" accessibilityLabel={String(model.bestStreak)} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.lg },
  cell: { flex: 1, gap: spacing.xs },
});
