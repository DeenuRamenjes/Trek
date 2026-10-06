import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { format } from 'date-fns';
import { DbProvider } from '../../../db/DbProvider';
import type { TrekDb } from '../../../db/client';
import { createGoal, listLogs, upsertLog } from '../../../db/repositories';
import { addDaysTo, parseDate } from '../../../domain/dates';
import { logicalToday } from '../../../domain/dayBoundary';
import { strings } from '../../../strings/en';
import { renderWithTheme } from '../../../test/renderWithTheme';
import { createTestDb } from '../../../test/testDb';
import { useSettings } from '../../settings/settingsStore';
import { HistoryScreen } from '../HistoryScreen';
import { shiftMonth } from '../monthModel';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: jest.fn() }) }));
jest.mock('../../tracking/haptics', () => ({ haptic: jest.fn() }));

const h = strings.history;
const today = logicalToday(new Date(), 0);
const month = today.slice(0, 7);
const prev = shiftMonth(month, -1);
const next = shiftMonth(month, 1);
const start = `${shiftMonth(month, -2)}-01`;

const label = (date: string, status: string) => `${format(parseDate(date), 'EEEE d MMMM')}, ${status}`;

async function setup(spec: { trackingType?: 'check' | 'count'; targetValue?: number } = {}) {
  const db = createTestDb().db as unknown as TrekDb;
  const goal = await createGoal(db, { name: 'Read', icon: 'flag', color: '#2E7D5B', startDate: start, ...spec } as never, start);
  return { db, goal };
}

async function show(db: TrekDb, goalId: string) {
  useSettings.getState().reset();
  await renderWithTheme(
    <DbProvider db={db}>
      <HistoryScreen goalId={goalId} />
    </DbProvider>,
  );
  await screen.findByText(format(parseDate(`${month}-01`), 'MMMM yyyy'));
}

describe('HistoryScreen', () => {
  it('shows an empty hint when the goal has no logs and hides it once one exists', async () => {
    const { db, goal } = await setup();
    await show(db, goal.id);
    expect(screen.getByText(h.noLogsTitle)).toBeTruthy();
    await upsertLog(db, { goalId: goal.id, date: today, value: 1, status: 'done' });
    await waitFor(() => expect(screen.queryByText(h.noLogsTitle)).toBeNull());
  });

  it('shows glyph labels for fixture logs and next/prev change the month', async () => {
    const { db, goal } = await setup();
    await upsertLog(db, { goalId: goal.id, date: `${prev}-03`, value: 1, status: 'done' });
    await upsertLog(db, { goalId: goal.id, date: `${prev}-05`, value: 0, status: 'skipped' });
    await show(db, goal.id);
    await fireEvent.press(screen.getByLabelText(h.previousMonth));
    await screen.findByText(format(parseDate(`${prev}-01`), 'MMMM yyyy'));
    expect(await screen.findByLabelText(label(`${prev}-03`, 'Done'))).toBeTruthy();
    expect(screen.getByLabelText(label(`${prev}-05`, 'Skipped'))).toBeTruthy();
    expect(screen.getByLabelText(label(`${prev}-06`, 'Missed'))).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(h.nextMonth));
    await screen.findByText(format(parseDate(`${month}-01`), 'MMMM yyyy'));
  });

  it('editing a past day saves a log', async () => {
    const { db, goal } = await setup();
    await show(db, goal.id);
    await fireEvent.press(screen.getByLabelText(h.previousMonth));
    await fireEvent.press(await screen.findByLabelText(label(`${prev}-10`, 'Missed')));
    await fireEvent.press(await screen.findByLabelText('Done'));
    await fireEvent.changeText(screen.getByLabelText(h.note), 'felt good');
    expect(screen.getByText(h.noteCount(9))).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(h.save));
    await waitFor(async () =>
      expect(await listLogs(db)).toMatchObject([{ date: `${prev}-10`, status: 'done', value: 1, note: 'felt good' }]),
    );
    expect(await screen.findByLabelText(label(`${prev}-10`, 'Done'))).toBeTruthy();
  });

  it('count goal: stepper to partial, then Done lifts value to target', async () => {
    const { db, goal } = await setup({ trackingType: 'count', targetValue: 8 });
    await show(db, goal.id);
    await fireEvent.press(await screen.findByLabelText(new RegExp(`^${format(parseDate(today), 'EEEE d MMMM')}, Pending`)));
    await fireEvent.press(await screen.findByLabelText(h.increaseValue));
    await fireEvent.press(screen.getByLabelText(h.increaseValue));
    await fireEvent.press(screen.getByLabelText(h.save));
    await waitFor(async () => expect(await listLogs(db)).toMatchObject([{ value: 2, status: 'partial' }]));
    await fireEvent.press(await screen.findByLabelText(new RegExp(`^${format(parseDate(today), 'EEEE d MMMM')}, Partial`)));
    await fireEvent.press(await screen.findByLabelText('Done'));
    await fireEvent.press(screen.getByLabelText(h.save));
    await waitFor(async () => expect(await listLogs(db)).toMatchObject([{ value: 8, status: 'done' }]));
  });

  it('Clear deletes the entry', async () => {
    const { db, goal } = await setup();
    await upsertLog(db, { goalId: goal.id, date: today, value: 1, status: 'done' });
    await show(db, goal.id);
    await fireEvent.press(await screen.findByLabelText(new RegExp(`^${format(parseDate(today), 'EEEE d MMMM')}, Done`)));
    await fireEvent.press(await screen.findByLabelText(h.clear));
    await waitFor(async () => expect(await listLogs(db)).toHaveLength(0));
  });

  it('future days are read-only and open no sheet', async () => {
    const { db, goal } = await setup();
    await show(db, goal.id);
    await fireEvent.press(screen.getByLabelText(h.nextMonth));
    const cell = await screen.findByLabelText(new RegExp(`^${format(parseDate(`${next}-10`), 'EEEE d MMMM')}, .*read-only`));
    expect(cell.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(cell);
    expect(screen.queryByLabelText(h.save)).toBeNull();
    expect(addDaysTo(today, 1) > today).toBe(true);
  });
});
