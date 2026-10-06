import { Redirect, useLocalSearchParams } from 'expo-router';
import { DesignPreviewScreen } from '../../src/dev/routes/DesignPreviewScreen';

export default function DesignPreviewScreenRoute() {
  const { screen, mode } = useLocalSearchParams<{ screen: string; mode?: string }>();
  if (!__DEV__) return <Redirect href="/" />;
  return <DesignPreviewScreen screen={screen} mode={mode} />;
}
