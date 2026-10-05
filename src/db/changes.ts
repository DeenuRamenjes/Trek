type Listener = () => void;

const listeners = new Set<Listener>();

/** Tell live hooks (test-driver fallback) that data may have changed. */
export function emitDbChanged(): void {
  for (const l of [...listeners]) {
    try {
      l();
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
