import { Bar, CartesianChart } from 'victory-native';
import { StyleSheet, View } from 'react-native';
import { strings } from '../../../strings/en';
import { AppText, Card } from '../../../ui/components';
import { useTheme } from '../../../ui/ThemeProvider';
import { GrowIn } from './GrowIn';
import type { StatsModel } from '../statsModel';

const t = strings.stats;

export function weeklySummary(weekly: StatsModel['weekly']): string {
  if (weekly.length === 0) return t.noChartData;
  const last = weekly[weekly.length - 1];
  const avg = Math.round(weekly.reduce((s, w) => s + w.percent, 0) / weekly.length);
  return t.weeklySummary(weekly.length, Math.round(last.percent), avg);
}

export function WeeklyBars({ model }: { model: StatsModel }) {
  const { colors } = useTheme();
  const data = model.weekly.map((w, i) => ({ x: i, y: Math.round(w.percent) }));
  return (
    <Card accessible accessibilityLabel={`${t.weeklyBars}. ${weeklySummary(model.weekly)}`} testID="stats-weekly">
      <AppText variant="headline">{t.weeklyBars}</AppText>
      {data.length === 0 ? (
        <AppText tone="secondary">{t.noChartData}</AppText>
      ) : (
        <View style={styles.chart} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <GrowIn axis="y" version={JSON.stringify(data)}>
          <CartesianChart data={data} xKey="x" yKeys={['y']} domain={{ y: [0, 100] }} domainPadding={{ left: 8, right: 8 }}>
            {({ points, chartBounds }) => (
              <Bar points={points.y} chartBounds={chartBounds} color={colors.accent} roundedCorners={{ topLeft: 3, topRight: 3 }} />
            )}
          </CartesianChart>
          </GrowIn>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({ chart: { height: 120 } });
