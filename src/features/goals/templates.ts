import { strings } from '../../strings/en';
import type { FormState } from './goalFormSchema';

export type TemplateKey = 'water' | 'workout' | 'reading' | 'meditation';

export const templateKeys: readonly TemplateKey[] = ['water', 'workout', 'reading', 'meditation'];

const f = strings.goalForm;

/** Form fields each template fills in. */
export const goalTemplates: Record<TemplateKey, Partial<FormState>> = {
  water: { name: f.templateNames.water, icon: 'water', trackingType: 'count', targetValue: '8', unit: f.templateUnits.glasses, scheduleType: 'daily' },
  workout: { name: f.templateNames.workout, icon: 'barbell', trackingType: 'check', targetValue: '1', unit: '', scheduleType: 'customDays', days: [0, 2, 4] },
  reading: { name: f.templateNames.reading, icon: 'book', trackingType: 'duration', targetValue: '20', unit: f.templateUnits.minutes, scheduleType: 'daily' },
  meditation: { name: f.templateNames.meditation, icon: 'flower', trackingType: 'duration', targetValue: '10', unit: f.templateUnits.minutes, scheduleType: 'daily' },
};
