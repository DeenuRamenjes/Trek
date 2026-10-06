import { StyleSheet, View } from 'react-native';
import type { IconName } from '../icons';
import { useTheme } from '../ThemeProvider';
import { goalColorFor, radii } from '../tokens';
import { Icon } from './Icon';

type Props = {
  icon: IconName;
  color: string;
  size?: number;
};

export function GoalIcon({ icon, color, size = 40 }: Props) {
  const { mode, colors } = useTheme();
  const tint = goalColorFor(mode, color);
  return (
    <View style={[styles.badge, { width: size, height: size, backgroundColor: colors.surfaceMuted }]}>
      <Icon name={icon} size={size * 0.5} color={tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
});
