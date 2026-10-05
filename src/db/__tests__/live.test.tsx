import { renderHook, waitFor, act } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createTestDb } from '../../test/testDb';
import type { TrekDb } from '../client';
import { DbProvider } from '../DbProvider';
import { useLiveGoals } from '../live';
import { createGoal, updateGoal } from '../repositories';

describe('useLiveGoals fallback', () => {
  it('loads and re-runs after writes', async () => {
    const db = createTestDb().db as unknown as TrekDb;
    const wrapper = ({ children }: { children: ReactNode }) => <DbProvider db={db}>{children}</DbProvider>;
    const { result } = await renderHook(() => useLiveGoals(), { wrapper });
    const g = await act(() => createGoal(db, { name: 'One' }, '2026-10-05'));
    await waitFor(() => expect(result.current.data.map((x) => x.name)).toEqual(['One']));
    await act(() => updateGoal(db, g.id, { name: 'Two' }));
    await waitFor(() => expect(result.current.data.map((x) => x.name)).toEqual(['Two']));
  });
});
