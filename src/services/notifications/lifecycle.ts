export type LifecycleDeps = {
  processActions: () => Promise<unknown>;
  reconcile: () => Promise<unknown>;
  refreshWidgets: () => Promise<unknown>;
  getTimeZone: () => string;
  getLastKnownTimeZone: () => string | undefined;
  setLastKnownTimeZone: (zone: string) => void;
  debounceMs?: number;
};

/**
 * Wraps an async job so calls never overlap: a call during a run schedules exactly one rerun and
 * every caller's promise resolves when the run that covers it finishes.
 */
export function coalesce(job: () => Promise<unknown>): () => Promise<void> {
  let running: Promise<void> | null = null;
  let rerun = false;
  return function call(): Promise<void> {
    if (running) {
      rerun = true;
      return running;
    }
    running = (async () => {
      try {
        do {
          rerun = false;
          await job();
        } while (rerun);
      } finally {
        running = null;
      }
    })();
    return running;
  };
}

/** Orchestration with injected deps so it is testable without React or Expo. */
export function createLifecycle(deps: LifecycleDeps) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function runCycle(): Promise<void> {
    await deps.processActions();
    await deps.reconcile();
  }

  async function onForeground(): Promise<void> {
    try {
      const zone = deps.getTimeZone();
      const last = deps.getLastKnownTimeZone();
      const changed = last !== undefined && last !== zone;
      if (last !== zone) deps.setLastKnownTimeZone(zone);
      await runCycle();
      if (changed) await deps.refreshWidgets();
    } catch {
      // Best effort; the next foreground or background run retries.
    }
  }

  function onDataChanged(): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void Promise.resolve(deps.reconcile()).catch(() => undefined);
    }, deps.debounceMs ?? 500);
  }

  function dispose(): void {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  return { runCycle, onForeground, onDataChanged, dispose };
}
