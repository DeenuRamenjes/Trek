import { useLocalSearchParams } from 'expo-router';
import { ReviewScreen } from '../../src/features/reviews/ReviewScreen';

export default function ReviewRoute() {
  const { period } = useLocalSearchParams<{ period: string }>();
  return <ReviewScreen param={period} />;
}
