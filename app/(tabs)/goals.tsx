import { GoalsList } from '../../src/features/goals/GoalsList';
import { Screen } from '../../src/ui/components';

export default function GoalsScreen() {
  return (
    <Screen scroll={false} edges={['top', 'left', 'right']}>
      <GoalsList />
    </Screen>
  );
}
