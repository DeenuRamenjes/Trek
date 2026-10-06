import { useRouter } from 'expo-router';
import { StyleSheet, Switch, View } from 'react-native';
import { strings } from '../../strings/en';
import { AppText, Card, IconButton, Screen } from '../../ui/components';
import { uiIcons } from '../../ui/icons';
import { useTheme } from '../../ui/ThemeProvider';
import { spacing } from '../../ui/tokens';
import { ALL_GOALS, GroupDropdown } from '../stats/GroupDropdown';
import { useSettings } from '../settings/settingsStore';
import { refreshWidgets } from '../../services/widgetBridge';
import { useWidgetPreview } from './useWidgetPreview';

const t = strings.widgetSettings;

export function WidgetSettingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const widget = useSettings((s) => s.settings.widget);
  const update = useSettings((s) => s.update);
  const { groups, snapshot } = useWidgetPreview();

  function change(next: typeof widget) {
    update({ widget: next });
    void refreshWidgets().catch(() => undefined);
  }

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <IconButton icon={uiIcons.back} accessibilityLabel={strings.navigation.back} onPress={() => router.back()} />
        <AppText variant="title" accessibilityRole="header" style={styles.flex}>
          {t.title}
        </AppText>
      </View>

      <Card>
        <AppText variant="headline">{t.group}</AppText>
        <GroupDropdown
          groups={groups}
          selected={widget.groupId ?? ALL_GOALS}
          onChange={(v) => change({ ...widget, groupId: v === ALL_GOALS ? undefined : v })}
        />
      </Card>

      <Card>
        <View style={styles.switchRow}>
          <AppText style={styles.flex}>{t.hideNames}</AppText>
          <Switch
            accessibilityLabel={t.hideNamesLabel}
            value={widget.hideGoalNames}
            onValueChange={(v) => change({ ...widget, hideGoalNames: v })}
            trackColor={{ true: colors.accent, false: colors.border }}
          />
        </View>
        <AppText tone="secondary">{t.hideNamesHelp}</AppText>
      </Card>

      <Card>
        <AppText variant="headline">{t.preview}</AppText>
        {snapshot ? (
          <View accessible accessibilityLabel={t.previewLabel(snapshot.done, snapshot.total)} style={styles.preview}>
            <AppText variant="title">{t.count(snapshot.done, snapshot.total)}</AppText>
            {snapshot.items.length === 0 ? <AppText tone="secondary">{t.empty}</AppText> : null}
            {snapshot.items.map((item) => (
              <View key={item.goalId} style={styles.row}>
                <AppText style={styles.flex}>{widget.hideGoalNames ? t.hiddenName : item.name}</AppText>
                <AppText tone="secondary">{Math.round(item.progress * 100)}%</AppText>
              </View>
            ))}
          </View>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  preview: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
