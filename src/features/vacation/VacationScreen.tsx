import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDb } from '../../db/DbProvider';
import { useLiveGoals, useLiveVacations } from '../../db/live';
import { deleteVacation, endVacationNow, listVacations, type VacationWithGoals } from '../../db/repositories';
import { strings } from '../../strings/en';
import { AppText, Button, IconButton, Screen } from '../../ui/components';
import { uiIcons } from '../../ui/icons';
import { spacing } from '../../ui/tokens';
import { useLogicalToday } from '../tracking/useLogicalToday';
import { VacationForm } from './VacationForm';
import { VacationList } from './VacationList';
import { emptyVacationForm, vacationToForm, type VacationFormValues } from './vacationForm';

const s = strings.vacationMode;

type Mode = { kind: 'list' } | { kind: 'form'; id?: string; initial: VacationFormValues };

export function VacationScreen() {
  const router = useRouter();
  const db = useDb();
  const { today } = useLogicalToday();
  const { data: rows } = useLiveVacations();
  const { data: goals } = useLiveGoals();
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [links, setLinks] = useState<VacationWithGoals[] | null>(null);

  // Live rows lack goal ids; load the joined list whenever they change.
  useEffect(() => {
    let alive = true;
    void listVacations(db).then((l) => alive && setLinks(l));
    return () => {
      alive = false;
    };
  }, [db, rows]);

  if (mode.kind === 'form') {
    return (
      <VacationForm
        initial={mode.initial}
        vacationId={mode.id}
        onSaved={() => setMode({ kind: 'list' })}
        onCancel={() => setMode({ kind: 'list' })}
      />
    );
  }
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <IconButton icon={uiIcons.back} accessibilityLabel={s.back} onPress={() => router.back()} />
        <AppText variant="title" accessibilityRole="header" style={styles.flex}>
          {s.title}
        </AppText>
      </View>
      <Button label={s.newVacation} icon="add" onPress={() => setMode({ kind: 'form', initial: emptyVacationForm(today) })} />
      <VacationList
        vacations={links ?? []}
        goals={goals}
        today={today}
        onEdit={(v) => setMode({ kind: 'form', id: v.id, initial: vacationToForm(v) })}
        onEndNow={(v) => void endVacationNow(db, v.id, today)}
        onDelete={(v) => void deleteVacation(db, v.id)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
