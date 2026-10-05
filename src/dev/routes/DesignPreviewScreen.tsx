import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { strings } from '../../strings/en';
import { IconButton } from '../../ui/components';
import { uiIcons } from '../../ui/icons';
import { ThemeProvider } from '../../ui/ThemeProvider';
import { spacing } from '../../ui/tokens';
import { isPreviewKey, previewScreens } from '../preview/registry';

type Props = {
  screen: string | undefined;
  mode: string | undefined;
};

export function DesignPreviewScreen({ screen, mode }: Props) {
  const insets = useSafeAreaInsets();
  if (!isPreviewKey(screen)) return <Redirect href="/design-preview" />;
  const Component = previewScreens[screen];
  return (
    <ThemeProvider mode={mode === 'dark' ? 'dark' : 'light'}>
      <View style={styles.root}>
        <View style={[styles.backRow, { paddingTop: insets.top }]}>
          <IconButton icon={uiIcons.back} accessibilityLabel={strings.navigation.back} onPress={() => router.back()} />
        </View>
        <Component />
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backRow: { alignItems: 'flex-start', paddingHorizontal: spacing.sm },
});
