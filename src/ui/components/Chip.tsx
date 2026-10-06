import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { minTapTarget, radii, spacing } from '../tokens';
import { AppText } from './AppText';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

/** Selectable pill. Selection is shown by fill and by the accessibility state, never color alone. */
export function Chip({ label, selected = false, onPress, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? colors.accent : colors.surfaceMuted }]}
    >
      <AppText variant="label" tone={selected ? 'onAccent' : 'primary'}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: minTapTarget,
    minWidth: minTapTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
