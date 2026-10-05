import { act, fireEvent, renderHook, screen, waitFor } from '@testing-library/react-native';
import { DbProvider } from '../../../db/DbProvider';
import type { TrekDb } from '../../../db/client';
import { createGoal, createVacation, listLogs } from '../../../db/repositories';
import { addDaysTo } from '../../../domain/dates';
import { logicalToday } from '../../../domain/dayBoundary';
import { strings } from '../../../strings/en';
import { renderWithTheme } from '../../../test/renderWithTheme';
import { createTestDb } from '../../../test/testDb';
import { loadGoalContexts } from '../../goals/goalContexts';
import { TodayScreen } from '../TodayScreen';
import { buildTodayRows } from '../todayModel';
import { useCheckOff } from '../useCheckOff';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../haptics', () => ({ haptic: jest.fn() }));

const t = strings.today;
const today = logicalToday(new Date(), 0);
const yesterday = addDaysTo(today, -1);
const start = addDaysTo(today, -10);

type Spec = { name: string; trackingType?: 'check' | 'count' | 'duration' | 'value'; targetValue?: number };

async function setup(specs: Spec[]) {
  const db = createTestDb().db as unknown as TrekDb;
  for (const s of specs) await createGoal(db, { icon: 'flag', color: '#2E7D5B', startDate: start, ...s } as never, start);
  await renderWithTheme(
    <DbProvider db={db}>
      <TodayScreen />
    </DbProvider>,
  );
  return db;
}

