import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import type { Settings } from '../../domain/settings';
import { authenticate, isLockAvailable } from '../../services/appLock';
import { strings } from '../../strings/en';
import { AppText, Card, IconButton, Screen, SegmentedControl } from '../../ui/components';
import { uiIcons } from '../../ui/icons';
import { useTheme } from '../../ui/ThemeProvider';
import { spacing } from '../../ui/tokens';
import { useSettings } from '../settings/settingsStore';

type Notice = 'notEnrolled' | 'authFailed' | null;

export function SecurityScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const appLock = useSettings((s) => s.settings.appLock);
  const update = useSettings((s) => s.update);
  const [notice, setNotice] = useState<Notice>(null);
  const t = strings.security;

  async function toggleLock(next: boolean) {
    setNotice(null);
    if (!next) {
      update({ appLock: { ...appLock, enabled: false } });
      return;
    }
    if (!(await isLockAvailable())) {
      setNotice('notEnrolled');
      return;
    }
    const result = await authenticate({ promptMessage: t.enablePrompt, allowPasscode: true });
    if (!result.ok) {
      setNotice('authFailed');
      return;
    }
    update({ appLock: { ...appLock, enabled: true } });
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
        <View style={styles.switchRow}>
          <AppText style={styles.flex}>{t.appLock}</AppText>
          <Switch
            accessibilityLabel={t.appLockLabel}
            value={appLock.enabled}
            onValueChange={(v) => void toggleLock(v)}
            trackColor={{ true: colors.accent, false: colors.border }}
          />
        </View>
        <AppText tone="secondary">{t.appLockHelp}</AppText>
        {notice ? (
          <AppText accessibilityRole="alert">{notice === 'notEnrolled' ? t.notEnrolled : t.authFailed}</AppText>
        ) : null}
      </Card>

      {appLock.enabled ? (
        <>
          <Card>
            <AppText variant="headline">{t.timeout}</AppText>
            <AppText tone="secondary">{t.timeoutHelp}</AppText>
            <SegmentedControl<Settings['appLock']['timeout']>
              accessibilityLabel={t.timeout}
              selected={appLock.timeout}
              onChange={(timeout) => update({ appLock: { ...appLock, timeout } })}
              segments={[
                { value: 'immediate', label: t.timeoutOptions.immediate },
                { value: '1m', label: t.timeoutOptions['1m'] },
                { value: '5m', label: t.timeoutOptions['5m'] },
                { value: '15m', label: t.timeoutOptions['15m'] },
              ]}
            />
          </Card>
          <Card>
            <View style={styles.switchRow}>
              <AppText style={styles.flex}>{t.hideInSwitcher}</AppText>
              <Switch
                accessibilityLabel={t.hideInSwitcherLabel}
                value={appLock.hideInAppSwitcher}
                onValueChange={(hideInAppSwitcher) => update({ appLock: { ...appLock, hideInAppSwitcher } })}
                trackColor={{ true: colors.accent, false: colors.border }}
              />
            </View>
            <AppText tone="secondary">{t.hideInSwitcherHelp}</AppText>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
});
