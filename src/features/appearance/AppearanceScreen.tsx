import { useRouter } from 'expo-router';
import { StyleSheet, Switch, View } from 'react-native';
import type { Settings } from '../../domain/settings';
import { strings } from '../../strings/en';
import { AppText, Card, Chip, IconButton, Screen, SegmentedControl } from '../../ui/components';
import { uiIcons } from '../../ui/icons';
import { useTheme } from '../../ui/ThemeProvider';
import { spacing } from '../../ui/tokens';
import { useSettings } from '../settings/settingsStore';
import { AccentPicker } from './AccentPicker';
import { dayEndsLabel } from './dayEndsLabel';

const HOURS = [0, 1, 2, 3, 4] as const;

export function AppearanceScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const s = strings.settings;
  const a = s.appearanceScreen;

  const weekStarts: { value: number; label: string }[] = [
    { value: 0, label: a.weekStartOptions.sunday },
    { value: 1, label: a.weekStartOptions.monday },
    { value: 6, label: a.weekStartOptions.saturday },
  ];

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <IconButton icon={uiIcons.back} accessibilityLabel={strings.navigation.back} onPress={() => router.back()} />
        <AppText variant="title" accessibilityRole="header" style={styles.flex}>
          {s.appearance}
        </AppText>
      </View>

      <Card>
        <AppText variant="headline">{s.theme}</AppText>
        <SegmentedControl<Settings['theme']>
          accessibilityLabel={s.theme}
          selected={settings.theme}
          onChange={(theme) => update({ theme })}
          segments={[
            { value: 'system', label: a.themeOptions.system },
            { value: 'light', label: a.themeOptions.light },
            { value: 'dark', label: a.themeOptions.dark },
          ]}
        />
      </Card>

      <Card>
        <AppText variant="headline">{s.accent}</AppText>
        <AccentPicker value={settings.accentColor} onChange={(accentColor) => update({ accentColor })} />
      </Card>

      <Card>
        <AppText variant="headline">{s.weekStart}</AppText>
        <View style={styles.wrap}>
          {weekStarts.map((w) => (
            <Chip key={w.value} label={w.label} selected={settings.weekStart === w.value} onPress={() => update({ weekStart: w.value })} />
          ))}
        </View>
      </Card>

      <Card>
        <AppText variant="headline">{s.timeFormat}</AppText>
        <SegmentedControl<Settings['timeFormat']>
          accessibilityLabel={s.timeFormat}
          selected={settings.timeFormat}
          onChange={(timeFormat) => update({ timeFormat })}
          segments={[
            { value: '12h', label: a.timeFormatOptions.h12 },
            { value: '24h', label: a.timeFormatOptions.h24 },
          ]}
        />
      </Card>

      <Card>
        <AppText variant="headline">{s.dayEndsAt}</AppText>
        <AppText tone="secondary">{a.dayEndsHelp}</AppText>
        <View style={styles.wrap}>
          {HOURS.map((h) => {
            const label = dayEndsLabel(h, settings.timeFormat);
            return (
              <Chip
                key={h}
                label={label}
                accessibilityLabel={a.dayEndsOption(label)}
                selected={settings.dayEndsAt === h}
                onPress={() => update({ dayEndsAt: h })}
              />
            );
          })}
        </View>
      </Card>

      <Card>
        <View style={styles.switchRow}>
          <AppText style={styles.flex}>{s.haptics}</AppText>
          <Switch
            accessibilityLabel={a.hapticsLabel}
            value={settings.haptics}
            onValueChange={(haptics) => update({ haptics })}
            trackColor={{ true: colors.accent, false: colors.border }}
          />
        </View>
      </Card>

      <Card>
        <AppText variant="headline">{s.reduceMotion}</AppText>
        <SegmentedControl<Settings['reduceMotionOverride']>
          accessibilityLabel={s.reduceMotion}
          selected={settings.reduceMotionOverride}
          onChange={(reduceMotionOverride) => update({ reduceMotionOverride })}
          segments={[
            { value: 'system', label: a.reduceMotionOptions.system },
            { value: 'on', label: a.reduceMotionOptions.on },
            { value: 'off', label: a.reduceMotionOptions.off },
          ]}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
});
