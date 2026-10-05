import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { onDbChanged } from '../../db/changes';
import { useDb } from '../../db/DbProvider';
import { useLiveGoals, useLiveLogs, useLiveVacations } from '../../db/live';
import { endVacationNow } from '../../db/repositories';
import { addDaysTo, parseDate } from '../../domain/dates';
import { daysSinceBackup, showBackupBanner, snoozeUntil } from '../../domain/backupPolicy';
import type { GoalContext } from '../../domain/types';
import { activeVacation } from '../../domain/vacationRules';
import { strings } from '../../strings/en';
import { AppText, Card, Chip, Screen } from '../../ui/components';
import { Collapse } from '../../ui/motion';
import { spacing } from '../../ui/tokens';
import { templateKeys } from '../goals/templates';
import { loadGoalContexts } from '../goals/goalContexts';
import { useSettings } from '../settings/settingsStore';
import { BackupBanner, useBackUpNow, VacationBanner } from './banners';
import { Confetti } from './Confetti';
import { DateStrip } from './DateStrip';
import { GoalRow } from './GoalRow';
import { LogSheet } from './LogSheet';
import { buildTodayRows, type TodayRow } from './todayModel';
import { UndoToast } from './UndoToast';
import { DURATION_STEP, useCheckOff } from './useCheckOff';
import { useLogicalToday } from './useLogicalToday';
import { ValueSheet } from './ValueSheet';

const t = strings.today;