describe('TodayScreen', () => {
  it('tap check marks done and shows undo; undo deletes the log', async () => {
    const db = await setup([{ name: 'Walk' }]);
    await fireEvent.press(await screen.findByLabelText(t.markDone('Walk')));
    await screen.findByText(t.toastDone('Walk'));
    await waitFor(async () => expect(await listLogs(db)).toMatchObject([{ date: today, status: 'done', value: 1 }]));
    await fireEvent.press(screen.getByLabelText(t.undo));
    await waitFor(async () => expect(await listLogs(db)).toHaveLength(0));
  });

  it('count +1 increments and undo restores the previous value', async () => {
    const db = await setup([{ name: 'Water', trackingType: 'count', targetValue: 8 }]);
    const add = await screen.findByLabelText(t.increment('Water'));
    await fireEvent.press(add);
    await waitFor(async () => expect((await listLogs(db))[0]?.value).toBe(1));
    await fireEvent.press(screen.getByLabelText(t.increment('Water')));
    await waitFor(async () => expect((await listLogs(db))[0]?.value).toBe(2));
    await fireEvent.press(screen.getByLabelText(t.undo));
    await waitFor(async () => expect(await listLogs(db)).toMatchObject([{ value: 1, status: 'partial' }]));
  });

  it('accessibility action Mark skipped sets skipped', async () => {
    const db = await setup([{ name: 'Read' }]);
    const row = await screen.findByLabelText(/^Read, Pending/);
    await act(async () => {
      fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'skip' } });
    });
    await waitFor(async () => expect(await listLogs(db)).toMatchObject([{ status: 'skipped', value: 0 }]));
  });

  it('logs a past date picked from the strip', async () => {
    const db = await setup([{ name: 'Walk' }]);
    await screen.findByLabelText(t.markDone('Walk'));
    const d = new Date(`${yesterday}T12:00:00`);
    const label = t.selectDay(d.toLocaleDateString('en-US', { weekday: 'long' }) + ' ' + d.getDate() + ' ' + d.toLocaleDateString('en-US', { month: 'long' }));
    await fireEvent.press(screen.getByLabelText(label));
    await fireEvent.press(await screen.findByLabelText(t.markDone('Walk')));
    await waitFor(async () => expect(await listLogs(db)).toMatchObject([{ date: yesterday, status: 'done' }]));
  });

  it('shows the vacation banner for an active vacation', async () => {
    const db = createTestDb().db as unknown as TrekDb;
    await createGoal(db, { name: 'Walk', icon: 'flag', color: '#2E7D5B', startDate: start } as never, start);
    await createVacation(db, { startDate: yesterday, endDate: addDaysTo(today, 2), scope: 'all' });
    await renderWithTheme(
      <DbProvider db={db}>
        <TodayScreen />
      </DbProvider>,
    );
    await screen.findByText(t.vacationBanner);
    await screen.findByLabelText(t.endVacation);
  });

  it('shows all done when everything is complete', async () => {
    await setup([{ name: 'Walk' }]);
    await fireEvent.press(await screen.findByLabelText(t.markDone('Walk')));
    await screen.findByText(t.allDoneTitle);
  });

  it('shows the empty state with templates when there are no goals', async () => {
    await setup([]);
    await screen.findByText(t.emptyTitle);
    await fireEvent.press(screen.getByLabelText(strings.goalForm.useTemplate('Water')));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/goal/new', params: { template: 'water' } });
  });

  it('two rapid increments add 2; undo restores the exact prior value', async () => {
    const db = createTestDb().db as unknown as TrekDb;
    await createGoal(db, { name: 'Water', trackingType: 'count', targetValue: 8, icon: 'flag', color: '#2E7D5B', startDate: start } as never, start);
    const contexts = await loadGoalContexts(db, {});
    const { pending } = buildTodayRows(contexts, [], today, today, 1);
    const hook = await renderHook(() => useCheckOff({ db, contexts, today, weekStart: 1 }));
    await act(async () => {
      void hook.result.current.act(pending[0], today, { kind: 'increment', value: 1 });
      void hook.result.current.act(pending[0], today, { kind: 'increment', value: 1 });
    });
    await waitFor(async () => expect((await listLogs(db))[0]?.value).toBe(2));
    await act(async () => {
      await hook.result.current.undo();
    });
    expect((await listLogs(db))[0]?.value).toBe(1);
  });

  it('undo of a clear restores the original log row', async () => {
    const db = await setup([{ name: 'Walk' }]);
    await fireEvent.press(await screen.findByLabelText(t.markDone('Walk')));
    await waitFor(async () => expect(await listLogs(db)).toHaveLength(1));
    const [orig] = await listLogs(db);
    await fireEvent.press(await screen.findByLabelText(t.markNotDone('Walk')));
    await waitFor(async () => expect(await listLogs(db)).toHaveLength(0));
    await fireEvent.press(screen.getByLabelText(t.undo));
    await waitFor(async () => expect(await listLogs(db)).toEqual([orig]));
  });

  it('done action on an already done row is a no-op', async () => {
    const db = await setup([{ name: 'Walk' }]);
    await fireEvent.press(await screen.findByLabelText(t.markDone('Walk')));
    await waitFor(async () => expect(await listLogs(db)).toHaveLength(1));
    const [orig] = await listLogs(db);
    const row = await screen.findByLabelText(/^Walk, Done/);
    await act(async () => {
      fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'done' } });
    });
    expect(await listLogs(db)).toEqual([orig]);
  });

  it('hides the banner for a selected-scope vacation that covers no active goal', async () => {
    const db = createTestDb().db as unknown as TrekDb;
    await createGoal(db, { name: 'Walk', icon: 'flag', color: '#2E7D5B', startDate: start } as never, start);
    await createVacation(db, { startDate: yesterday, endDate: addDaysTo(today, 2), scope: 'selected', goalIds: [] });
    await renderWithTheme(
      <DbProvider db={db}>
        <TodayScreen />
      </DbProvider>,
    );
    await screen.findByLabelText(t.markDone('Walk'));
    expect(screen.queryByText(t.vacationBanner)).toBeNull();
  });

  it('log sheet disables Save with a hint for a note without progress', async () => {
    await setup([{ name: 'Water', trackingType: 'count', targetValue: 8 }]);
    const row = await screen.findByLabelText(/^Water, Pending/);
    await act(async () => {
      fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'log' } });
    });
    await fireEvent.changeText(await screen.findByLabelText(t.noteLabel), 'hello');
    await screen.findByText(t.noteNeedsProgress);
    expect(screen.getByLabelText(t.save).props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByLabelText(t.valueLabel), '3');
    expect(screen.queryByText(t.noteNeedsProgress)).toBeNull();
  });
});
