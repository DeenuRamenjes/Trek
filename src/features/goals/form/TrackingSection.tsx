import { StyleSheet, View } from 'react-native';
import { strings } from '../../../strings/en';
import { AppText, Chip } from '../../../ui/components';
import { spacing } from '../../../ui/tokens';
import { trackingTypes } from '../goalFormSchema';
import { Field } from './Field';
import { SectionCard } from './SectionCard';
import type { SectionProps } from './types';

const f = strings.goalForm;

export function trackingSummary(v: SectionProps['values']): string {
  return v.trackingType === 'check' ? f.trackingSummary : f.trackingSummaryWith(f.trackingTypes[v.trackingType], v.targetValue, v.unit);
}

export function TrackingSection({ values, set, open, onToggle }: SectionProps) {
  const choose = (type: (typeof trackingTypes)[number]) => {
    set('trackingType', type);
    if (type === 'duration' && values.unit === '') set('unit', strings.goalForm.templateUnits.minutes);
  };
  return (
    <SectionCard title={f.sections.tracking} summary={trackingSummary(values)} open={open} onToggle={onToggle}>
      <View style={styles.wrap}>
        {trackingTypes.map((type) => (
          <Chip key={type} label={f.trackingTypes[type]} selected={values.trackingType === type} onPress={() => choose(type)} />
        ))}
      </View>
      {values.trackingType !== 'check' ? (
        <>
          <AppText variant="label" tone="secondary">
            {f.targetLabel}
          </AppText>
          <Field label={f.targetLabel} value={values.targetValue} onChangeText={(t) => set('targetValue', t)} keyboardType="decimal-pad" />
          <AppText variant="label" tone="secondary">
            {f.unitLabel}
          </AppText>
          <Field label={f.unitLabel} value={values.unit} onChangeText={(t) => set('unit', t)} placeholder={f.unitPlaceholder} maxLength={24} />
        </>
      ) : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
