import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { DbProvider } from '../../../db/DbProvider';
import type { TrekDb } from '../../../db/client';
import { createGoal, createVacation, listVacations } from '../../../db/repositories';
import { logicalToday } from '../../../domain/dayBoundary';
import { addDaysTo } from '../../../domain/dates';
import { strings } from '../../../strings/en';
import { expectAllPressablesLabelled } from '../../../test/a11y';
import { renderWithTheme } from '../../../test/renderWithTheme';
import { createTestDb } from '../../../test/testDb';
import { useSettings } from '../../settings/settingsStore';
import { VacationScreen } from '../VacationScreen';
import { validateVacation } from '../vacationForm';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('../../tracking/haptics', () => ({ haptic: jest.fn() }));

const s = strings.vacationMode;
const today = logicalToday(new Date(), 0);

async function show(db: TrekDb) {
  useSettings.getState().reset();
  await renderWithTheme(
    <DbProvider db={db}>
      <VacationScreen />
    </DbProvider>,
  );
}

describe('validateVacation', () => {
  const base = { startDate: today, endDate: today, scope: 'all' as const, goalIds: [], note: '' };
  it('rules', () => {
    expect(validateVacation(base, today)).toBeNull();
    expect(validateVacation({ ...base, startDate: addDaysTo(today, -1) }, today)).toBe('startInPast');
    expect(validateVacation({ ...base, startDate: addDaysTo(today, -1) }, today, addDaysTo(today, -1))).toBeNull();
    expect(validateVacation({ ...base, endDate: addDaysTo(today, -1) }, today)).toBe('endBeforeStart');
    expect(validateVacation({ ...base, scope: 'selected' }, today)).toBe('goalRequired');
    expect(validateVacation({ ...base, endDate: 'nope' }, today)).toBe('endInvalid');
  });
});

describe('VacationScreen', () => {
  it('every pressable has a role and a name in list and form', async () => {
    const db = createTestDb().db as unknown as TrekDb;
    await createGoal(db, { name: 'Walk', icon: 'flag', color: '#2E7D5B' } as never, today);
    await show(db);
    await screen.findByText(s.emptyTitle);
    expect(expectAllPressablesLabelled()).toBeGreaterThan(1);
    await fireEvent.press(screen.getByText(s.newVacation));
    await screen.findByLabelText(s.endLabel);
    expect(expectAllPressablesLabelled()).toBeGreaterThan(3);
  });

  it('shows empty state', async () => {
    const db = createTestDb().db as unknown as TrekDb;
    await show(db);
    await screen.findByText(s.emptyTitle);
  });

  it('creates an all-goals vacation that appears in the list', async () => {
    const db = createTestDb().db as unknown as TrekDb;
    await show(db);
    await fireEvent.press(await screen.findByText(s.newVacation));
    await fireEvent.changeText(screen.getByLabelText(s.endLabel), addDaysTo(today, 3));
    await fireEvent.press(screen.getByText(s.save));
    await screen.findByText(s.range(today, addDaysTo(today, 3)));
    expect(screen.getByText(s.scopeAll)).toBeTruthy();
    expect(await listVacations(db)).toHaveLength(1);
  });

  it('selected scope requires a goal', async () => {
    const db = createTestDb().db as unknown as TrekDb;
    await createGoal(db, { name: 'Read', icon: 'flag', color: '#2E7D5B' } as never, today);
    await show(db);
    await fireEvent.press(await screen.findByText(s.newVacation));
    await fireEvent.press(screen.getByText(s.scopeSelectedChip));
    await fireEvent.press(screen.getByText(s.save));
    await screen.findByText(s.goalRequired);
    expect(await listVacations(db)).toHaveLength(0);
    await fireEvent.press(await screen.findByLabelText(s.goalRow('Read')));
    await fireEvent.press(screen.getByText(s.save));
    await waitFor(async () => expect(await listVacations(db)).toHaveLength(1));
    expect((await listVacations(db))[0].goalIds).toHaveLength(1);
  });

  it('end now moves an active vacation to past', async () => {
    const db = createTestDb().db as unknown as TrekDb;
    const start = addDaysTo(today, -2);
    await createVacation(db, { startDate: start, endDate: addDaysTo(today, 2), scope: 'all' });
    await show(db);
    await screen.findByText(s.activeSection);
    await fireEvent.press(screen.getByText(s.endNowLabel));
    await waitFor(() => expect(screen.queryByText(s.activeSection)).toBeNull());
    expect(screen.getAllByText(s.pastSection)).toHaveLength(2);
    expect(screen.queryByText(s.activeSection)).toBeNull();
    expect((await listVacations(db))[0].endDate).toBe(addDaysTo(today, -1));
  });

  it('delete asks for confirmation', async () => {
    const db = createTestDb().db as unknown as TrekDb;
    await createVacation(db, { startDate: addDaysTo(today, 5), endDate: addDaysTo(today, 6), scope: 'all' });
    await show(db);
    await fireEvent.press(await screen.findByText(s.deleteLabel));
    expect(await listVacations(db)).toHaveLength(1);
    await fireEvent.press(screen.getByText(s.confirmDelete));
    await waitFor(async () => expect(await listVacations(db)).toHaveLength(0));
  });
});
