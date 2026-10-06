import { format } from 'date-fns';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { parseDate } from '../../domain/dates';
import { NOTE_MAX_LENGTH } from '../../domain/limits';
import type { Goal, Slot } from '../../domain/types';
import { strings } from '../../strings/en';
import { AppText, Button, Chip, IconButton } from '../../ui/components';
import { uiIcons } from '../../ui/icons';
import { useTheme } from '../../ui/ThemeProvider';
import { radii, spacing, typography } from '../../ui/tokens';
import { DURATION_STEP } from '../tracking/useCheckOff';
import { GestureSheet } from './GestureSheet';
import { derivedStatus, slotStatus, valueForStatus, type EditState, type EditStatus } from './dayEdit';

const h = strings.history;
const STATUSES: EditStatus[] = ['done', 'partial', 'skipped'];

type Props = {
  goal: Goal;
  date: string;
  slots: Slot[];
  initial: EditState;
  onSave: (state: EditState) => void;
  onClear: () => void;
  onClose: () => void;
};

/** Past or current day editor: status, value stepper, note with live counter, Clear. */
export function DayEditorSheet({ goal, date, slots, initial, onSave, onClear, onClose }: Props) {
  const { colors } = useTheme();
  const [state, setState] = useState<EditState>(initial);
  const slotted = slots.length > 0;
  const isCheck = goal.trackingType === 'check';
  const step = goal.trackingType === 'duration' ? DURATION_STEP : 1;

  const pickStatus = (status: EditStatus) =>
    setState((s) => ({ ...s, status, value: valueForStatus(goal, status, s.value) }));
  const stepValue = (delta: number) =>
    setState((s) => {
      const value = Math.max(0, Math.round((s.value + delta) * 100) / 100);
      return { ...s, value, status: s.status === 'skipped' ? 'skipped' : derivedStatus(goal, value) };
    });
  const toggleSlot = (id: string) =>
    setState((s) => {
      const slotDone = s.slotDone.includes(id) ? s.slotDone.filter((x) => x !== id) : [...s.slotDone, id];
      return { ...s, slotDone, status: slotStatus(slots.length, slotDone.length) };
    });

  return (
    <GestureSheet title={h.sheetTitle(format(parseDate(date), 'EEEE d MMMM'))} onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <AppText variant="label" tone="secondary">
          {slotted ? h.slotsLabel : h.statusLabel}
        </AppText>
        <View style={styles.wrap}>
          {slotted
            ? slots.map((slot) => (
                <Chip key={slot.id} label={slot.label ? `${slot.time} ${slot.label}` : slot.time} selected={state.slotDone.includes(slot.id)} onPress={() => toggleSlot(slot.id)} />
              ))
            : null}
          {(slotted ? (['skipped'] as EditStatus[]) : STATUSES).map((st) => (
            <Chip
              key={st}
              label={strings.status[st]}
              selected={state.status === st}
              onPress={() => (slotted ? setState((s) => ({ ...s, status: s.status === 'skipped' ? slotStatus(slots.length, s.slotDone.length) : 'skipped' })) : pickStatus(st))}
            />
          ))}
        </View>
        {isCheck ? null : (
          <>
            <AppText variant="label" tone="secondary">
              {h.value}
            </AppText>
            <View style={styles.stepper}>
              <IconButton icon={uiIcons.remove} accessibilityLabel={h.decrease} filled onPress={() => stepValue(-step)} />
              <AppText variant="headline" accessibilityLabel={`${h.value} ${state.value}`}>
                {String(state.value)}
              </AppText>
              <IconButton icon={uiIcons.add} accessibilityLabel={h.increaseValue} filled onPress={() => stepValue(step)} />
            </View>
          </>
        )}
        <TextInput
          accessibilityLabel={h.note}
          placeholder={h.notePlaceholder}
          placeholderTextColor={colors.textSecondary}
          value={state.note}
          onChangeText={(note) => setState((s) => ({ ...s, note }))}
          maxLength={NOTE_MAX_LENGTH}
          multiline
          style={[styles.note, typography.body, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
        />
        <AppText variant="caption" tone="secondary">
          {h.noteCount(state.note.length)}
        </AppText>
        <View style={styles.actions}>
          <Button label={h.clear} variant="secondary" onPress={onClear} />
          <Button label={h.save} disabled={state.status === null} onPress={() => onSave(state)} />
        </View>
      </ScrollView>
    </GestureSheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  note: { minHeight: 88, borderWidth: 1, borderRadius: radii.md, padding: spacing.sm, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
});
