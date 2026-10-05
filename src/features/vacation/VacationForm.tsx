import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useDb } from '../../db/DbProvider';
import { createVacation, updateVacation } from '../../db/repositories';
import { useLiveGoals } from '../../db/live';
import { strings } from '../../strings/en';
import { AppText, Button, Card, Chip, GoalIcon, Icon, IconButton, Screen } from '../../ui/components';
import { uiIcons } from '../../ui/icons';
import { useTheme } from '../../ui/ThemeProvider';
import { minTapTarget, radii, spacing, typography } from '../../ui/tokens';
import { NOTE_MAX_LENGTH } from '../../domain/limits';
import { Field } from '../goals/form/Field';
import { haptic } from '../tracking/haptics';
import { useLogicalToday } from '../tracking/useLogicalToday';
import { validateVacation, vacationInput, type VacationFormValues } from './vacationForm';

const s = strings.vacationMode;

type Props = {
  initial: VacationFormValues;
  /** Present when editing an existing vacation. */
  vacationId?: string;
  onSaved: () => void;
  onCancel: () => void;
};

export function VacationForm({ initial, vacationId, onSaved, onCancel }: Props) {
  const { colors } = useTheme();
  const db = useDb();
  const { today } = useLogicalToday();
  const editing = vacationId !== undefined;
  const { data } = useLiveGoals();
  const goals = useMemo(() => data.filter((g) => g.archivedAt == null), [data]);
  const [values, setValues] = useState<VacationFormValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const patch = (p: Partial<VacationFormValues>) => setValues((v) => ({ ...v, ...p }));
  const toggleGoal = (id: string) =>
    patch({ goalIds: values.goalIds.includes(id) ? values.goalIds.filter((x) => x !== id) : [...values.goalIds, id] });

  const submit = async () => {
    const problem = validateVacation(values, today, editing ? initial.startDate : undefined);
    if (problem) {
      setError(s[problem]);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const input = vacationInput(values);
      if (vacationId) await updateVacation(db, vacationId, input);
      else await createVacation(db, input);
      haptic('success');
      onSaved();
    } catch {
      setError(s.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll={false} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <IconButton icon={uiIcons.back} accessibilityLabel={s.back} onPress={onCancel} />
        <AppText variant="title" accessibilityRole="header">
          {editing ? s.editTitle : s.newTitle}
        </AppText>
      </View>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <Field label={s.startLabel} value={values.startDate} onChangeText={(startDate) => patch({ startDate })} placeholder={s.datePlaceholder} keyboardType="numbers-and-punctuation" maxLength={10} />
          <Field label={s.endLabel} value={values.endDate} onChangeText={(endDate) => patch({ endDate })} placeholder={s.datePlaceholder} keyboardType="numbers-and-punctuation" maxLength={10} />
        </Card>
        <AppText variant="label" tone="secondary">
          {s.scopeLabel}
        </AppText>
        <View style={styles.wrap}>
          <Chip label={s.scopeAllChip} selected={values.scope === 'all'} onPress={() => patch({ scope: 'all' })} />
          <Chip label={s.scopeSelectedChip} selected={values.scope === 'selected'} onPress={() => patch({ scope: 'selected' })} />
        </View>
        {values.scope === 'selected' ? (
          goals.length === 0 ? (
            <AppText tone="secondary">{s.noGoals}</AppText>
          ) : (
            goals.map((g) => {
              const checked = values.goalIds.includes(g.id);
              return (
                <Pressable
                  key={g.id}
                  accessibilityRole="checkbox"
                  accessibilityLabel={s.goalRow(g.name)}
                  accessibilityState={{ checked }}
                  onPress={() => toggleGoal(g.id)}
                  style={[styles.goalRow, { backgroundColor: colors.surface, borderColor: checked ? colors.accent : colors.border }]}
                >
                  <GoalIcon icon={g.icon as never} color={g.color} size={32} />
                  <AppText style={styles.flex} numberOfLines={1}>
                    {g.name}
                  </AppText>
                  <Icon name={checked ? 'checkbox' : 'square-outline'} size={24} color={checked ? colors.accent : colors.textSecondary} />
                </Pressable>
              );
            })
          )
        ) : null}
        <TextInput
          accessibilityLabel={s.noteLabel}
          placeholder={s.notePlaceholder}
          placeholderTextColor={colors.textSecondary}
          value={values.note}
          onChangeText={(note) => patch({ note })}
          maxLength={NOTE_MAX_LENGTH}
          multiline
          style={[styles.note, typography.body, { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border }]}
        />
      </ScrollView>
      <View style={styles.footer}>
        {error ? (
          <AppText variant="caption" color={colors.status.missed} accessibilityRole="alert">
            {error}
          </AppText>
        ) : null}
        <Button label={s.save} onPress={submit} disabled={saving} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  content: { gap: spacing.md, paddingBottom: spacing.md },
  card: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  note: { minHeight: 96, borderRadius: radii.md, borderWidth: 1, padding: spacing.md, textAlignVertical: 'top' },
  goalRow: { minHeight: minTapTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radii.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  footer: { gap: spacing.sm, minHeight: minTapTarget },
});
