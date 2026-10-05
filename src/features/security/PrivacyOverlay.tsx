import { BlurView } from 'expo-blur';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { strings } from '../../strings/en';
import { TrekMark } from '../../ui/components/TrekMark';
import { useTheme } from '../../ui/ThemeProvider';
import { useSettings } from '../settings/settingsStore';

/** Blurred cover with the logo while the app is inactive or backgrounded, so the app switcher shows nothing. */
export function PrivacyOverlay() {
  const { colors, mode } = useTheme();
  const { enabled, hideInAppSwitcher } = useSettings((s) => s.settings.appLock);
  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', setAppState);
    return () => sub.remove();
  }, []);

  if (!enabled || !hideInAppSwitcher || appState !== 'inactive' && appState !== 'background') return null;

  return (
    <BlurView
      testID="privacy-overlay"
      intensity={90}
      tint={mode === 'dark' ? 'dark' : 'light'}
      style={StyleSheet.absoluteFill}
      accessibilityLabel={strings.lock.privacyOverlay}
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.background, opacity: 0.85 }]} />
      <View style={styles.center} pointerEvents="none">
        <TrekMark size={96} color={colors.accent} />
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
