import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { strings } from '../src/strings/en';
import { AppText, Screen } from '../src/ui/components';
import { useAppReady } from '../src/features/startup/useAppReady';
import { useSettings } from '../src/features/settings/settingsStore';
import { MotionConfig, useReduceMotion } from '../src/ui/motion';
import { AnimatedSplash } from '../src/ui/splash/AnimatedSplash';
import { ThemedSystemBars } from '../src/ui/ThemedSystemBars';
import { ThemeProvider } from '../src/ui/ThemeProvider';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const theme = useSettings((s) => s.settings.theme);
  const accent = useSettings((s) => s.settings.accentColor);
  const reduce = useReduceMotion();
  const [splashDone, setSplashDone] = useState(false);

  const { ready, error } = useAppReady();
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  if (error) {
    return (
      <SafeAreaProvider>
        <ThemeProvider mode={theme === 'system' ? undefined : theme} accent={accent}>
          <ThemedSystemBars />
          <Screen centered>
            <AppText variant="title" accessibilityRole="header">
              {strings.startup.errorTitle}
            </AppText>
            <AppText tone="secondary">{strings.startup.errorBody}</AppText>
          </Screen>
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider mode={theme === 'system' ? undefined : theme} accent={accent}>
          <MotionConfig />
          <ThemedSystemBars />
          <Stack screenOptions={{ headerShown: false, animation: reduce ? 'none' : 'default' }} />
          {splashDone ? null : <AnimatedSplash onFinish={() => setSplashDone(true)} />}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
