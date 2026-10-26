// Unsent text by account and dream for this app session: leaving a conversation keeps what was typed.
const unsentDrafts = new Map<string, string>();

export function getUnsentDraft(key: string): string {
  return unsentDrafts.get(key) ?? '';
}

export function setUnsentDraft(key: string, text: string): void {
  if (text) {
    unsentDrafts.set(key, text);
  } else {
    unsentDrafts.delete(key);
  }
}

/** Signing out or switching accounts leaves no typed text behind in memory. */
export function clearUnsentDrafts(): void {
  unsentDrafts.clear();
}
