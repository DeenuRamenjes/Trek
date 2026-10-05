import { Canvas, Group, Line, Rect } from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { parseDate } from '../../../domain/dates';
import { strings } from '../../../strings/en';
import { AppText, Card } from '../../../ui/components';
import { useSettings } from '../../settings/settingsStore';
import { useTheme } from '../../../ui/ThemeProvider';
import { chartSizes, spacing } from '../../../ui/tokens';
import type { StatsModel } from '../statsModel';

const t = strings.stats;
const GAP = 2;
const ROWS = 7;
const MAX_CELL = 14;

/** Ratio buckets, light to strong. A ratio of exactly 0 is drawn crossed, so it never relies on color alone. */
const OPACITIES = [0.25, 0.5, 0.75, 1];

export function heatmapSummary(heatmap: StatsModel['heatmap']): string {
  const scored = heatmap.filter((h) => h.ratio !== null);
  const full = scored.filter((h) => (h.ratio ?? 0) >= 1).length;
  const missed = scored.filter((h) => h.ratio === 0).length;
  return t.heatmapSummary(heatmap.length, scored.length, full, missed);
}

export function Heatmap({ model }: { model: StatsModel }) {
  const { colors } = useTheme();
  const weekStart = useSettings((s) => s.settings.weekStart);
  const [width, setWidth] = useState(0);
  const cells = model.heatmap;
  const lead = cells.length ? (parseDate(cells[0].date).getDay() - weekStart + ROWS) % ROWS : 0;
  const cols = Math.ceil((cells.length + lead) / ROWS);
  const size = Math.max(3, Math.min(MAX_CELL, cols > 0 && width > 0 ? Math.floor((width - GAP * (cols - 1)) / cols) : MAX_CELL));
  const height = ROWS * size + (ROWS - 1) * GAP;
  const step = size + GAP;

  return (
    <Card accessible accessibilityLabel={`${t.heatmap}. ${heatmapSummary(cells)}`} testID="stats-heatmap">
      <AppText variant="headline">{t.heatmap}</AppText>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <Canvas style={{ width: width || '100%', height }} accessible={false}>
          {cells.map((cell, i) => {
            const idx = i + lead;
            const x = Math.floor(idx / ROWS) * step;
            const y = (idx % ROWS) * step;
            if (cell.ratio === null) {
              return <Rect key={cell.date} x={x} y={y} width={size} height={size} color={colors.surfaceMuted} />;
            }
            if (cell.ratio === 0) {
              return (
                <Group key={cell.date}>
                  <Rect x={x} y={y} width={size} height={size} color={colors.surface} />
                  <Rect x={x} y={y} width={size} height={size} color={colors.status.missed} style="stroke" strokeWidth={1} />
                  <Line p1={{ x, y }} p2={{ x: x + size, y: y + size }} color={colors.status.missed} strokeWidth={1} />
                </Group>
              );
            }
            const bucket = Math.min(OPACITIES.length - 1, Math.floor(cell.ratio * OPACITIES.length));
            return <Rect key={cell.date} x={x} y={y} width={size} height={size} color={colors.accent} opacity={OPACITIES[bucket]} />;
          })}
        </Canvas>
      </View>
      <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <LegendSwatch color={colors.surfaceMuted} label={t.legendNone} />
        <LegendSwatch color={colors.accent} label={t.legendDone} />
        <LegendSwatch color={colors.surface} border={colors.status.missed} label={t.legendMissed} crossed />
      </View>
    </Card>
  );
}

function LegendSwatch({ color, border, label, crossed }: { color: string; border?: string; label: string; crossed?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color, borderColor: border ?? color }]}>
        {crossed ? <View style={[styles.cross, { backgroundColor: border }]} /> : null}
      </View>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  swatch: { width: chartSizes.legendSwatch, height: chartSizes.legendSwatch, borderRadius: chartSizes.legendSwatchRadius, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  cross: { width: 16, height: 1, transform: [{ rotate: '45deg' }] },
});
