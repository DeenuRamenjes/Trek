import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Pressable } from 'react-native';
import { useDb } from '../../db/DbProvider';
import { useLiveGoals } from '../../db/live';
import { strings } from '../../strings/en';
import { AppText, Button, Card, ColorPicker, GoalIcon, Icon, IconButton, IconPicker, Screen } from '../../ui/components';
import { uiIcons } from '../../ui/icons';
import { useTheme } from '../../ui/ThemeProvider';
import { minTapTarget, radii, spacing, typography } from '../../ui/tokens';
import { DEFAULT_GOAL_COLOR, DEFAULT_GOAL_ICON } from '../goals/goalFormSchema';
import { haptic } from '../tracking/haptics';
import { removeGroup, saveGroup, type GroupFormValues } from './saveGroup';

const s = strings.groups;

export const emptyGroupForm: GroupFormValues = { name: '', color: DEFAULT_GOAL_COLOR, icon: DEFAULT_GOAL_ICON, goalIds: [] };

type Props = {
  initial: GroupFormValues;
  /** Present when editing an existing group. */
  groupId?: string;
  onSaved: () => void;
  onCancel: () => void;
};

export function GroupForm({ initial, groupId, onSaved, onCancel }: Props) {
  const { colors } = useTheme();
  const db = useDb();
  const editing = groupId !== undefined;
  const { data } = useLiveGoals();
  const goals = useMemo(() => data.filter((g) => g.archivedAt == null), [data]);
  const [values, setValues] = useState<GroupFormValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const patch = (p: Partial<GroupFormValues>) => setValues((v) => ({ ...v, ...p }));
  const toggleGoal = (id: string) =>
    patch({ goalIds: values.goalIds.includes(id) ? values.goalIds.filter((x) => x !== id) : [...values.goalIds, id] });

  const canSave = values.name.trim().length > 0 && !saving;

  const submit = async () => {
    if (values.name.trim() === '') {
      setError(s.nameRequired);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await saveGroup(db, groupId ?? null, values);
      haptic('success');
      onSaved();
    } catch {
      setError(s.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!groupId) return;
    await removeGroup(db, groupId);
    onSaved();
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
        <TextInput
          accessibilityLabel={s.nameLabel}
          placeholder={s.namePlaceholder}
          placeholderTextColor={colors.textSecondary}
          value={values.name}
          onChangeText={(name) => patch({ name })}
          autoFocus={!editing}
          maxLength={80}
          style={[styles.input, typography.headline, { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border }]}
        />
        <Card style={styles.card}>
          <AppText variant="label" tone="secondary">
            {s.colorLabel}
          </AppText>
          <ColorPicker value={values.color} onChange={(color) => patch({ color })} />
          <AppText variant="label" tone="secondary">
            {s.iconLabel}
          </AppText>
          <IconPicker value={values.icon} onChange={(icon) => patch({ icon })} />
        </Card>
        <AppText variant="label" tone="secondary">
          {s.goalsLabel}
        </AppText>
        {goals.length === 0 ? (
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
        )}
        {editing ? (
          confirming ? (
            <Card style={styles.card}>
              <AppText variant="headline">{s.confirmDeleteTitle(values.name)}</AppText>
              <AppText tone="secondary">{s.confirmDeleteBody}</AppText>
              <Button label={s.confirmDelete} onPress={confirmDelete} />
              <Button label={s.cancel} variant="secondary" onPress={() => setConfirming(false)} />
            </Card>
          ) : (
            <Button label={s.delete} variant="secondary" icon="trash-outline" onPress={() => setConfirming(true)} />
          )
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        {error ? (
          <AppText variant="caption" color={colors.status.missed} accessibilityRole="alert">
            {error}
          </AppText>
        ) : null}
        <Button label={s.save} onPress={submit} disabled={!canSave} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  content: { gap: spacing.md, paddingBottom: spacing.md },
  card: { gap: spacing.sm },
  input: { minHeight: 56, borderRadius: radii.md, borderWidth: 1, paddingHorizontal: spacing.md },
  goalRow: { minHeight: minTapTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radii.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  footer: { gap: spacing.sm, minHeight: minTapTarget },
});
