import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ensureNotificationPermission } from '../../services/notifications/permissions';
import { notificationsAdapter } from '../../services/notifications/adapter';
import { logCatch } from '../../services/errorLog';
import { strings } from '../../strings/en';
import { AppText, Button, Icon, Screen } from '../../ui/components';
import { TrekMark } from '../../ui/components/TrekMark';
import { FadeIn, SlideUp, Stagger } from '../../ui/motion';
import { useTheme } from '../../ui/ThemeProvider';
import { spacing } from '../../ui/tokens';
import { markOnboardingDone } from './onboardingStore';

const o = strings.onboarding;
const LAST = o.pages.length - 1;

export function OnboardingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const page = o.pages[index];

  const finish = () => {
    markOnboardingDone();
    router.replace('/today');
  };
  const enable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await ensureNotificationPermission(notificationsAdapter as never);
    } catch (e) {
      logCatch('onboarding.permission')(e);
    } finally {
      finish();
    }
  };

  return (
    <Screen centered scroll={false}>
      <FadeIn key={index} testID="onboarding-page" style={styles.page}>
        <View style={styles.hero}>
          {page.icon === 'mark' ? (
            <TrekMark size={96} color={colors.accent} />
          ) : (
            <Icon name={page.icon} size={72} color={colors.accent} />
          )}
        </View>
        <Stagger>
          <AppText variant="display" accessibilityRole="header" style={styles.center}>
            {page.title}
          </AppText>
          <AppText tone="secondary" style={styles.center}>
            {page.body}
          </AppText>
        </Stagger>
      </FadeIn>
      <SlideUp key={`actions-${index}`} style={styles.actions}>
        <AppText variant="caption" tone="secondary" style={styles.center} accessibilityLabel={o.progress(index + 1, o.pages.length)}>
          {`${index + 1} / ${o.pages.length}`}
        </AppText>
        {index < LAST ? (
          <Button label={o.next} onPress={() => setIndex(index + 1)} />
        ) : (
          <>
            <Button label={o.enable} icon="notifications-outline" onPress={() => void enable()} disabled={busy} />
            <Button label={o.notNow} variant="plain" onPress={finish} disabled={busy} />
          </>
        )}
      </SlideUp>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg, alignItems: 'center' },
  hero: { alignItems: 'center', paddingBottom: spacing.md },
  center: { textAlign: 'center' },
  actions: { gap: spacing.sm, alignSelf: 'stretch', paddingTop: spacing.xl },
});
