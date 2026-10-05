import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Goal } from '../../db/schema';
import type { VacationWithGoals } from '../../db/repositories/vacations';
import { strings } from '../../strings/en';
import { AppText, Button, Card, Icon } from '../../ui/components';
import { useTheme } from '../../ui/ThemeProvider';
import { spacing } from '../../ui/tokens';
import { vacationPhase } from './vacationForm';

const s = strings.vacationMode;

type Props = {
  vacations: VacationWithGoals[];
  goals: Goal[];
  today: string;
  onEdit: (v: VacationWithGoals) => void;
  onEndNow: (v: VacationWithGoals) => void;
  onDelete: (v: VacationWithGoals) => void;
};

function scopeSummary(v: VacationWithGoals, goals: Goal[]): string {
  if (v.scope === 'all') return s.scopeAll;
  const names = goals.filter((g) => v.goalIds.includes(g.id)).map((g) => g.name);
  return names.length === 0 ? s.scopeNone : s.scopeSelected(names.join(', '));
}

function Row({ v, goals, today, onEdit, onEndNow, onDelete }: { v: VacationWithGoals } & Omit<Props, 'vacations'>) {
  const { colors } = useTheme();
  const [confirming, setConfirming] = useState(false);
  const phase = vacationPhase(v, today);
  const range = s.range(v.startDate, v.endDate);
  const badge = { active: s.badgeActive, upcoming: s.badgeUpcoming, past: s.badgePast }[phase];
  return (
    <Card style={styles.card}>
      <View style={styles.titleRow}>
        <Icon name="airplane" size={20} color={colors.status.vacation} />
        <AppText variant="headline" style={styles.flex}>
          {range}
        </AppText>
        <AppText variant="caption" tone="secondary">
          {badge}
        </AppText>
      </View>
      <AppText tone="secondary">{scopeSummary(v, goals)}</AppText>
      {v.note ? <AppText>{v.note}</AppText> : null}
      {confirming ? (
        <View style={styles.actions}>
          <AppText variant="headline">{s.confirmDeleteTitle}</AppText>
          <AppText tone="secondary">{s.confirmDeleteBody}</AppText>
          <Button label={s.confirmDelete} onPress={() => onDelete(v)} />
          <Button label={s.cancel} variant="secondary" onPress={() => setConfirming(false)} />
        </View>
      ) : (
        <View style={styles.actions}>
          {phase !== 'past' ? <Button label={s.editLabel} accessibilityLabel={s.edit(range)} variant="secondary" icon="create-outline" onPress={() => onEdit(v)} /> : null}
          {phase === 'active' ? <Button label={s.endNowLabel} accessibilityLabel={s.endNow(range)} variant="secondary" icon="stop-circle-outline" onPress={() => onEndNow(v)} /> : null}
          <Button label={s.deleteLabel} accessibilityLabel={s.deleteAction(range)} variant="plain" icon="trash-outline" onPress={() => setConfirming(true)} />
        </View>
      )}
    </Card>
  );
}

export function VacationList({ vacations, goals, today, onEdit, onEndNow, onDelete }: Props) {
  const { colors } = useTheme();
  if (vacations.length === 0) {
    return (
      <View style={styles.empty}>
        <Icon name="airplane" size={40} color={colors.textSecondary} />
        <AppText variant="title" accessibilityRole="header">
          {s.emptyTitle}
        </AppText>
        <AppText tone="secondary">{s.emptyBody}</AppText>
      </View>
    );
  }
  const current = vacations.filter((v) => vacationPhase(v, today) !== 'past').sort((a, b) => a.startDate.localeCompare(b.startDate));
  const past = vacations.filter((v) => vacationPhase(v, today) === 'past').sort((a, b) => b.startDate.localeCompare(a.startDate));
  const render = (list: VacationWithGoals[]) =>
    list.map((v) => <Row key={v.id} v={v} goals={goals} today={today} onEdit={onEdit} onEndNow={onEndNow} onDelete={onDelete} />);
  return (
    <View style={styles.list}>
      {current.length > 0 ? (
        <>
          <AppText variant="label" tone="secondary">
            {s.activeSection}
          </AppText>
          {render(current)}
        </>
      ) : null}
      {past.length > 0 ? (
        <>
          <AppText variant="label" tone="secondary">
            {s.pastSection}
          </AppText>
          {render(past)}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: spacing.md },
  card: { gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { gap: spacing.sm },
  empty: { gap: spacing.sm, alignItems: 'center', paddingVertical: spacing.xl },
});
