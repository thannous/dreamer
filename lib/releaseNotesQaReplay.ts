import { isMockModeEnabled } from '@/lib/env';

const listeners = new Set<() => void>();

/**
 * Mock QA: opens the release notes as a returning reader finds them after an update. The mock
 * keeps nothing between launches, so no visit there is ever "the first one after an update".
 */
export function replayReleaseNotesForQa(): void {
  if (!isMockModeEnabled()) return;
  listeners.forEach((listener) => listener());
}

export function onReleaseNotesQaReplay(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
