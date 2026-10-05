import { StyleSheet, View } from 'react-native';
import { strings } from '../../strings/en';
import { AppText } from '../../ui/components';
import { radii, spacing } from '../../ui/tokens';
import { useTheme } from '../../ui/ThemeProvider';
import { DayCell } from './DayCell';
import type { MonthModel } from './monthModel';

type Props = { model: MonthModel; weekStart: number; onSelectDay: (date: string) => void };

/** Weekday header plus six week rows; each row ends with the timesPerWeek quota pill when it has one. */
export function MonthGrid({ model, weekStart, onSelectDay }: Props) {
  const { colors } = useTheme();
  // insights.weekdays is Monday-first; weekStart 0 is Sunday.
  const names = Array.from({ length: 7 }, (_, i) => strings.insights.weekdays[(weekStart + 6 + i) % 7].slice(0, 3));
  const hasQuota = model.weeks.some((w) => w.quota);
  return (
    <View>
      <View style={styles.row}>
        {names.map((n) => (
          <View key={n} style={styles.weekday}>
            <AppText variant="caption" tone="secondary">
              {n}
            </AppText>
          </View>
        ))}
        {hasQuota ? <View style={styles.pillSlot} /> : null}
      </View>
      {model.weeks.map((w, i) => (
        <View key={i} style={styles.row}>
          {w.cells.map((c, j) => (
            <DayCell key={j} cell={c} onPress={onSelectDay} />
          ))}
          {hasQuota ? (
            <View style={styles.pillSlot}>
              {w.quota ? (
                <View
                  accessible
                  accessibilityLabel={strings.history.quotaLabel(w.quota.done, w.quota.target)}
                  style={[styles.pill, { backgroundColor: w.quota.done >= w.quota.target ? colors.accentMuted : colors.surfaceMuted }]}
                >
                  <AppText variant="caption">{strings.history.quota(w.quota.done, w.quota.target)}</AppText>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  weekday: { flex: 1, alignItems: 'center', paddingVertical: spacing.xs },
  pillSlot: { width: 44, alignItems: 'center', justifyContent: 'center' },
  pill: { minHeight: 28, minWidth: 40, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs },
});
