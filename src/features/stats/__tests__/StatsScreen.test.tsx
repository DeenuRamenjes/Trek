import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { DbProvider } from '../../../db/DbProvider';
import type { TrekDb } from '../../../db/client';
import { createGoal, createGroup, setGroupGoals, upsertLog } from '../../../db/repositories';
import { addDaysTo } from '../../../domain/dates';
import { logicalToday } from '../../../domain/dayBoundary';
import { strings } from '../../../strings/en';
import { renderWithTheme } from '../../../test/renderWithTheme';
import { createTestDb } from '../../../test/testDb';
import { useSettings } from '../../settings/settingsStore';
import { StatsScreen } from '../StatsScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const t = strings.stats;
const today = logicalToday(new Date(), 0);
const start = addDaysTo(today, -40);

async function setup(opts: { groups?: boolean } = {}) {
  const db = createTestDb().db as unknown as TrekDb;
  const a = await createGoal(db, { name: 'Alpha', icon: 'flag', color: '#2E7D5B', startDate: start } as never, start);
  const b = await createGoal(db, { name: 'Beta', icon: 'flag', color: '#2E7D5B', startDate: start } as never, start);
  // Alpha done 3 days ago, Beta done 20 days ago.
  await upsertLog(db, { goalId: a.id, date: addDaysTo(today, -3), value: 1, status: 'done' } as never);
  await upsertLog(db, { goalId: b.id, date: addDaysTo(today, -20), value: 1, status: 'done' } as never);
  if (opts.groups) {
    const g = await createGroup(db, { name: 'Alphas', color: '#2E7D5B', icon: 'flag' });
    await setGroupGoals(db, g.id, [a.id]);
  }
  await renderWithTheme(
    <DbProvider db={db}>
      <StatsScreen />
    </DbProvider>,
  );
  return db;
}

describe('StatsScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    useSettings.getState().reset();
  });

  it('requireGroup with no groups shows the empty state and CTA', async () => {
    useSettings.getState().update({ homeEmptyStateMode: 'requireGroup' });
    await setup();
    await screen.findByText(t.emptyRequireGroup);
    await fireEvent.press(screen.getByLabelText(t.createGroupAction));
    expect(mockPush).toHaveBeenCalledWith('/group/new');
    expect(screen.queryByLabelText(t.rangeLabel)).toBeNull();
  });

  it('allGoals mode shows stats plus a soft create-group card', async () => {
    await setup();
    await screen.findByText(t.createGroupTitle);
    expect(screen.getByLabelText(t.rangeLabel)).toBeTruthy();
    expect(screen.getByLabelText(`${t.chooseGroup}: ${t.allGoals}`)).toBeTruthy();
  });

  it('links to the reviews', async () => {
    await setup();
    await fireEvent.press(await screen.findByLabelText(t.openReview(t.weeklyReview)));
    expect(mockPush).toHaveBeenLastCalledWith(expect.stringMatching(/^\/review\/week-\d{4}-\d{2}-\d{2}$/));
    await fireEvent.press(screen.getByLabelText(t.openReview(t.monthlyReview)));
    expect(mockPush).toHaveBeenLastCalledWith(expect.stringMatching(/^\/review\/month-\d{4}-\d{2}$/));
  });

  it('dropdown switches group and filters the stats', async () => {
    await setup({ groups: true });
    await fireEvent.press(await screen.findByLabelText(`${t.chooseGroup}: ${t.allGoals}`));
    await fireEvent.press(screen.getByLabelText('Alphas'));
    await screen.findByLabelText(`${t.chooseGroup}: Alphas`);
    expect(screen.queryByText(t.createGroupTitle)).toBeNull();
  });

  it('range change updates the completion text', async () => {
    await setup();
    const text = async () => (await screen.findByLabelText(/^Completion \d+ percent/)).props.accessibilityLabel as string;
    await fireEvent.press(await screen.findByLabelText(t.ranges.d7));
    const short = await waitFor(text);
    await fireEvent.press(screen.getByLabelText(t.ranges.d30));
    await waitFor(async () => expect(await text()).not.toBe(short));
  });
});
