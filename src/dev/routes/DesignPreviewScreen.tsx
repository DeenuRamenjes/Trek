import { Redirect, router } from 'expo-router';
import { View } from 'react-native';
import { strings } from '../../strings/en';
import { IconButton } from '../../ui/components';
import { uiIcons } from '../../ui/icons';
import { ThemeProvider } from '../../ui/ThemeProvider';
import { isPreviewKey, previewScreens } from '../preview/registry';

type Props = {
  screen: string | undefined;
  mode: string | undefined;
};

export function DesignPreviewScreen({ screen, mode }: Props) {
  if (!isPreviewKey(screen)) return <Redirect href="/design-preview" />;
  const Component = previewScreens[screen];
  return (
    <ThemeProvider mode={mode === 'dark' ? 'dark' : 'light'}>
      <View style={{ flex: 1 }}>
        <View style={{ alignItems: 'flex-start', paddingHorizontal: 8 }}>
          <IconButton icon={uiIcons.back} accessibilityLabel={strings.navigation.back} onPress={() => router.back()} />
        </View>
        <Component />
      </View>
    </ThemeProvider>
  );
}
