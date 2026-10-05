import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { GoalForm } from '../../src/features/goals/GoalForm';
import { defaultGoalForm } from '../../src/features/goals/goalFormSchema';
import { useSettings } from '../../src/features/settings/settingsStore';

export default function NewGoalScreen() {
  const router = useRouter();
  const accent = useSettings((s) => s.settings.accentColor);
  const initial = useMemo(() => defaultGoalForm(accent), [accent]);
  return <GoalForm initial={initial} onSaved={() => router.back()} onCancel={() => router.back()} />;
}
