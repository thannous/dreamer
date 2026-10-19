import { matchesDreamTarget, type DreamTarget } from '@/lib/dreamIdentity';
import type { DreamTheme } from '@/lib/types';

/**
 * The dream story's prologue hand-off: the capture seal ends on the saved moment's window,
 * already open and filled with night. The dream's page then takes that window over instead
 * of opening it a second time. A single token, kept in memory only, for the dream the seal
 * just played; it expires on its own, and reading it does not spend it, so a page that
 * reads it twice while mounting still gets the same answer.
 */
const HANDOFF_TTL_MS = 10_000;

/** The name the seal wrote and the seal it struck, which the page shows as the seal left them. */
export type DreamStoryHandoffName = {
  title: string;
  provisional: boolean;
  mark?: { theme: DreamTheme; legend: string };
};

type Target = Exclude<DreamTarget, number>;

// The dream is held by its target, not its identity key: synchronization can give it its
// remote id while the seal plays, which changes the key but not the dream.
let pending: { target: Target; expiresAt: number; name?: DreamStoryHandoffName; onPageReady?: () => void } | null = null;

export function markDreamStoryHandoff(dream: Target, name?: DreamStoryHandoffName, now = Date.now(), onPageReady?: () => void): () => void {
  const target = { id: dream.id, remoteId: dream.remoteId, clientRequestId: dream.clientRequestId };
  const handoff = { target, expiresAt: now + HANDOFF_TTL_MS, ...(name ? { name } : null), onPageReady };
  pending = handoff;
  return () => { handoff.onPageReady = undefined; };
}

/** Release the capture veil once this page is laid out, rather than waiting a fixed 700ms. */
export function markDreamStoryPageReady(dream: Target, now = Date.now()): void {
  if (!hasDreamStoryHandoff(dream, now)) return;
  const ready = pending?.onPageReady;
  if (pending) pending.onPageReady = undefined;
  ready?.();
}

/** Whether the seal has just handed this dream's window over. */
export function hasDreamStoryHandoff(dream: Target, now = Date.now()): boolean {
  return pending !== null && pending.expiresAt > now && matchesDreamTarget(dream, pending.target);
}

/** The name the seal has just written for this dream, if it handed the dream over. */
export function getDreamStoryHandoffName(dream: Target, now = Date.now()): DreamStoryHandoffName | undefined {
  return hasDreamStoryHandoff(dream, now) ? pending?.name : undefined;
}
