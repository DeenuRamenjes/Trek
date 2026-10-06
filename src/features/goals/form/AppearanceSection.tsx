import { strings } from '../../../strings/en';
import { AppText, ColorPicker, IconPicker } from '../../../ui/components';
import { SectionCard } from './SectionCard';
import type { SectionProps } from './types';

const f = strings.goalForm;

export function AppearanceSection({ values, set, open, onToggle }: SectionProps) {
  return (
    <SectionCard title={f.sections.appearance} summary={f.appearanceSummary} open={open} onToggle={onToggle}>
      <AppText variant="label" tone="secondary">
        {f.colorLabel}
      </AppText>
      <ColorPicker value={values.color} onChange={(hex) => set('color', hex)} />
      <AppText variant="label" tone="secondary">
        {f.iconLabel}
      </AppText>
      <IconPicker value={values.icon} onChange={(icon) => set('icon', icon)} />
    </SectionCard>
  );
}
