import { renderHook } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import { combineReadiness, useAppReady } from '../useAppReady';

jest.mock('expo-font', () => ({ useFonts: jest.fn() }));
const mockUseFonts = useFonts as jest.Mock;

describe('useAppReady', () => {
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

describe('combineReadiness', () => {
  it('waits for every source', () => {
    expect(combineReadiness([{ ready: true }, { ready: false }]).ready).toBe(false);
  });
  it('surfaces the first error and is ready', () => {
    const err = new Error('migrate');
    expect(combineReadiness([{ ready: true }, { ready: false, error: err }])).toEqual({ ready: true, error: err });
  });
});
