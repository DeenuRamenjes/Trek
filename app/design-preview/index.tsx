import { Redirect } from 'expo-router';
import { DesignPreviewIndex } from '../../src/dev/routes/DesignPreviewIndex';

export default function DesignPreviewIndexRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <DesignPreviewIndex />;
}
