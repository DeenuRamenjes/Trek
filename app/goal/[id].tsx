import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useDb } from '../../src/db/DbProvider';
import { GoalForm } from '../../src/features/goals/GoalForm';
import type { FormState } from '../../src/features/goals/goalFormSchema';
import { loadGoalFormValues } from '../../src/features/goals/saveGoal';
import { useLogicalToday } from '../../src/features/tracking/useLogicalToday';

export default function EditGoalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDb();
  const { today } = useLogicalToday();
  const [initial, setInitial] = useState<FormState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadGoalFormValues(db, id, today).then((values) => {
      if (cancelled) return;
      if (values) setInitial(values);
      else router.back();
    });
    return () => {
      cancelled = true;
    };
    // Load once per goal; later edits come from the form itself.
  }, [db, id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!initial) return null;
  return <GoalForm initial={initial} goalId={id} onSaved={() => router.back()} onCancel={() => router.back()} />;
}
