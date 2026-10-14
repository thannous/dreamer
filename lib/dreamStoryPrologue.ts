/**
 * The dream story's prologue hand-off: the capture seal ends on the saved moment's window,
 * already open and filled with night. The dream's page then takes that window over instead
 * of opening it a second time. A single token, kept in memory only, for the dream the seal
 * just played; it expires on its own, and reading it does not spend it, so a page that
 * reads it twice while mounting still gets the same answer.
 */
const HANDOFF_TTL_MS = 10_000;

/** The name the seal wrote, which the page shows as the seal left it. */
export type DreamStoryHandoffName = { title: string; provisional: boolean };

let pending: { key: string; expiresAt: number; name?: DreamStoryHandoffName } | null = null;

export function markDreamStoryHandoff(key: string, name?: DreamStoryHandoffName, now = Date.now()): void {
  pending = { key, expiresAt: now + HANDOFF_TTL_MS, ...(name ? { name } : null) };
}

/** Whether the seal has just handed this dream's window over. */
export function hasDreamStoryHandoff(key: string, now = Date.now()): boolean {
  return pending !== null && pending.key === key && pending.expiresAt > now;
}

/** The name the seal has just written for this dream, if it handed the dream over. */
export function getDreamStoryHandoffName(key: string, now = Date.now()): DreamStoryHandoffName | undefined {
  return hasDreamStoryHandoff(key, now) ? pending?.name : undefined;
}
