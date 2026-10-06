import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../ThemeProvider';
import { spacing } from '../tokens';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  centered?: boolean;
  /** Safe-area edges to pad; tab screens drop 'bottom' because the tab bar handles it. */
  edges?: Edge[];
};

const ALL_EDGES: Edge[] = ['top', 'right', 'bottom', 'left'];

export function Screen({ children, scroll = true, centered = false, edges = ALL_EDGES }: Props) {
  const { colors } = useTheme();
  const content = centered ? (scroll ? styles.centeredScroll : styles.centered) : styles.content;
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: colors.background }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={content}>{children}</ScrollView>
      ) : (
        <View style={[styles.fill, content]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  centeredScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
});
