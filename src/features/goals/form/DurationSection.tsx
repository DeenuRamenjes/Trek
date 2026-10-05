import { StyleSheet, View } from 'react-native';
import { strings } from '../../../strings/en';
import { Chip } from '../../../ui/components';
import { spacing } from '../../../ui/tokens';
import { durationModes, isValidDate } from '../goalFormSchema';
import { Field, Stepper } from './Field';
import { SectionCard } from './SectionCard';
import type { SectionProps } from './types';

const f = strings.goalForm;

export function durationSummary(v: SectionProps['values']): string {
  if (v.durationMode === 'endDate') return v.endDate === '' ? f.durationModes.endDate : f.durationEndSummary(v.endDate);
  if (v.durationMode === 'targetDays') return f.durationDaysSummary(Number(v.targetDays) || 1);
  return f.durationSummary;
}

export function DurationSection({ values, set, open, onToggle }: SectionProps) {
  return (
    <SectionCard title={f.sections.duration} summary={durationSummary(values)} open={open} onToggle={onToggle}>
      <View style={styles.wrap}>
        {durationModes.map((mode) => (
          <Chip key={mode} label={f.durationModes[mode]} selected={values.durationMode === mode} onPress={() => set('durationMode', mode)} />
        ))}
      </View>
      {values.durationMode === 'endDate' ? (
        <Field
          label={f.endDateLabel}
          value={values.endDate}
          onChangeText={(t) => set('endDate', t)}
          placeholder="YYYY-MM-DD"
          keyboardType="numbers-and-punctuation"
          invalid={values.endDate !== '' && !isValidDate(values.endDate)}
          maxLength={10}
        />
      ) : null}
      {values.durationMode === 'targetDays' ? (
        <Stepper label={f.targetDaysLabel} value={Number(values.targetDays) || 1} min={1} max={3650} step={1} onChange={(n) => set('targetDays', String(n))} />
      ) : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
