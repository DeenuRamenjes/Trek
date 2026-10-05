import { router } from 'expo-router';
import { AppText, Button, Card, Screen } from '../../src/ui/components';
import { strings } from '../../src/strings/en';

export default function SettingsScreen() {
  return (
    <Screen edges={['top', 'left', 'right']}>
      <AppText variant="display">{strings.tabs.settings}</AppText>
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
        </Card>
      ) : null}
    </Screen>
  );
}
