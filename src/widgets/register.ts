import { Platform } from 'react-native';
import { registerWidgetRenderers } from '../services/widgets/adapter';

/* eslint-disable @typescript-eslint/no-require-imports */
// Runs from the app entry (index.ts) so both the app and the Android headless task have the renderers.
if (Platform.OS === 'ios') {
  registerWidgetRenderers({ ios: require('./iosWidget').TrekIosWidget });
} else if (Platform.OS === 'android') {
  registerWidgetRenderers({ android: require('./androidWidget').renderAndroidWidget });
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { createAndroidTaskHandler } = require('./androidTask');
  registerWidgetTaskHandler(createAndroidTaskHandler());
}
