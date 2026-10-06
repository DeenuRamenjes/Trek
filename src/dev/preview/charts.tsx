import { StyleSheet, View } from 'react-native';
import { AppText } from '../../ui/components';
import { useTheme } from '../../ui/ThemeProvider';
import { goalColorFor, radii, spacing } from '../../ui/tokens';

/**
 * Static stand-ins for the design preview only. The real charts are built with
 * Skia and victory-native in Phase 5 and animate to their values.
 */

export function DotRing({ value, size = 120, label }: { value: number; size?: number; label: string }) {
  const { colors } = useTheme();
  const dots = 32;
  const radius = size / 2 - 6;
  return (
    <View accessible accessibilityLabel={label} style={{ width: size, height: size }}>
      {Array.from({ length: dots }, (_, i) => {
        const angle = (i / dots) * 2 * Math.PI - Math.PI / 2;
        const on = i / dots < value;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              {
                left: size / 2 + radius * Math.cos(angle) - 4,
                top: size / 2 + radius * Math.sin(angle) - 4,
                backgroundColor: on ? colors.accent : colors.surfaceMuted,
              },
            ]}
          />
        );
      })}
      <View style={styles.ringCenter}>
        <AppText variant="title">{`${Math.round(value * 100)}%`}</AppText>
      </View>
    </View>
  );
}

export function HeatmapGrid({ values, label }: { values: number[]; label: string }) {
  const { colors } = useTheme();
  const weeks = Math.ceil(values.length / 7);
  return (
    <View accessible accessibilityLabel={label} style={styles.heatmap}>
      {Array.from({ length: weeks }, (_, w) => (
        <View key={w} style={styles.heatmapColumn}>
          {values.slice(w * 7, w * 7 + 7).map((v, d) => (
            <View
              key={d}
              style={[styles.heatCell, { backgroundColor: v < 0.15 ? colors.surfaceMuted : colors.accent, opacity: v < 0.15 ? 1 : 0.35 + v * 0.65 }]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export function VerticalBars({ items, label }: { items: { label: string; value: number }[]; label: string }) {
  const { colors } = useTheme();
  const max = Math.max(...items.map((i) => i.value));
  return (
    <View accessible accessibilityLabel={label} style={styles.bars}>
      {items.map((item) => (
        <View key={item.label} style={styles.barColumn}>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.bar,
                { height: `${item.value * 100}%`, backgroundColor: item.value === max ? colors.accent : colors.textSecondary },
              ]}
            />
          </View>
          <AppText variant="caption" tone="secondary">
            {item.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export function TrendDots({ values, label }: { values: number[]; label: string }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={label} style={styles.trend}>
      {values.map((v, i) => (
        <View key={i} style={styles.trendColumn}>
          <View style={[styles.trendDot, { bottom: `${v * 100}%`, backgroundColor: colors.accent }]} />
        </View>
      ))}
    </View>
  );
}

export function HorizontalBars({ items }: { items: { name: string; color: string; value: number }[] }) {
  const { colors, mode } = useTheme();
  return (
    <View style={styles.hbars}>
      {items.map((item) => (
        <View key={item.name} style={styles.hbarRow}>
          <AppText variant="caption" style={styles.hbarLabel}>
            {item.name}
          </AppText>
          <View style={[styles.hbarTrack, { backgroundColor: colors.surfaceMuted }]}>
            <View style={[styles.hbar, { width: `${item.value * 100}%`, backgroundColor: goalColorFor(mode, item.color) }]} />
          </View>
          <AppText variant="caption" tone="secondary">{`${Math.round(item.value * 100)}%`}</AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  ringCenter: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  heatmap: { flexDirection: 'row', gap: 3 },
  heatmapColumn: { gap: 3 },
  heatCell: { width: 14, height: 14, borderRadius: 3 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, height: 120 },
  barColumn: { flex: 1, alignItems: 'center', gap: spacing.xs, height: '100%' },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: radii.sm },
  trend: { flexDirection: 'row', height: 80 },
  trendColumn: { flex: 1 },
  trendDot: { position: 'absolute', alignSelf: 'center', width: 8, height: 8, borderRadius: 4 },
  hbars: { gap: spacing.sm },
  hbarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hbarLabel: { width: 84 },
  hbarTrack: { flex: 1, height: 8, borderRadius: radii.pill, overflow: 'hidden' },
  hbar: { height: '100%', borderRadius: radii.pill },
});
