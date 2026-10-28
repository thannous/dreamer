/**
 * A snapshot that React reads with `useSyncExternalStore`. Publishing the
 * snapshot already held notifies nobody, so a shared constant such as an idle
 * state never re-renders its screen.
 */
export function createExternalStore<T>(initial: T) {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: (): T => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    publish: (next: T) => {
      if (Object.is(next, snapshot)) return;
      snapshot = next;
      listeners.forEach(listener => listener());
    },
  };
}
