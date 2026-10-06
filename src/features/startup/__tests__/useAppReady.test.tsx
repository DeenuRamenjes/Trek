import { renderHook } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import { useDbMigrations } from '../../../db/useMigrations';
import { combineReadiness, useAppReady } from '../useAppReady';

jest.mock('expo-font', () => ({ useFonts: jest.fn() }));
jest.mock('../../../db/useMigrations', () => ({ useDbMigrations: jest.fn() }));
const mockUseFonts = useFonts as jest.Mock;
const mockUseDb = useDbMigrations as jest.Mock;

describe('useAppReady', () => {
  beforeEach(() => mockUseDb.mockReturnValue({ ready: true, error: null }));
  afterEach(() => jest.restoreAllMocks());

  it('is not ready while fonts load', async () => {
    mockUseFonts.mockReturnValue([false, null]);
    expect((await renderHook(() => useAppReady())).result.current).toEqual({ ready: false, error: null });
  });

  it('is ready when fonts loaded', async () => {
    mockUseFonts.mockReturnValue([true, null]);
    expect((await renderHook(() => useAppReady())).result.current).toEqual({ ready: true, error: null });
  });

  it('is ready and warns when fonts fail', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const err = new Error('font');
    mockUseFonts.mockReturnValue([false, err]);
    expect((await renderHook(() => useAppReady())).result.current).toEqual({ ready: true, error: null });
    expect(warn).toHaveBeenCalledWith('Trek: icon fonts failed to load', err);
  });
});

describe('useAppReady with migrations', () => {
  it('waits for migrations', async () => {
    mockUseFonts.mockReturnValue([true, null]);
    mockUseDb.mockReturnValue({ ready: false, error: null });
    expect((await renderHook(() => useAppReady())).result.current).toEqual({ ready: false, error: null });
  });
  it('surfaces a migration error', async () => {
    const err = new Error('migrate');
    mockUseFonts.mockReturnValue([true, null]);
    mockUseDb.mockReturnValue({ ready: false, error: err });
    expect((await renderHook(() => useAppReady())).result.current).toEqual({ ready: true, error: err });
  });
});

describe('combineReadiness', () => {
  it('waits for every source', () => {
    expect(combineReadiness([{ ready: true }, { ready: false }]).ready).toBe(false);
  });
  it('surfaces the first error and is ready', () => {
    const err = new Error('migrate');
    expect(combineReadiness([{ ready: true }, { ready: false, error: err }])).toEqual({ ready: true, error: err });
  });
});