export function TodayScreen() {
  const router = useRouter();
  const db = useDb();
  const { today, now } = useLogicalToday();
  const dayEndsAt = useSettings((s) => s.settings.dayEndsAt);
  const weekStart = useSettings((s) => s.settings.weekStart);
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const [picked, setPicked] = useState<string | null>(null);
  const [contexts, setContexts] = useState<GoalContext[] | null>(null);
  const [sheet, setSheet] = useState<{ kind: 'log' | 'value'; goalId: string } | null>(null);
  const backUpNow = useBackUpNow();

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysTo(today, i - 6)), [today]);
  const date = picked && days.includes(picked) ? picked : today;

  useEffect(() => {
    let alive = true;
    const load = () =>
      loadGoalContexts(db, { dayEndsAt }).then(
        (c) => alive && setContexts(c),
        () => undefined,
      );
    void load();
    const off = onDbChanged(() => void load());
    return () => {
      alive = false;
      off();
    };
  }, [db, dayEndsAt]);

  const { data: logs } = useLiveLogs();
  const { data: goals } = useLiveGoals();
  const { data: vacationRows } = useLiveVacations();
  const list = contexts ?? [];
  const model = useMemo(() => buildTodayRows(list, logs, date, today, weekStart), [contexts, logs, date, today, weekStart]); // eslint-disable-line react-hooks/exhaustive-deps
  const co = useCheckOff({ db, contexts: list, logs, today, weekStart });

  const vacation = activeVacation(
    vacationRows.map((v) => ({ ...v, goalIds: [] })),
    today,
  );
  const earliest = goals.length ? goals.map((g) => g.createdAt).sort()[0] : null;
  const backupState = {
    now,
    frequency: settings.backupReminderFrequency,
    lastBackupAt: settings.lastBackupAt,
    earliestGoalCreatedAt: earliest,
    backupBannerSnoozedUntil: settings.backupBannerSnoozedUntil,
  };
  const backupShown = showBackupBanner(backupState);

  const sheetRow: TodayRow | undefined = sheet ? [...model.pending, ...model.done].find((r) => r.goalId === sheet.goalId) : undefined;
  const sheetNote = sheetRow ? (logs.find((l) => l.goalId === sheetRow.goalId && l.date === date && l.note)?.note ?? null) : null;

  const primary = (row: TodayRow) => {
    const finished = row.status === 'done' || row.status === 'skipped';
    if (finished) return co.act(row, date, { kind: 'clear' });
    if (row.trackingType === 'value') return setSheet({ kind: 'value', goalId: row.goalId });
    if (row.trackingType === 'count') return co.act(row, date, { kind: 'increment', value: 1 });
    if (row.trackingType === 'duration') return co.act(row, date, { kind: 'increment', value: DURATION_STEP });
    return co.act(row, date, { kind: 'done' });
  };

  const clearMilestone = co.clearMilestone;
  const onConfettiDone = useCallback(() => clearMilestone(), [clearMilestone]);

  const renderRow = (row: TodayRow) => (
    <GoalRow
      key={row.goalId}
      row={row}
      onPrimary={() => void primary(row)}
      onDone={() => void co.act(row, date, { kind: 'done' })}
      onSkip={() => void co.act(row, date, { kind: 'skip' })}
      onLog={() => setSheet({ kind: 'log', goalId: row.goalId })}
      onSlot={(slot) => void co.act(row, date, { kind: slot.done ? 'clear' : 'done', slotId: slot.id })}
    />
  );

  const noGoals = contexts !== null && list.length === 0;
  const allDone = model.pending.length === 0 && model.done.length > 0;
  const nothingDue = !noGoals && contexts !== null && model.pending.length === 0 && model.done.length === 0;

  return (
    <View style={styles.root}>
      <Screen edges={['top', 'left', 'right']}>
        <AppText variant="caption" tone="secondary">
          {format(parseDate(today), 'EEEE, d MMMM')}
        </AppText>
        <AppText variant="display">{t.title}</AppText>
        <DateStrip days={days} selected={date} onSelect={setPicked} />
        <VacationBanner active={vacation != null} onEnd={() => vacation && void endVacationNow(db, vacation.id, today)} />
        <BackupBanner
          show={backupShown}
          days={daysSinceBackup(backupState)}
          onBackUp={backUpNow}
          onSnooze={() => update({ backupBannerSnoozedUntil: snoozeUntil(new Date()) })}
        />
        {noGoals ? (
          <Card>
            <AppText variant="headline">{t.emptyTitle}</AppText>
            <AppText tone="secondary">{t.emptyBody}</AppText>
            <View style={styles.chips}>
              {templateKeys.map((key) => (
                <Chip
                  key={key}
                  label={strings.goalForm.templateNames[key]}
                  accessibilityLabel={strings.goalForm.useTemplate(strings.goalForm.templateNames[key])}
                  onPress={() => router.push({ pathname: '/goal/new', params: { template: key } })}
                />
              ))}
            </View>
            <Chip label={strings.goals.newGoal} onPress={() => router.push('/goal/new')} />
          </Card>
        ) : null}
        {nothingDue ? (
          <Card>
            <AppText variant="headline">{t.nothingDueTitle}</AppText>
            <AppText tone="secondary">{t.nothingDueBody}</AppText>
          </Card>
        ) : null}
        {allDone ? (
          <Card>
            <AppText variant="headline">{t.allDoneTitle}</AppText>
            <AppText tone="secondary">{t.allDoneBody}</AppText>
          </Card>
        ) : null}
        <Collapse open={model.pending.length > 0}>
          <AppText variant="label" tone="secondary">
            {t.pendingSection}
          </AppText>
        </Collapse>
        {model.pending.map(renderRow)}
        <Collapse open={model.done.length > 0}>
          <AppText variant="label" tone="secondary">
            {t.doneSection}
          </AppText>
        </Collapse>
        {model.done.map(renderRow)}
      </Screen>
      {co.undoState ? <UndoToast toastKey={co.undoState.id} message={co.undoState.message} onUndo={() => void co.undo()} onDismiss={co.dismissUndo} /> : null}
      {co.milestone ? <Confetti key={co.milestone.id} onDone={onConfettiDone} /> : null}
      {sheet?.kind === 'value' && sheetRow ? (
        <ValueSheet
          row={sheetRow}
          onClose={() => setSheet(null)}
          onSave={(value) => {
            setSheet(null);
            void co.act(sheetRow, date, { kind: 'set', value });
          }}
        />
      ) : null}
      {sheet?.kind === 'log' && sheetRow ? (
        <LogSheet
          row={sheetRow}
          note={sheetNote}
          onClose={() => setSheet(null)}
          onClear={() => {
            setSheet(null);
            void co.act(sheetRow, date, { kind: 'clear' });
          }}
          onSave={(value, note) => {
            setSheet(null);
            void co.act(sheetRow, date, { kind: 'set', value, note });
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
