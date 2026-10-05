import { AppText, Screen } from '../../src/ui/components';
import { strings } from '../../src/strings/en';

export default function StatsScreen() {
  return (
    <Screen edges={['top', 'left', 'right']}>
      <AppText variant="display">{strings.tabs.stats}</AppText>
    </Screen>
  );
}
