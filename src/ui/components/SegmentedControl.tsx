import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { minTapTarget, radii, spacing } from '../tokens';
import { AppText } from './AppText';

export type Segment<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  segments: Segment<T>[];
  selected: T;
  onChange?: (value: T) => void;
  accessibilityLabel: string;
};

export function SegmentedControl<T extends string>({ segments, selected, onChange, accessibilityLabel }: Props<T>) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: colors.surfaceMuted }]}
    >
      {segments.map((segment) => {
        const active = segment.value === selected;
        return (
          <Pressable
            key={segment.value}
            accessibilityRole="button"
            accessibilityLabel={segment.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange?.(segment.value)}
            style={[styles.segment, active && { backgroundColor: colors.surface }]}
          >
            <AppText variant="label" tone={active ? 'primary' : 'secondary'}>
              {segment.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: radii.pill, padding: spacing.xs },
  segment: {
    flex: 1,
    minHeight: minTapTarget,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
