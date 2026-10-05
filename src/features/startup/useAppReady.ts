import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';

export type Readiness = { ready: boolean; error?: Error | null };
export type AppReady = { ready: boolean; error: Error | null };

/** Combine readiness sources: ready when all are ready (or errored); first error wins. */
export function combineReadiness(sources: Readiness[]): AppReady {
  return {
    ready: sources.every((s) => s.ready || s.error != null),
    error: sources.find((s) => s.error != null)?.error ?? null,
  };
}

function useIconFonts(): Readiness {
  const [loaded, error] = useFonts(Ionicons.font);
  useEffect(() => {
    if (__DEV__ && error) console.warn('Trek: icon fonts failed to load', error);
  }, [error]);
  // A missing icon font is cosmetic: it counts as ready and is not surfaced as a startup error.
  return { ready: loaded || error != null };
}

/** Phase 2 adds `useMigrations()` to the sources array; the layout stays unchanged. */
export function useAppReady(): AppReady {
  const fonts = useIconFonts();
  return combineReadiness([fonts]);
}
