import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { DbProvider } from '../../../db/DbProvider';
import type { TrekDb } from '../../../db/client';
import { createGoal, listGoals, listScheduleVersions } from '../../../db/repositories';
import { strings } from '../../../strings/en';
import { expectAllPressablesLabelled } from '../../../test/a11y';
import { renderWithTheme } from '../../../test/renderWithTheme';
import { createTestDb } from '../../../test/testDb';
import { GoalForm } from '../GoalForm';
import { defaultGoalForm } from '../goalFormSchema';
import { loadGoalFormValues } from '../saveGoal';

jest.mock('../../tracking/haptics', () => ({ haptic: jest.fn() }));

const f = strings.goalForm;

function newDb(): TrekDb {
  return createTestDb().db as unknown as TrekDb;
}

describe('GoalForm', () => {
  it('every pressable has a role and a name', async () => {
    await renderWithTheme(
      <DbProvider db={newDb()}>
        <GoalForm initial={defaultGoalForm()} onSaved={jest.fn()} onCancel={jest.fn()} />
      </DbProvider>,
    );
    expect(expectAllPressablesLabelled()).toBeGreaterThan(4);
  });

  it('keeps Save disabled until the name is non-empty', async () => {
    const db = newDb();
    await renderWithTheme(
      <DbProvider db={db}>
        <GoalForm initial={defaultGoalForm()} onSaved={jest.fn()} onCancel={jest.fn()} />
      </DbProvider>,
    );
    expect(screen.getByLabelText(f.save)).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText(f.nameLabel), 'Walk');
    expect(screen.getByLabelText(f.save)).toBeEnabled();
  });

  it('creates a name-only goal with defaults', async () => {
    const db = newDb();
    const onSaved = jest.fn();
    await renderWithTheme(
      <DbProvider db={db}>
        <GoalForm initial={defaultGoalForm()} onSaved={onSaved} onCancel={jest.fn()} />
      </DbProvider>,
    );
    await fireEvent.changeText(screen.getByLabelText(f.nameLabel), 'Walk');
    await fireEvent.press(screen.getByLabelText(f.save));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const [goal] = await listGoals(db);
    expect(goal).toMatchObject({ name: 'Walk', icon: 'flag', color: '#2E7D5B', trackingType: 'check', targetValue: 1, endDate: null, targetDays: null });
    const versions = await listScheduleVersions(db, goal.id);
    expect(versions).toHaveLength(1);
    expect(versions[0].scheduleType).toBe('daily');
  });

  it('fills the form from a template', async () => {
    const db = newDb();
    const onSaved = jest.fn();
    await renderWithTheme(
      <DbProvider db={db}>
        <GoalForm initial={defaultGoalForm()} onSaved={onSaved} onCancel={jest.fn()} />
      </DbProvider>,
    );
    await fireEvent.press(screen.getByLabelText(f.useTemplate(f.templateNames.water)));
    expect(screen.getByLabelText(f.nameLabel).props.value).toBe('Water');
    expect(screen.getByText('Count · 8 glasses')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(f.save));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [goal] = await listGoals(db);
    expect(goal).toMatchObject({ name: 'Water', icon: 'water', trackingType: 'count', targetValue: 8, unit: 'glasses' });
  });

  it('applies the Workout template as Mon, Wed, Fri', async () => {
    await renderWithTheme(
      <DbProvider db={newDb()}>
        <GoalForm initial={defaultGoalForm()} onSaved={jest.fn()} onCancel={jest.fn()} />
      </DbProvider>,
    );
    await fireEvent.press(screen.getByLabelText(f.useTemplate(f.templateNames.workout)));
    expect(screen.getByText('Mon, Wed, Fri')).toBeTruthy();
  });

  it('a schedule edit adds a version and shows the note', async () => {
    const db = newDb();
    const goal = await createGoal(db, { name: 'Read' }, '2026-01-01');
    const initial = (await loadGoalFormValues(db, goal.id, '2026-10-05'))!;
    const onSaved = jest.fn();
    await renderWithTheme(
      <DbProvider db={db}>
        <GoalForm initial={initial} goalId={goal.id} onSaved={onSaved} onCancel={jest.fn()} />
      </DbProvider>,
    );
    await fireEvent.press(screen.getByLabelText(f.toggleSection(f.sections.schedule)));
    expect(screen.getByText(f.scheduleNote)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(f.scheduleTypes.weekends));
    await fireEvent.press(screen.getByLabelText(f.saveEdit));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(goal.id));
    const versions = await listScheduleVersions(db, goal.id);
    expect(versions).toHaveLength(2);
    expect(versions[0]).toMatchObject({ effectiveFrom: '2026-01-01', scheduleType: 'daily' });
    expect(versions[1].scheduleType).toBe('weekends');
  });

  it('shows a validation message instead of saving an invalid end date', async () => {
    const db = newDb();
    const onSaved = jest.fn();
    await renderWithTheme(
      <DbProvider db={db}>
        <GoalForm initial={{ ...defaultGoalForm(), name: 'Walk', durationMode: 'endDate', endDate: 'soon' }} onSaved={onSaved} onCancel={jest.fn()} />
      </DbProvider>,
    );
    await fireEvent.press(screen.getByLabelText(f.save));
    expect(await screen.findByText(f.errors.dateInvalid)).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
    expect(await listGoals(db)).toHaveLength(0);
  });

  it('shows a validation message instead of saving an invalid reminder time', async () => {
    const db = newDb();
    const onSaved = jest.fn();
    await renderWithTheme(
      <DbProvider db={db}>
        <GoalForm initial={{ ...defaultGoalForm(), name: 'Walk', reminderEnabled: true, reminderTime: '25:99' }} onSaved={onSaved} onCancel={jest.fn()} />
      </DbProvider>,
    );
    await fireEvent.press(screen.getByLabelText(f.save));
    expect(await screen.findByText(f.errors.timeInvalid)).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
    expect(await listGoals(db)).toHaveLength(0);
  });
});
