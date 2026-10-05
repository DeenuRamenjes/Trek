import { CartesianChart, Line } from 'victory-native';
import { StyleSheet, View } from 'react-native';
import { strings } from '../../../strings/en';
import { AppText, Card } from '../../../ui/components';
import { useTheme } from '../../../ui/ThemeProvider';
import { GrowIn } from './GrowIn';
import type { StatsModel } from '../statsModel';

const t = strings.stats;

export function trendSummary(trend: StatsModel['trend']): string {
  if (trend.length === 0) return t.noChartData;
  const scored = trend.filter((p) => p.percent !== null);
  if (scored.length === 0) return t.noChartData;
  return t.trendSummary(Math.round(scored[0].percent ?? 0), Math.round(scored[scored.length - 1].percent ?? 0));
}

export function TrendLine({ model }: { model: StatsModel }) {
  const { colors } = useTheme();
  const data = model.trend.map((p, i) => ({ x: i, y: p.percent === null ? null : Math.round(p.percent) }));
  return (
    <Card accessible accessibilityLabel={`${t.trend}. ${trendSummary(model.trend)}`} testID="stats-trend">
      <AppText variant="headline">{t.trend}</AppText>
      {data.length < 2 ? (
        <AppText tone="secondary">{t.noChartData}</AppText>
      ) : (
        <View style={styles.chart} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <GrowIn axis="y" version={JSON.stringify(data)}>
          <CartesianChart data={data} xKey="x" yKeys={['y']} domain={{ y: [0, 100] }}>
            {({ points }) => <Line points={points.y} color={colors.accent} strokeWidth={2} curveType="natural" connectMissingData={false} />}
          </CartesianChart>
          </GrowIn>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({ chart: { height: 100 } });
