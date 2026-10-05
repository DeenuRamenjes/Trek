import { format } from 'date-fns';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { parseDate } from '../../domain/dates';
import { strings } from '../../strings/en';
import { AppText, StatusGlyph, statusLabel } from '../../ui/components';
import { useTheme } from '../../ui/ThemeProvider';
import { minTapTarget, radii } from '../../ui/tokens';
import type { HistoryCell } from './monthModel';

type Props = { cell: HistoryCell; onPress: (date: string) => void };

/** One day: number, status glyph (never color alone), optional value badge. Future days are disabled. */
function DayCellView({ cell, onPress }: Props) {
  const { colors } = useTheme();
  if (!cell.date || !cell.status) return <View style={styles.cell} />;
  const date = cell.date;
  const label = strings.history.dayLabel(
    format(parseDate(date), 'EEEE d MMMM'),
    strings.history.dayDetail(statusLabel(cell.status), cell.badge, cell.readOnly),
  );
  const muted = cell.status === 'notDue';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: cell.readOnly }}
      disabled={cell.readOnly}
      onPress={() => onPress(date)}
      style={[
        styles.cell,
        { backgroundColor: muted ? 'transparent' : colors.surface },
        cell.isToday && { borderWidth: 2, borderColor: colors.accent },
      ]}
    >
      <AppText variant="caption" tone={muted ? 'secondary' : 'primary'}>
        {String(cell.day)}
      </AppText>
      <StatusGlyph status={cell.status} size={16} />
      {cell.badge ? (
        <AppText variant="caption" tone="secondary">
          {cell.badge}
        </AppText>
      ) : null}
    </Pressable>
  );
}

export const DayCell = memo(DayCellView);

const styles = StyleSheet.create({
  cell: { flex: 1, minHeight: 64, minWidth: minTapTarget, margin: 1, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', gap: 2 },
});
