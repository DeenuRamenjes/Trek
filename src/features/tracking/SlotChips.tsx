import { Pressable, StyleSheet, View } from 'react-native';
import { strings } from '../../strings/en';
import { AppText, Icon } from '../../ui/components';
import { uiIcons } from '../../ui/icons';
import { useTheme } from '../../ui/ThemeProvider';
import { minTapTarget, radii, spacing } from '../../ui/tokens';
import type { TodaySlot } from './todayModel';

type Props = { goalName: string; slots: TodaySlot[]; onToggle: (slot: TodaySlot) => void };

/** One chip per time slot; a done slot carries a check icon (not color alone). */
export function SlotChips({ goalName, slots, onToggle }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      {slots.map((slot) => (
        <Pressable
          key={slot.id}
          accessibilityRole="checkbox"
          accessibilityLabel={strings.today.toggleSlot(goalName, slot.time)}
          accessibilityState={{ checked: slot.done }}
          onPress={() => onToggle(slot)}
          style={[styles.chip, { backgroundColor: slot.done ? colors.accentMuted : colors.surfaceMuted }]}
        >
          {slot.done ? <Icon name={uiIcons.check} size={14} color={colors.accent} /> : null}
          <AppText variant="label">{slot.label ? `${slot.label} ${slot.time}` : slot.time}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: minTapTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
