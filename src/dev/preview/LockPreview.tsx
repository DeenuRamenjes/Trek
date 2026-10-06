import { StyleSheet, View } from 'react-native';
import { strings } from '../../strings/en';
import { AppText, Button, Icon, Screen } from '../../ui/components';
import { uiIcons } from '../../ui/icons';
import { useTheme } from '../../ui/ThemeProvider';
import { radii } from '../../ui/tokens';

export function LockPreview() {
  const { colors } = useTheme();
  return (
    <Screen scroll={false} centered>
      <View style={[styles.mark, { backgroundColor: colors.accentMuted }]}>
        <Icon name={uiIcons.lock} size={40} color={colors.accent} />
      </View>
      <AppText variant="title">{strings.lock.title}</AppText>
      <AppText tone="secondary">{strings.lock.body}</AppText>
      <Button label={strings.lock.unlock} icon={uiIcons.lock} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  mark: { width: 88, height: 88, borderRadius: radii.xl, alignItems: 'center', justifyContent: 'center' },
});
