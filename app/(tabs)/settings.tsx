import { router } from 'expo-router';
import { NotificationsRow } from '../../src/features/settings/NotificationsRow';
import { getDb } from '../../src/db/client';
import { seedDemoData } from '../../src/db/seed';
import { AppText, Button, Card, Screen } from '../../src/ui/components';
import { strings } from '../../src/strings/en';

function localToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function SettingsScreen() {
  return (
    <Screen edges={['top', 'left', 'right']}>
      <AppText variant="display">{strings.tabs.settings}</AppText>
      <Card>
        <Button
          variant="secondary"
          label={strings.settings.appearance}
          icon="color-palette-outline"
          accessibilityLabel={strings.settings.open(strings.settings.appearance)}
          onPress={() => router.push('/settings/appearance')}
        />
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
