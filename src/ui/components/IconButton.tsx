import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../ThemeProvider';
import type { IconName } from '../icons';
import { minTapTarget, radii } from '../tokens';
import { Icon } from './Icon';

type Props = {
  icon: IconName;
  accessibilityLabel: string;
  onPress?: () => void;
  color?: string;
  filled?: boolean;
  disabled?: boolean;
};

export function IconButton({ icon, accessibilityLabel, onPress, color, filled = false, disabled = false }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, filled && { backgroundColor: colors.surfaceMuted }, disabled && { opacity: 0.4 }]}
    >
      <Icon name={icon} size={22} color={color ?? colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: minTapTarget,
    height: minTapTarget,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
