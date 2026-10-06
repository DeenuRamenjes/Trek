/** 'logs': only logs or pending actions changed; goal contexts (goals, schedules, pauses, vacations) are untouched. */
export type DbChangeScope = 'logs' | 'all';

type Listener = (scope: DbChangeScope) => void;

const listeners = new Set<Listener>();

/** Tell live hooks (test-driver fallback) that data may have changed. */
export function emitDbChanged(scope: DbChangeScope = 'all'): void {
  for (const l of [...listeners]) {
    try {
      l(scope);
    } catch (e) {
      if (__DEV__) console.warn('Trek: db change listener failed', e);
    }
  }
}

export function onDbChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
