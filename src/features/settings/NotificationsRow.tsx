import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { notificationsAdapter } from '../../services/notifications/adapter';
import { permissionRow, type PermissionState } from '../../services/notifications/permissions';
import { strings } from '../../strings/en';
import { AppText, Button, Card } from '../../ui/components';

export function NotificationsRow() {
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
