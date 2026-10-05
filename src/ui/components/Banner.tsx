import { StyleSheet, View } from 'react-native';
import type { IconName } from '../icons';
import { useTheme } from '../ThemeProvider';
import { radii, spacing } from '../tokens';
import { AppText } from './AppText';
import { Button } from './Button';
import { Icon } from './Icon';

export type BannerAction = { label: string; onPress?: () => void };

type Props = {
  icon: IconName;
  message: string;
  actions: BannerAction[];
};

export function Banner({ icon, message, actions }: Props) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="summary" style={[styles.banner, { backgroundColor: colors.accentMuted }]}>
      <View style={styles.row}>
        <Icon name={icon} size={20} color={colors.accent} />
        <AppText variant="body" style={styles.message}>
          {message}
        </AppText>
      </View>
      <View style={styles.actions}>
        {actions.map((action, index) => (
          <Button
            key={action.label}
            label={action.label}
            onPress={action.onPress}
            variant={index === 0 ? 'primary' : 'plain'}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: radii.lg, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  message: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
