/**
 * The badge ledger of the signed-in dreamer (or the guest), kept on this device.
 *
 * One ledger per scope, as the journal itself: `guest` or `user:<id>`. A guest's ledger is
 * joined once to the first account that opens after it, the same way its dreams move there,
 * and is then forgotten. Writes are serialized, so two actions finishing together both count.
 * Actions recorded before the ledger is read wait for it instead of being lost.
 */
import { useSyncExternalStore } from 'react';

import type { BadgeFamilyId, BadgeTierLevel } from '@/lib/badges/catalog';
import {
  actionsOnly,
  applyBadgeEvent,
  BADGE_LEDGER_VERSION,
  createEmptyBadgeLedger,
  mergeBadgeLedgers,
  parseBadgeLedger,
  revealBadgeFamily,
  settleBadgeLedger,
  stampActionTiers,
  type BadgeEvent,
  type BadgeLedger,
} from '@/lib/badges/ledger';
import type { DreamAnalysis } from '@/lib/types';
import { getLucidKeyValueStorage } from '@/services/lucidKeyValueStorage';

export type BadgeScope = 'guest' | `user:${string}`;

const STORAGE_PREFIX = 'noctalia_badge_ledger_v1:';
const storageKey = (scope: BadgeScope) => `${STORAGE_PREFIX}${scope}`;

type Change = (ledger: BadgeLedger) => BadgeLedger;

export type BadgeLedgerSnapshot = {
  scope: BadgeScope | null;
  ledger: BadgeLedger;
  /** False until the scope's stored ledger has been read. */
  ready: boolean;
};

let snapshot: BadgeLedgerSnapshot = { scope: null, ledger: createEmptyBadgeLedger(), ready: false };
let waiting: Change[] = [];
// Actions that succeeded before any scope was known (auth still loading at launch): they
// belong to the first dreamer whose ledger opens.
let beforeScope: Change[] = [];
let writes: Promise<void> = Promise.resolve();
let activation = 0;
const listeners = new Set<() => void>();

const publish = (next: BadgeLedgerSnapshot) => {
  snapshot = next;
  for (const listener of listeners) listener();
};

type StoredLedger =
  | { status: 'absent' }
  | { status: 'read'; ledger: BadgeLedger }
  /** Present but not a ledger this version can read: it is never written over. */
  | { status: 'unreadable' };

/** Reads a scope's ledger. A storage failure throws, so the caller can try again later. */
async function readLedger(scope: BadgeScope): Promise<StoredLedger> {
  const raw = await getLucidKeyValueStorage().getItem(storageKey(scope));
  if (!raw) return { status: 'absent' };
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || (value as { version?: unknown }).version !== BADGE_LEDGER_VERSION) {
      return { status: 'unreadable' };
    }
    return { status: 'read', ledger: parseBadgeLedger(value) };
  } catch {
    return { status: 'unreadable' };
  }
}

/** Waits before reading again a ledger the storage could not give: 1 s, then longer. */
const READ_RETRY_MS = [1_000, 4_000, 15_000, 60_000];
// False while the open scope's stored ledger could not be read: nothing may replace it.
let writable = true;

/** Queues a write behind the previous ones; a failed write never blocks the next. */
function persist(scope: BadgeScope, ledger: BadgeLedger): Promise<void> {
  if (!writable) return writes;
  writes = writes
    .catch(() => undefined)
    .then(() => getLucidKeyValueStorage().setItem(storageKey(scope), JSON.stringify(ledger)))
    .catch((error) => {
      if (__DEV__) console.warn('[Badges] Failed to save the ledger', error);
    });
  return writes;
}

/**
 * Opens the scope's ledger. Changes made meanwhile are applied once it is read. Until the
 * storage gives it, the ledger stays closed and keeps those changes waiting: an empty one
 * written over it would lose every earned tier.
 */
export function activateBadgeScope(scope: BadgeScope): Promise<void> {
  if (snapshot.scope === scope) return writes;
  const id = ++activation;
  waiting = beforeScope;
  beforeScope = [];
  writable = true;
  publish({ scope, ledger: createEmptyBadgeLedger(), ready: false });
  return open(scope, id, 0);
}

function open(scope: BadgeScope, id: number, attempt: number): Promise<void> {
  writes = writes.catch(() => undefined).then(async () => {
    if (id !== activation) return;
    let own: StoredLedger;
    let guest: StoredLedger = { status: 'absent' };
    try {
      own = await readLedger(scope);
      if (scope !== 'guest') guest = await readLedger('guest');
    } catch (error) {
      if (__DEV__) console.warn('[Badges] Failed to read the ledger', error);
      const delay = READ_RETRY_MS[Math.min(attempt, READ_RETRY_MS.length - 1)];
      setTimeout(() => {
        if (id === activation) void open(scope, id, attempt + 1);
      }, delay);
      return;
    }
    if (id !== activation) return;
    writable = own.status !== 'unreadable';
    let ledger = own.status === 'read' ? own.ledger : createEmptyBadgeLedger();
    // A guest's actions join the first account that opens; what its journal told does not,
    // since the account reads its own journal again.
    const guestLedger = writable && guest.status === 'read' ? guest.ledger : null;
    const claimedGuest = guestLedger !== null;
    if (guestLedger) ledger = mergeBadgeLedgers(ledger, actionsOnly(guestLedger));
    const initial = ledger;
    for (const change of waiting) ledger = change(ledger);
    waiting = [];
    publish({ scope, ledger, ready: true });
    if (writable && (ledger !== initial || claimedGuest)) {
      await getLucidKeyValueStorage().setItem(storageKey(scope), JSON.stringify(ledger));
    }
    if (claimedGuest) await getLucidKeyValueStorage().removeItem(storageKey('guest'));
  }).catch((error) => {
    if (__DEV__) console.warn('[Badges] Failed to open the ledger', error);
  });
  return writes;
}

function change(update: Change): void {
  const { scope, ledger, ready } = snapshot;
  if (!scope) {
    beforeScope.push(update);
    return;
  }
  if (!ready) {
    waiting.push(update);
    return;
  }
  const next = update(ledger);
  if (next === ledger) return;
  publish({ scope, ledger: next, ready: true });
  void persist(scope, next);
}

/** Counts one action that has just succeeded. Calling it again for the same action is harmless. */
export function recordBadgeEvent(event: BadgeEvent): void {
  const now = Date.now();
  change((ledger) => stampActionTiers(applyBadgeEvent(ledger, event), now));
}

/** Folds the journal as it is now into the ledger, stamping any tier newly reached. */
export function settleBadges(dreams: readonly DreamAnalysis[], now = Date.now()): void {
  change((ledger) => settleBadgeLedger(ledger, dreams, now));
}

/** The collection has unveiled this family's tiers, up to the one it showed. */
export function markBadgeFamilyRevealed(id: BadgeFamilyId, shown: BadgeTierLevel): void {
  change((ledger) => revealBadgeFamily(ledger, id, shown));
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getSnapshot = () => snapshot;

/** The ledger as it is now, outside React. */
export const getBadgeLedgerSnapshot = getSnapshot;

export function useBadgeLedger(): BadgeLedgerSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Test-only: forgets the in-memory ledger and pending work. */
export function resetBadgeLedgerStoreForTests(): void {
  activation += 1;
  waiting = [];
  beforeScope = [];
  writable = true;
  writes = Promise.resolve();
  snapshot = { scope: null, ledger: createEmptyBadgeLedger(), ready: false };
  listeners.clear();
}

/** Test-only: resolves once every queued read and write has finished. */
export function flushBadgeLedgerWritesForTests(): Promise<void> {
  return writes;
}
