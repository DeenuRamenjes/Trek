import { Redirect } from 'expo-router';
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
      <Component />
    </ThemeProvider>
  );
}
