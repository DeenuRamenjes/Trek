import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { strings } from '../../../strings/en';
import { AppText, Button, Chip, IconButton } from '../../../ui/components';
import { spacing } from '../../../ui/tokens';
import { SectionCard } from './SectionCard';
import { Field, TimeField } from './Field';
import type { SectionProps } from './types';

const f = strings.goalForm;

export function timesSummary(slots: SectionProps['values']['slots']): string {
  return slots.length === 0 ? f.noTimes : f.timesSummary(slots.length);
}

/** Slots per weekday: pick a weekday, then edit its times. */
export function TimesSection({ values, set, open, onToggle }: SectionProps) {
  const [day, setDay] = useState(0);
  const indexed = values.slots.map((slot, index) => ({ slot, index }));
  const daySlots = indexed.filter((x) => x.slot.weekday === day);

  const patch = (index: number, change: Partial<(typeof values.slots)[number]>) =>
    set('slots', values.slots.map((s, i) => (i === index ? { ...s, ...change } : s)));
  const add = () => set('slots', [...values.slots, { weekday: day, time: '09:00', label: '' }]);
  const remove = (index: number) => set('slots', values.slots.filter((_, i) => i !== index));
  const copyToAll = () => {
    const mine = values.slots.filter((s) => s.weekday === day);
    set('slots', [0, 1, 2, 3, 4, 5, 6].flatMap((d) => mine.map((s) => ({ ...s, weekday: d }))));
  };

  return (
    <SectionCard title={f.sections.times} summary={timesSummary(values.slots)} open={open} onToggle={onToggle}>
      <View style={styles.wrap}>
        {f.weekdaysShort.map((name, d) => (
          <Chip
            key={name}
            label={name}
            selected={d === day}
            onPress={() => setDay(d)}
            accessibilityLabel={f.slotsFor(name)}
          />
        ))}
      </View>
      {daySlots.map(({ slot, index }) => (
        <View key={index} style={styles.slot}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <TimeField label={`${f.timeLabel} ${f.weekdaysShort[day]} ${index + 1}`} value={slot.time} onChange={(time) => patch(index, { time })} />
            </View>
            <IconButton icon="close" accessibilityLabel={f.removeTime(slot.time)} onPress={() => remove(index)} />
          </View>
          <Field
            label={`${f.slotLabelField} ${index + 1}`}
            value={slot.label}
            onChangeText={(label) => patch(index, { label })}
            placeholder={f.slotLabelPlaceholder}
            maxLength={60}
          />
        </View>
      ))}
      {daySlots.length === 0 ? (
        <AppText variant="caption" tone="secondary">
          {f.noTimes}
        </AppText>
      ) : null}
      <View style={styles.wrap}>
        <Button label={f.addTime} variant="secondary" icon="add" onPress={add} />
        {daySlots.length > 0 ? <Button label={f.sameOnAllDays} variant="plain" onPress={copyToAll} /> : null}
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  slot: { gap: spacing.sm },
});
