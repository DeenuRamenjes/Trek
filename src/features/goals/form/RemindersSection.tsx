import { StyleSheet, View } from 'react-native';
import { strings } from '../../../strings/en';
import { AppText, Chip } from '../../../ui/components';
import { spacing } from '../../../ui/tokens';
import { Stepper, TimeField } from './Field';
import { SectionCard } from './SectionCard';
import type { SectionProps } from './types';

const f = strings.goalForm;

export function remindersSummary(v: SectionProps['values']): string {
  if (!v.reminderEnabled) return f.remindersSummary;
  const days = v.reminderWeekdays.length;
  return v.slots.length > 0 ? f.remindersSummarySlots(days) : f.remindersSummaryOn(days, v.reminderTime);
}

export function RemindersSection({ values, set, open, onToggle }: SectionProps) {
  const toggleDay = (d: number) =>
    set('reminderWeekdays', values.reminderWeekdays.includes(d) ? values.reminderWeekdays.filter((x) => x !== d) : [...values.reminderWeekdays, d]);
  return (
    <SectionCard title={f.sections.reminders} summary={remindersSummary(values)} open={open} onToggle={onToggle}>
      <View style={styles.wrap}>
        <Chip label={f.remindMe} selected={values.reminderEnabled} onPress={() => set('reminderEnabled', !values.reminderEnabled)} />
      </View>
      {values.reminderEnabled ? (
        <>
          <AppText variant="label" tone="secondary">
            {f.reminderDays}
          </AppText>
          <View style={styles.wrap}>
            {f.weekdaysShort.map((day, d) => (
              <Chip key={day} label={day} selected={values.reminderWeekdays.includes(d)} onPress={() => toggleDay(d)} accessibilityLabel={`${f.reminderDays}: ${day}`} />
            ))}
          </View>
          {values.slots.length > 0 ? (
            <AppText variant="caption" tone="secondary">
              {f.followsSlots}
            </AppText>
          ) : null}
          <TimeField label={f.reminderTime} value={values.reminderTime} onChange={(t) => set('reminderTime', t)} />
          <Stepper label={f.minutesBefore} value={values.minutesBefore} min={0} max={120} step={5} onChange={(n) => set('minutesBefore', n)} />
        </>
      ) : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
