import { AppText, Card, Screen } from '../../src/ui/components';
import { strings } from '../../src/strings/en';

export default function TodayScreen() {
  return (
    <Screen edges={['top', 'left', 'right']}>
      <AppText variant="display">{strings.tabs.today}</AppText>
      <Card>
        <AppText variant="headline">{strings.today.emptyTitle}</AppText>
        <AppText tone="secondary">{strings.today.emptyBody}</AppText>
      </Card>
    </Screen>
  );
}
