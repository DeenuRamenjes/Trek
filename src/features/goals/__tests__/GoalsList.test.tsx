import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { DbProvider } from '../../../db/DbProvider';
import type { TrekDb } from '../../../db/client';
import { createGoal, listGoals } from '../../../db/repositories';
import { strings } from '../../../strings/en';
import { expectAllPressablesLabelled } from '../../../test/a11y';
import { renderWithTheme } from '../../../test/renderWithTheme';
import { createTestDb } from '../../../test/testDb';
import { GoalsList } from '../GoalsList';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../tracking/haptics', () => ({ haptic: jest.fn() }));

const s = strings.goals;
const input = (name: string) => ({ name, icon: 'flag', color: '#2E7D5B' }) as never;

async function setup(names: string[]) {
  const db = createTestDb().db as unknown as TrekDb;
  for (const n of names) await createGoal(db, input(n), '2026-10-01');
  await renderWithTheme(
    <DbProvider db={db}>
      <GoalsList />
    </DbProvider>,
  );
  return db;
}

describe('GoalsList', () => {
  beforeEach(() => mockPush.mockClear());

  it('every pressable has a role and a name', async () => {
    await setup(['Alpha', 'Beta']);
    await screen.findByLabelText(s.rowActions('Alpha'));
    expect(expectAllPressablesLabelled()).toBeGreaterThan(4);
  });

  it('shows empty state; template chip opens new goal with template', async () => {
    await setup([]);
    await screen.findByText(s.emptyTitle);
    await fireEvent.press(screen.getByLabelText(strings.goalForm.useTemplate('Water')));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/goal/new', params: { template: 'water' } });
  });

  it('navigates for new goal and row tap', async () => {
    const db = await setup(['Walk']);
    await screen.findByText('Walk');
    await fireEvent.press(screen.getByLabelText(s.newGoal));
    expect(mockPush).toHaveBeenCalledWith('/goal/new');
    const [g] = await listGoals(db);
    await fireEvent.press(screen.getByLabelText(s.openGoal('Walk')));
    expect(mockPush).toHaveBeenCalledWith(`/goal/${g.id}`);
  });

  it('duplicate adds a row', async () => {
    const db = await setup(['Walk']);
    await screen.findByText('Walk');
    await fireEvent.press(screen.getByLabelText(s.rowActions('Walk')));
    await fireEvent.press(screen.getByLabelText(s.duplicate));
    await waitFor(async () => expect(await listGoals(db)).toHaveLength(2));
  });

  it('pause shows badge, resume removes it', async () => {
    await setup(['Walk']);
    await screen.findByText('Walk');
    await fireEvent.press(screen.getByLabelText(s.rowActions('Walk')));
    await fireEvent.press(screen.getByLabelText(s.pause));
    await screen.findByText(s.paused);
    await fireEvent.press(screen.getByLabelText(s.rowActions('Walk')));
    await fireEvent.press(screen.getByLabelText(s.resume));
    await waitFor(() => expect(screen.queryByText(s.paused)).toBeNull());
  });

  it('archive confirms then removes', async () => {
    const db = await setup(['Walk']);
    await screen.findByText('Walk');
    await fireEvent.press(screen.getByLabelText(s.rowActions('Walk')));
    await fireEvent.press(screen.getByLabelText(s.archive));
    await fireEvent.press(screen.getByLabelText(s.confirmArchive));
    await waitFor(() => expect(screen.queryByText('Walk')).toBeNull());
    expect((await listGoals(db)).length).toBe(0);
  });

  it('move down reorders', async () => {
    const db = await setup(['A', 'B']);
    await screen.findByText('B');
    await fireEvent.press(screen.getByLabelText(s.rowActions('A')));
    await fireEvent.press(screen.getByLabelText(s.moveDown));
    await waitFor(async () => expect((await listGoals(db)).map((g) => g.name)).toEqual(['B', 'A']));
  });
});
