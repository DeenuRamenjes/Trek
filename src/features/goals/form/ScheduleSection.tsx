import { StyleSheet, View } from 'react-native';
import { strings } from '../../../strings/en';
import { AppText, Chip } from '../../../ui/components';
import { spacing } from '../../../ui/tokens';
import { scheduleTypes } from '../goalFormSchema';
import { SectionCard } from './SectionCard';
import { Stepper } from './Field';
import type { SectionProps } from './types';

const f = strings.goalForm;

export function scheduleSummary(v: SectionProps['values']): string {
  switch (v.scheduleType) {
    case 'customDays':
      return v.days.length === 0 ? f.daysRequired : [...v.days].sort().map((d) => f.weekdaysShort[d]).join(', ');
    case 'everyNDays':
      return f.scheduleSummary.everyNDays(Number(v.everyNDays) || 1);
    case 'timesPerWeek':
      return f.scheduleSummary.timesPerWeek(Number(v.timesPerWeek) || 1);
    default:
      return f.scheduleTypes[v.scheduleType];
  }
}

type Props = SectionProps & { editing: boolean };

export function ScheduleSection({ values, set, open, onToggle, editing }: Props) {
  const toggleDay = (d: number) => set('days', values.days.includes(d) ? values.days.filter((x) => x !== d) : [...values.days, d]);
  return (
    <SectionCard title={f.sections.schedule} summary={scheduleSummary(values)} open={open} onToggle={onToggle}>
      <View style={styles.wrap}>
        {scheduleTypes.map((type) => (
          <Chip key={type} label={f.scheduleTypes[type]} selected={values.scheduleType === type} onPress={() => set('scheduleType', type)} />
        ))}
      </View>
      {values.scheduleType === 'customDays' ? (
        <View style={styles.wrap}>
          {f.weekdaysShort.map((day, d) => (
            <Chip key={day} label={day} selected={values.days.includes(d)} onPress={() => toggleDay(d)} accessibilityLabel={f.weekdayToggle(day)} />
          ))}
        </View>
      ) : null}
      {values.scheduleType === 'everyNDays' ? (
        <Stepper label={f.everyNLabel} value={Number(values.everyNDays) || 1} min={1} max={365} onChange={(n) => set('everyNDays', String(n))} />
      ) : null}
      {values.scheduleType === 'timesPerWeek' ? (
        <Stepper label={f.timesPerWeekLabel} value={Number(values.timesPerWeek) || 1} min={1} max={7} onChange={(n) => set('timesPerWeek', String(n))} />
      ) : null}
      {editing ? (
        <AppText variant="caption" tone="secondary">
          {f.scheduleNote}
        </AppText>
      ) : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
