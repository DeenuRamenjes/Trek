import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { radii, spacing } from '../tokens';

type Props = {
  children: ReactNode;
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
  accessible?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

export function Card({ children, muted = false, style, accessible, accessibilityLabel, testID }: Props) {
  const { colors } = useTheme();
  return (
    <View
      accessible={accessible}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[styles.card, { backgroundColor: muted ? colors.surfaceMuted : colors.surface }, style]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, padding: spacing.md, gap: spacing.sm },
});
