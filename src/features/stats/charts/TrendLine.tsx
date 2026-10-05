import { CartesianChart, Line } from 'victory-native';
import { StyleSheet, View } from 'react-native';
import { strings } from '../../../strings/en';
import { AppText, Card } from '../../../ui/components';
import { useTheme } from '../../../ui/ThemeProvider';
import type { StatsModel } from '../statsModel';

const t = strings.stats;

export function trendSummary(trend: StatsModel['trend']): string {
  if (trend.length === 0) return t.noChartData;
  const first = Math.round(trend[0].percent);
  const last = Math.round(trend[trend.length - 1].percent);
  return t.trendSummary(first, last);
}

export function TrendLine({ model }: { model: StatsModel }) {
  const { colors } = useTheme();
  const data = model.trend.map((p, i) => ({ x: i, y: Math.round(p.percent) }));
  return (
    <Card accessible accessibilityLabel={`${t.trend}. ${trendSummary(model.trend)}`} testID="stats-trend">
      <AppText variant="headline">{t.trend}</AppText>
      {data.length < 2 ? (
        <AppText tone="secondary">{t.noChartData}</AppText>
      ) : (
        <View style={styles.chart} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <CartesianChart data={data} xKey="x" yKeys={['y']} domain={{ y: [0, 100] }}>
            {({ points }) => <Line points={points.y} color={colors.accent} strokeWidth={2} curveType="natural" />}
          </CartesianChart>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({ chart: { height: 100 } });
