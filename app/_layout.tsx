import { installErrorLogging } from '../src/services/errorLog';
import '../src/services/notifications/setup';
import '../src/services/notifications/backgroundTask';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DbProvider } from '../src/db/DbProvider';
import { useNotificationsLifecycle } from '../src/services/notifications/useNotificationsLifecycle';
import { useAutoBackup } from '../src/services/backup/useAutoBackup';
import { strings } from '../src/strings/en';
import { AppText, Screen } from '../src/ui/components';
import { useAppReady } from '../src/features/startup/useAppReady';
import { LockGate } from '../src/features/security/LockGate';
import { useWidgetSync } from '../src/features/widgets/useWidgetSync';
import { PrivacyOverlay } from '../src/features/security/PrivacyOverlay';
import { useSettings } from '../src/features/settings/settingsStore';
import { MotionConfig, useReduceMotion } from '../src/ui/motion';
import { AnimatedSplash } from '../src/ui/splash/AnimatedSplash';
import { ThemedSystemBars } from '../src/ui/ThemedSystemBars';
import { ErrorBoundary } from '../src/ui/ErrorBoundary';
import { ThemeProvider } from '../src/ui/ThemeProvider';

installErrorLogging();
void SplashScreen.preventAutoHideAsync();

function NotificationsLifecycle() {
  useNotificationsLifecycle();
  useAutoBackup();
  useWidgetSync();
  return null;
}

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
          <ErrorBoundary>
            <DbProvider>
              <NotificationsLifecycle />
              <LockGate promptReady={splashDone}>
                <Stack screenOptions={{ headerShown: false, animation: reduce ? 'none' : 'default' }} />
              </LockGate>
            </DbProvider>
          </ErrorBoundary>
          {splashDone ? null : <AnimatedSplash onFinish={() => setSplashDone(true)} />}
          <PrivacyOverlay />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
