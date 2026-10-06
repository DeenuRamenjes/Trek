import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { DbProvider } from '../../../db/DbProvider';
import type { TrekDb } from '../../../db/client';
import { createGoal, listGroupGoals, listGroups } from '../../../db/repositories';
import { strings } from '../../../strings/en';
import { renderWithTheme } from '../../../test/renderWithTheme';
import { createTestDb } from '../../../test/testDb';
import { GroupForm, emptyGroupForm } from '../GroupForm';
import { GroupsSection } from '../GroupsSection';
import { saveGroup } from '../saveGroup';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../tracking/haptics', () => ({ haptic: jest.fn() }));

const s = strings.groups;
const goal = (db: TrekDb, name: string) => createGoal(db, { name, icon: 'flag', color: '#2E7D5B' } as never, '2026-10-01');

describe('GroupForm', () => {
  it('creates a group from selected goals', async () => {
    const db = createTestDb().db as unknown as TrekDb;
    const a = await goal(db, 'A');
    await goal(db, 'B');
    const onSaved = jest.fn();
    await renderWithTheme(
      <DbProvider db={db}>
        <GroupForm initial={emptyGroupForm} onSaved={onSaved} onCancel={jest.fn()} />
      </DbProvider>,
    );
    await fireEvent.changeText(screen.getByLabelText(s.nameLabel), 'Health');
    await fireEvent.press(await screen.findByLabelText(s.goalRow('A')));
    expect(screen.getByLabelText(s.goalRow('A')).props.accessibilityState.checked).toBe(true);
    await fireEvent.press(screen.getByText(s.save));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [g] = await listGroups(db);
    expect((await listGroupGoals(db, g.id)).map((l) => l.goalId)).toEqual([a.id]);
  });

  it('save is disabled without a name', async () => {
    const db = createTestDb().db as unknown as TrekDb;
    await renderWithTheme(
      <DbProvider db={db}>
        <GroupForm initial={emptyGroupForm} onSaved={jest.fn()} onCancel={jest.fn()} />
      </DbProvider>,
    );
    await fireEvent.press(screen.getByText(s.save));
    expect(await listGroups(db)).toHaveLength(0);
  });
});

describe('GroupsSection', () => {
  beforeEach(() => mockPush.mockClear());

  it('shows empty state and new group navigates', async () => {
    const db = createTestDb().db as unknown as TrekDb;
    await renderWithTheme(
      <DbProvider db={db}>
        <GroupsSection />
      </DbProvider>,
    );
    await screen.findByText(s.emptyTitle);
    await fireEvent.press(screen.getByLabelText(s.newGroup));
    expect(mockPush).toHaveBeenCalledWith('/group/new');
  });

  it('lists count, opens group, reorders with move down', async () => {
    const db = createTestDb().db as unknown as TrekDb;
    const a = await goal(db, 'A');
    const x = await saveGroup(db, null, { name: 'X', color: '#2E7D5B', icon: 'flag', goalIds: [a.id] });
    await saveGroup(db, null, { name: 'Y', color: '#2E7D5B', icon: 'flag', goalIds: [] });
    await renderWithTheme(
      <DbProvider db={db}>
        <GroupsSection />
      </DbProvider>,
    );
    await screen.findByText(s.goalCount(1));
    await fireEvent.press(screen.getByLabelText(s.openGroup('X')));
    expect(mockPush).toHaveBeenCalledWith(`/group/${x}`);
    expect(screen.getByLabelText(s.moveUp('X'))).toBeDisabled();
    expect(screen.getByLabelText(s.moveDown('X'))).toBeEnabled();
    expect(screen.getByLabelText(s.moveUp('Y'))).toBeEnabled();
    expect(screen.getByLabelText(s.moveDown('Y'))).toBeDisabled();
    await fireEvent.press(screen.getByLabelText(s.moveDown('X')));
    await waitFor(async () => expect((await listGroups(db)).map((g) => g.name)).toEqual(['Y', 'X']));
  });
});
