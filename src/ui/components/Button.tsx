import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../ThemeProvider';
import type { IconName } from '../icons';
import { minTapTarget, radii, spacing } from '../tokens';
import { AppText } from './AppText';
import { Icon } from './Icon';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'plain';
  icon?: IconName;
  accessibilityLabel?: string;
  disabled?: boolean;
};

export function Button({ label, onPress, variant = 'primary', icon, accessibilityLabel, disabled = false }: Props) {
  const { colors } = useTheme();
  const background = { primary: colors.accent, secondary: colors.surfaceMuted, plain: 'transparent' }[variant];
  const foreground = variant === 'primary' ? colors.onAccent : colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, { backgroundColor: background, opacity: disabled ? 0.5 : 1 }]}
    >
      {icon ? <Icon name={icon} size={18} color={foreground} /> : null}
      <AppText variant="label" color={foreground}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: minTapTarget,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
});
