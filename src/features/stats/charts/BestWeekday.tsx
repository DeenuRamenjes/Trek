import { strings } from '../../../strings/en';
import { AppText, Card } from '../../../ui/components';
import type { StatsModel } from '../statsModel';

const t = strings.stats;

export function BestWeekday({ model }: { model: StatsModel }) {
  const text = model.bestWeekday === null ? t.bestWeekdayNone : strings.insights.weekdays[model.bestWeekday];
  return (
    <Card accessible accessibilityLabel={`${t.bestWeekday}: ${text}`} testID="stats-bestweekday">
      <AppText variant="headline">{t.bestWeekday}</AppText>
      <AppText tone="secondary">{text}</AppText>
    </Card>
  );
}
