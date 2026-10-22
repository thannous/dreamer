/**
 * The badge ledger of the signed-in dreamer (or the guest), kept on this device.
 *
 * One ledger per scope, as the journal itself: `guest` or `user:<id>`. A guest's ledger is
 * joined once to the first account that opens after it, the same way its dreams move there,
 * and is then forgotten. Writes are serialized, so two actions finishing together both count.
 * Actions recorded before the ledger is read wait for it instead of being lost.
 */
import { useSyncExternalStore } from 'react';

import type { BadgeFamilyId } from '@/lib/badges/catalog';
import {
  applyBadgeEvent,
  createEmptyBadgeLedger,
  mergeBadgeLedgers,
  parseBadgeLedger,
  revealBadgeFamily,
  settleBadgeLedger,
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

async function readLedger(scope: BadgeScope): Promise<BadgeLedger | null> {
  const raw = await getLucidKeyValueStorage().getItem(storageKey(scope));
  if (!raw) return null;
  try {
    return parseBadgeLedger(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Queues a write behind the previous ones; a failed write never blocks the next. */
function persist(scope: BadgeScope, ledger: BadgeLedger): Promise<void> {
  writes = writes
    .catch(() => undefined)
    .then(() => getLucidKeyValueStorage().setItem(storageKey(scope), JSON.stringify(ledger)))
    .catch((error) => {
      if (__DEV__) console.warn('[Badges] Failed to save the ledger', error);
    });
  return writes;
}

/** Opens the scope's ledger. Changes made meanwhile are applied once it is read. */
export function activateBadgeScope(scope: BadgeScope): Promise<void> {
  if (snapshot.scope === scope) return writes;
  const id = ++activation;
  waiting = beforeScope;
  beforeScope = [];
  publish({ scope, ledger: createEmptyBadgeLedger(), ready: false });
  writes = writes.catch(() => undefined).then(async () => {
    let ledger = createEmptyBadgeLedger();
    let claimedGuest = false;
    try {
      ledger = (await readLedger(scope)) ?? ledger;
      if (scope !== 'guest') {
        const guest = await readLedger('guest');
        if (guest) {
          ledger = mergeBadgeLedgers(ledger, guest);
          claimedGuest = true;
        }
      }
    } catch (error) {
      if (__DEV__) console.warn('[Badges] Failed to read the ledger', error);
    }
    if (id !== activation) return;
    const initial = ledger;
    for (const change of waiting) ledger = change(ledger);
    waiting = [];
    publish({ scope, ledger, ready: true });
    if (ledger !== initial || claimedGuest) {
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
  change((ledger) => applyBadgeEvent(ledger, event));
}

/** Folds the journal as it is now into the ledger, stamping any tier newly reached. */
export function settleBadges(dreams: readonly DreamAnalysis[], now = Date.now()): void {
  change((ledger) => settleBadgeLedger(ledger, dreams, now));
}

/** The collection has unveiled this family's earned tiers. */
export function markBadgeFamilyRevealed(id: BadgeFamilyId): void {
  change((ledger) => revealBadgeFamily(ledger, id));
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getSnapshot = () => snapshot;

export function useBadgeLedger(): BadgeLedgerSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Test-only: forgets the in-memory ledger and pending work. */
export function resetBadgeLedgerStoreForTests(): void {
  activation += 1;
  waiting = [];
  beforeScope = [];
  writes = Promise.resolve();
  snapshot = { scope: null, ledger: createEmptyBadgeLedger(), ready: false };
  listeners.clear();
}

/** Test-only: resolves once every queued read and write has finished. */
export function flushBadgeLedgerWritesForTests(): Promise<void> {
  return writes;
}
