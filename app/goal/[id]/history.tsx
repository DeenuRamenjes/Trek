import { useLocalSearchParams } from 'expo-router';
import { HistoryScreen } from '../../../src/features/history';

export default function GoalHistoryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <HistoryScreen goalId={id} />;
}
