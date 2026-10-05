import { AppText, Screen } from '../../src/ui/components';
import { strings } from '../../src/strings/en';

export default function GoalsScreen() {
  return (
    <Screen edges={['top', 'left', 'right']}>
      <AppText variant="display">{strings.tabs.goals}</AppText>
    </Screen>
  );
}
