/**
 * The badge ledger of the signed-in dreamer (or the guest), kept on this device.
 *
 * One ledger per scope, as the journal itself: `guest` or `user:<id>`. A guest's ledger is
 * joined once to the first account that opens after it, the same way its dreams move there,
 * and is then forgotten. Writes are serialized, so two actions finishing together both count.
 * Actions recorded before the ledger is read wait for it instead of being lost. A ledger of
 * the first collection is read once and brought to the current one under a new key; the old
 * key is never written again, so an older app version keeps its own copy intact.
 */
import { useSyncExternalStore } from 'react';

import type { BadgeFamilyId, BadgeTierLevel } from '@/lib/badges/catalog';
import {
  actionsOnly,
  applyBadgeEvent,
  createEmptyBadgeLedger,
  dreamRef,
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

const STORAGE_PREFIX = 'noctalia_badge_ledger_v2:';
const LEGACY_PREFIX = 'noctalia_badge_ledger_v1:';
const storageKey = (scope: BadgeScope) => `${STORAGE_PREFIX}${scope}`;
const legacyKey = (scope: BadgeScope) => `${LEGACY_PREFIX}${scope}`;

type Change = (ledger: BadgeLedger) => BadgeLedger;

export type BadgeLedgerSnapshot = {
  scope: BadgeScope | null;
  ledger: BadgeLedger;
  /** False until the scope's stored ledger has been read. */
  ready: boolean;
};

let snapshot: BadgeLedgerSnapshot = { scope: null, ledger: createEmptyBadgeLedger(), ready: false };
const waiting = new Map<BadgeScope, Change[]>();
const forgotten = new Set<BadgeScope>();
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
  /** `legacy` when it was brought from the first collection's key and is not saved yet. */
  | { status: 'read'; ledger: BadgeLedger; legacy?: boolean }
  /** Present but not a ledger this version can read: it is never written over. */
  | { status: 'unreadable' };

const parseRaw = (raw: string) => {
  try {
    return parseBadgeLedger(JSON.parse(raw));
  } catch {
    return null;
  }
};

/** Reads a scope's ledger. A storage failure throws, so the caller can try again later. */
async function readLedger(scope: BadgeScope): Promise<StoredLedger> {
  const storage = getLucidKeyValueStorage();
  const raw = await storage.getItem(storageKey(scope));
  if (raw) {
    const ledger = parseRaw(raw);
    return ledger ? { status: 'read', ledger } : { status: 'unreadable' };
  }
  // The legacy key is only ever read: an unreadable one is left to the app that wrote it.
  const legacy = await storage.getItem(legacyKey(scope));
  const ledger = legacy ? parseRaw(legacy) : null;
  return ledger ? { status: 'read', ledger, legacy: true } : { status: 'absent' };
}

/** Waits before reading again a ledger the storage could not give: 1 s, then longer. */
const READ_RETRY_MS = [1_000, 4_000, 15_000, 60_000];
// False while the open scope's stored ledger could not be read: nothing may replace it.
let writable = true;

/** Queues a write behind the previous ones; a failed write never blocks the next. */
function persist(scope: BadgeScope, ledger: BadgeLedger): Promise<void> {
  if (!writable || forgotten.has(scope)) return writes;
  writes = writes
    .catch(() => undefined)
    .then(() => forgotten.has(scope) ? undefined : getLucidKeyValueStorage().setItem(storageKey(scope), JSON.stringify(ledger)))
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
  if (forgotten.has(scope)) return writes;
  if (snapshot.scope === scope) return writes;
  const id = ++activation;
  const pending = waiting.get(scope) ?? [];
  pending.push(...beforeScope);
  waiting.set(scope, pending);
  beforeScope = [];
  writable = true;
  publish({ scope, ledger: createEmptyBadgeLedger(), ready: false });
  return open(scope, id, 0, pending);
}

function open(scope: BadgeScope, id: number, attempt: number, pending: Change[]): Promise<void> {
  const isCurrent = () => id === activation;
  // Changing accounts stops publication, not the original account's successful actions.
  // The array identity also fences retries after deletion or a test/runtime reset.
  const canContinue = () => !forgotten.has(scope) && waiting.get(scope) === pending
    && (isCurrent() || pending.length > 0);
  const retry = () => {
    const delay = READ_RETRY_MS[Math.min(attempt, READ_RETRY_MS.length - 1)];
    setTimeout(() => {
      if (canContinue()) void open(scope, id, attempt + 1, pending);
    }, delay);
  };
  writes = writes.catch(() => undefined).then(async () => {
    if (!canContinue()) return;
    let own: StoredLedger;
    let guest: StoredLedger;
    try {
      [own, guest] = await Promise.all([
        readLedger(scope),
        scope !== 'guest' && isCurrent() ? readLedger('guest') : { status: 'absent' as const },
      ]);
    } catch (error) {
      if (__DEV__) console.warn('[Badges] Failed to read the ledger', error);
      retry();
      return;
    }
    if (!canContinue()) return;
    const canWrite = own.status !== 'unreadable';
    if (isCurrent()) writable = canWrite;
    let ledger = own.status === 'read' ? own.ledger : createEmptyBadgeLedger();
    // A retry after a failed initial write must retain subsequent in-memory actions too.
    if (snapshot.scope === scope && snapshot.ready) ledger = mergeBadgeLedgers(ledger, snapshot.ledger);
    // A guest's actions join the first account that opens; what its journal told does not,
    // since the account reads its own journal again.
    const guestLedger = isCurrent() && canWrite && guest.status === 'read' ? guest.ledger : null;
    const claimedGuest = guestLedger !== null;
    if (guestLedger) ledger = mergeBadgeLedgers(ledger, actionsOnly(guestLedger));
    const initial = ledger;
    const pendingCount = pending.length;
    for (const change of pending.slice(0, pendingCount)) ledger = change(ledger);
    if (isCurrent()) publish({ scope, ledger, ready: true });
    const legacy = own.status === 'read' && own.legacy === true;
    if (canWrite && (ledger !== initial || claimedGuest || legacy || pendingCount > 0)) {
      await getLucidKeyValueStorage().setItem(storageKey(scope), JSON.stringify(ledger));
    }
    if (canWrite) pending.splice(0, pendingCount);
    // Claimed once: neither key may hand the guest's actions to another account.
    if (claimedGuest) await removeLedger('guest');
  }).catch((error) => {
    if (__DEV__) console.warn('[Badges] Failed to open the ledger', error);
    if (canContinue()) retry();
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
    waiting.get(scope)?.push(update);
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
  // A change waiting for the ledger keeps a dream's names only, never its words.
  const kept: BadgeEvent = 'dream' in event ? { ...event, dream: dreamRef(event.dream) } : event;
  change((ledger) => stampActionTiers(applyBadgeEvent(ledger, kept), now));
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
  waiting.clear();
  forgotten.clear();
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

/** Merge only into the same still-active account; late remote responses cannot leak. */
export function mergeRemoteBadgeLedger(scope: BadgeScope, remote: BadgeLedger): void {
  if (snapshot.scope !== scope || !snapshot.ready) return;
  change((ledger) => mergeBadgeLedgers(ledger, remote));
}

/** Local completion after confirmed account deletion; remote rows cascade with auth.users. */
export async function forgetBadgeLedger(userId: string): Promise<void> {
  const scope: BadgeScope = `user:${userId}`;
  forgotten.add(scope);
  waiting.delete(scope);
  if (snapshot.scope === scope) {
    activation += 1;
    beforeScope = [];
    publish({ scope: null, ledger: createEmptyBadgeLedger(), ready: false });
  }
  writes = writes.catch(() => undefined).then(() => removeLedger(scope));
  await writes;
}

async function removeLedger(scope: BadgeScope): Promise<void> {
  const storage = getLucidKeyValueStorage();
  await storage.removeItem(storageKey(scope));
  await storage.removeItem(legacyKey(scope));
}
