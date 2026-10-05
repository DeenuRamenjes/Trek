import { GoalsList } from '../../src/features/goals/GoalsList';
import { Screen } from '../../src/ui/components';

export default function GoalsScreen() {
  return (
    <Screen edges={['top', 'left', 'right']}>
      <GoalsList />
    </Screen>
  );
}
