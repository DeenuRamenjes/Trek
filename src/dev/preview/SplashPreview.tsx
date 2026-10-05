import { StyleSheet, View } from 'react-native';
import { strings } from '../../strings/en';
import { AppText, Icon, Screen } from '../../ui/components';
import { uiIcons } from '../../ui/icons';
import { useTheme } from '../../ui/ThemeProvider';
import { radii } from '../../ui/tokens';

/** Final frame of the animated splash. The Skia trail mark replaces the icon in Phase 1. */
export function SplashPreview() {
  const { colors } = useTheme();
  return (
    <Screen scroll={false} centered>
      <View style={[styles.mark, { backgroundColor: colors.accent }]}>
        <Icon name={uiIcons.mark} size={56} color={colors.onAccent} />
      </View>
      <AppText variant="display">{strings.appName}</AppText>
      <AppText tone="secondary">{strings.splash.tagline}</AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mark: { width: 112, height: 112, borderRadius: radii.xl, alignItems: 'center', justifyContent: 'center' },
});
