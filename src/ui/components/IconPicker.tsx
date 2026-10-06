import { Pressable, StyleSheet, View } from 'react-native';
import { strings } from '../../strings/en';
import { useTheme } from '../ThemeProvider';
import { goalIcons, type IconName } from '../icons';
import { minTapTarget, radii, spacing } from '../tokens';
import { Icon } from './Icon';

type Props = {
  value: string;
  onChange: (icon: IconName) => void;
};

/** Curated Ionicons grid. */
export function IconPicker({ value, onChange }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      {goalIcons.map((name) => {
        const selected = name === value;
        return (
          <Pressable
            key={name}
            accessibilityRole="button"
            accessibilityLabel={strings.goalForm.chooseIcon(name)}
            accessibilityState={{ selected }}
            onPress={() => onChange(name)}
            style={[
              styles.choice,
              { backgroundColor: selected ? colors.accentMuted : colors.surfaceMuted, borderColor: selected ? colors.accent : 'transparent' },
            ]}
          >
            <Icon name={name} size={20} color={colors.textPrimary} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: {
    width: minTapTarget,
    height: minTapTarget,
    borderRadius: radii.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
