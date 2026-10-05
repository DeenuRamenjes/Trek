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
};

export function IconButton({ icon, accessibilityLabel, onPress, color, filled = false }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[styles.button, filled && { backgroundColor: colors.surfaceMuted }]}
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
