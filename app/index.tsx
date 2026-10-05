import { router } from 'expo-router';
import { strings } from '../src/strings/en';
import { AppText, Button, Screen } from '../src/ui/components';

export default function Home() {
  return (
    <Screen scroll={false} centered>
      <AppText variant="display">{strings.appName}</AppText>
      <AppText tone="secondary">{strings.home.placeholder}</AppText>
      {__DEV__ ? (
        <Button label={strings.home.openDesignPreview} onPress={() => router.push('/design-preview')} />
      ) : null}
    </Screen>
  );
}
