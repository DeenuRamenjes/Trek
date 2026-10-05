import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { notificationsAdapter } from '../../src/services/notifications/adapter';
import { permissionRow, type PermissionState } from '../../src/services/notifications/permissions';
import { getDb } from '../../src/db/client';
import { seedDemoData } from '../../src/db/seed';
import { AppText, Button, Card, Screen } from '../../src/ui/components';
import { strings } from '../../src/strings/en';

function localToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function NotificationsRow() {
  const [state, setState] = useState<PermissionState | null>(null);
  const refresh = useCallback(() => {
    notificationsAdapter.getPermissions().then(setState, () => undefined);
  }, []);
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);
  if (!state) return null;
  const row = permissionRow(state);
  const t = strings.settings.notifications;
  const onPress = () => {
    if (row.action === 'openSettings') void Linking.openSettings();
    else notificationsAdapter.requestPermissions().then(setState, () => undefined);
  };
  return (
    <Card>
      <AppText variant="headline">{t.title}</AppText>
      <AppText tone="secondary">{row.text}</AppText>
      {row.action !== 'none' && row.actionLabel ? (
        <Button variant="secondary" label={row.actionLabel} accessibilityLabel={row.actionLabel} onPress={onPress} />
      ) : null}
    </Card>
  );
}

export default function SettingsScreen() {
  return (
    <Screen edges={['top', 'left', 'right']}>
      <AppText variant="display">{strings.tabs.settings}</AppText>
      <Card>
        <Button
          variant="secondary"
          label={strings.settings.vacation}
          icon="airplane"
          accessibilityLabel={strings.settings.open(strings.settings.vacation)}
          onPress={() => router.push('/vacation')}
        />
      </Card>
      <NotificationsRow />
      {__DEV__ ? (
        <Card>
          <AppText variant="headline">{strings.devTools.title}</AppText>
          <Button
            variant="secondary"
            label={strings.devTools.designPreview}
            accessibilityLabel={strings.devTools.open(strings.devTools.designPreview)}
            onPress={() => router.push('/design-preview')}
          />
          <Button
            variant="secondary"
            label={strings.devTools.motionCheck}
            accessibilityLabel={strings.devTools.open(strings.devTools.motionCheck)}
            onPress={() => router.push('/motion-check')}
          />
          <Button
            variant="secondary"
            label={strings.devTools.seed}
            accessibilityLabel={strings.devTools.seed}
            onPress={() => void seedDemoData(getDb(), { today: localToday() })}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
