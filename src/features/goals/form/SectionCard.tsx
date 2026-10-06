import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { strings } from '../../../strings/en';
import { AppText, Card, Icon } from '../../../ui/components';
import { Collapse } from '../../../ui/motion';
import { useTheme } from '../../../ui/ThemeProvider';
import { minTapTarget, spacing } from '../../../ui/tokens';
import { uiIcons } from '../../../ui/icons';

type Props = {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

/** A collapsible form section: header with a one-line summary, and content inside Collapse. */
export function SectionCard({ title, summary, open, onToggle, children }: Props) {
  const { colors } = useTheme();
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={strings.goalForm.toggleSection(title)}
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={styles.header}
      >
        <View style={styles.flex}>
          <AppText variant="headline">{title}</AppText>
          <AppText variant="caption" tone="secondary">
            {summary}
          </AppText>
        </View>
        <Icon name={open ? uiIcons.expand : uiIcons.forward} size={20} color={colors.textSecondary} />
      </Pressable>
      <Collapse open={open}>
        <View style={styles.body}>{children}</View>
      </Collapse>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { minHeight: minTapTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  body: { gap: spacing.sm, paddingTop: spacing.sm },
});
