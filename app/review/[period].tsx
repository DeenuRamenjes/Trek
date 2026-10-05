import { format, getISOWeek } from 'date-fns';
import { useLocalSearchParams } from 'expo-router';
import { parseDate } from '../../src/domain/dates';
import { strings } from '../../src/strings/en';
import { AppText, Screen } from '../../src/ui/components';

/** Phase 5 stub: shows only the period title. Phase 7 fills in the review. */
function periodTitle(period: string): string {
  const [kind, ...rest] = period.split('-');
  const value = rest.join('-');
  if (kind === 'week') return strings.review.weekTitle(getISOWeek(parseDate(value)));
  if (kind === 'month') return format(parseDate(`${value}-01`), 'MMMM yyyy');
  return period;
}

export default function ReviewScreen() {
  const { period } = useLocalSearchParams<{ period: string }>();
  return (
    <Screen>
      <AppText variant="display">{periodTitle(period ?? '')}</AppText>
    </Screen>
  );
}
