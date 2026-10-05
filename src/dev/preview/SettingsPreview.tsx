import { Pressable, StyleSheet, View } from 'react-native';
import { strings } from '../../strings/en';
import { AppText, Card, Icon, Screen } from '../../ui/components';
import { IconName, uiIcons } from '../../ui/icons';
import { useTheme } from '../../ui/ThemeProvider';
import { minTapTarget, spacing } from '../../ui/tokens';
import { previewSettings } from '../mockData';

function Row({ icon, title, value }: { icon?: IconName; title: string; value?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={strings.settings.open(title)} style={styles.row}>
      {icon ? <Icon name={icon} size={20} color={colors.accent} /> : null}
      <AppText style={styles.flex}>{title}</AppText>
      {value ? <AppText tone="secondary">{value}</AppText> : null}
      <Icon name={uiIcons.forward} size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

export function SettingsPreview() {
  const s = strings.settings;
  return (
    <Screen>
      <AppText variant="display">{s.title}</AppText>
      <AppText variant="label" tone="secondary">
        {s.appearance}
      </AppText>
      <Card>
        {previewSettings.appearance.map((item) => (
          <Row key={item.key} title={s[item.key]} value={item.value} />
        ))}
      </Card>
      <Card>
        <Row icon={uiIcons.vacation} title={s.vacation} />
        <Row icon={uiIcons.backup} title={s.backup} />
        <Row icon={uiIcons.security} title={s.security} />
        <Row icon={uiIcons.widget} title={s.widget} />
      </Card>
      <AppText variant="label" tone="secondary">
        {s.about}
      </AppText>
      <Card>
        <Row icon={uiIcons.about} title={s.exportErrorLog} />
      </Card>
      <View style={styles.spacer} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { minHeight: minTapTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  spacer: { height: spacing.lg },
});
