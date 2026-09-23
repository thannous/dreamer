// The first categorization continues after capture navigates to the journal.
// Keep its in-flight state across those screens so recovery cannot duplicate it.
const pending = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

export function subscribeInitialDreamCategorization(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function isInitialDreamCategorizationPending(identity: string): boolean {
  return pending.has(identity);
}

export function trackInitialDreamCategorization(
  identity: string,
  operation: () => Promise<void>
): Promise<void> {
  const existing = pending.get(identity);
  if (existing) return existing;

  const run = Promise.resolve().then(operation).finally(() => {
    if (pending.get(identity) === run) {
      pending.delete(identity);
      notify();
    }
  });
  pending.set(identity, run);
  notify();
  return run;
}
