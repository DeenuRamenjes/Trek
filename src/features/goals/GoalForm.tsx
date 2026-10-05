import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useDb } from '../../db/DbProvider';
import { strings } from '../../strings/en';
import { AppText, Button, Chip, IconButton, Screen } from '../../ui/components';
import { uiIcons } from '../../ui/icons';
import { useTheme } from '../../ui/ThemeProvider';
import { minTapTarget, radii, spacing, typography } from '../../ui/tokens';
import { haptic } from '../tracking/haptics';
import { useLogicalToday } from '../tracking/useLogicalToday';
import { AppearanceSection } from './form/AppearanceSection';
import { DurationSection } from './form/DurationSection';
import { RemindersSection } from './form/RemindersSection';
import { ScheduleSection } from './form/ScheduleSection';
import { TimesSection } from './form/TimesSection';
import { TrackingSection } from './form/TrackingSection';
import type { SetField } from './form/types';
import { goalFormSchema, type FormState } from './goalFormSchema';
import { saveGoal } from './saveGoal';
import { goalTemplates, templateKeys, type TemplateKey } from './templates';

type SectionKey = 'schedule' | 'times' | 'tracking' | 'duration' | 'reminders' | 'appearance';

type Props = {
  initial: FormState;
  /** Present when editing an existing goal. */
  goalId?: string;
  onSaved: (goalId: string) => void;
  onCancel: () => void;
};

const f = strings.goalForm;

export function GoalForm({ initial, goalId, onSaved, onCancel }: Props) {
  const { colors } = useTheme();
  const db = useDb();
  const { today } = useLogicalToday();
  const editing = goalId !== undefined;
  const form = useForm<FormState>({ defaultValues: initial });
  const values = form.watch();
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    schedule: false,
    times: false,
    tracking: false,
    duration: false,
    reminders: false,
    appearance: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set: SetField = (key, value) => form.setValue(key, value as never, { shouldDirty: true });
  const toggle = (key: SectionKey) => setOpen((o) => ({ ...o, [key]: !o[key] }));
  const section = (key: SectionKey) => ({ values, set, open: open[key], onToggle: () => toggle(key) });

  const applyTemplate = (key: TemplateKey) => {
    for (const [field, value] of Object.entries(goalTemplates[key])) {
      form.setValue(field as keyof FormState, value as never, { shouldDirty: true });
    }
    haptic('tap');
  };

  const canSave = values.name.trim().length > 0 && !saving;

  const submit = async () => {
    const parsed = goalFormSchema.safeParse(form.getValues());
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? f.errors.saveFailed);
      haptic('warning');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const id = await saveGoal(db, goalId ?? null, form.getValues(), today);
      haptic('success');
      onSaved(id);
    } catch {
      setError(f.errors.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll={false} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <IconButton icon={uiIcons.back} accessibilityLabel={f.back} onPress={onCancel} />
        <AppText variant="title" accessibilityRole="header">
          {editing ? f.editTitle : f.newTitle}
        </AppText>
      </View>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput
          accessibilityLabel={f.nameLabel}
          placeholder={f.namePlaceholder}
          placeholderTextColor={colors.textSecondary}
          value={values.name}
          onChangeText={(t) => set('name', t)}
          autoFocus={!editing}
          maxLength={80}
          style={[styles.input, typography.headline, { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border }]}
        />
        {editing ? null : (
          <>
            <AppText variant="label" tone="secondary">
              {f.templates}
            </AppText>
            <View style={styles.wrap}>
              {templateKeys.map((key) => (
                <Chip key={key} label={f.templateNames[key]} accessibilityLabel={f.useTemplate(f.templateNames[key])} onPress={() => applyTemplate(key)} />
              ))}
            </View>
          </>
        )}
        <ScheduleSection {...section('schedule')} editing={editing} />
        <TimesSection {...section('times')} />
        <TrackingSection {...section('tracking')} />
        <DurationSection {...section('duration')} />
        <RemindersSection {...section('reminders')} />
        <AppearanceSection {...section('appearance')} />
      </ScrollView>
      <View style={styles.footer}>
        {error ? (
          <AppText variant="caption" color={colors.status.missed} accessibilityRole="alert">
            {error}
          </AppText>
        ) : null}
        <Button label={editing ? f.saveEdit : f.save} onPress={submit} disabled={!canSave} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  content: { gap: spacing.md, paddingBottom: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  input: { minHeight: 52, borderRadius: radii.md, borderWidth: 1, paddingHorizontal: spacing.md },
  footer: { gap: spacing.sm, minHeight: minTapTarget },
});
