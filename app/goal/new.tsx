import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { GoalForm } from '../../src/features/goals/GoalForm';
import { defaultGoalForm } from '../../src/features/goals/goalFormSchema';
import { goalTemplates, templateKeys, type TemplateKey } from '../../src/features/goals/templates';
import { useSettings } from '../../src/features/settings/settingsStore';

export default function NewGoalScreen() {
  const router = useRouter();
  const { template } = useLocalSearchParams<{ template?: string }>();
  const accent = useSettings((s) => s.settings.accentColor);
  const initial = useMemo(() => {
    const base = defaultGoalForm(accent);
    const key = templateKeys.find((k) => k === template) as TemplateKey | undefined;
    return key ? { ...base, ...goalTemplates[key] } : base;
  }, [accent, template]);
  return <GoalForm initial={initial} onSaved={() => router.back()} onCancel={() => router.back()} />;
}
