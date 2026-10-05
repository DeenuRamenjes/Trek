import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { radii, spacing } from '../tokens';

type Props = {
  children: ReactNode;
  muted?: boolean;
  style?: ViewStyle;
};

export function Card({ children, muted = false, style }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: muted ? colors.surfaceMuted : colors.surface }, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, padding: spacing.md, gap: spacing.sm },
});
