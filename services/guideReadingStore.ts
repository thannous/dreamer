import { useSyncExternalStore } from 'react';
import { isMockModeEnabled } from '@/lib/env';
import type { DreamGuideId } from '@/lib/dreamGuideTypes';
import { GUIDE_READING_IDS, mergeGuideReading, parseGuideReading, type GuideReadingEntries, type GuideReadingScope } from '@/lib/guideReading';
import { getLucidKeyValueStorage } from '@/services/lucidKeyValueStorage';
import { readRemoteGuideReading, writeRemoteGuideReading } from '@/services/guideReadingRemote';

export const guideReadingStorageKey = (scope: GuideReadingScope) => `noctalia_guide_reading_v1:${scope}`;
type Snapshot = { scope: GuideReadingScope | null; ready: boolean; entries: GuideReadingEntries; saving: boolean; error: boolean };
const empty: Snapshot = { scope: null, ready: false, entries: {}, saving: false, error: false };
let snapshot = empty;
let generation = 0;
const forgotten = new Set<GuideReadingScope>();
let queue: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();
const publish = (next: Snapshot) => { snapshot = next; listeners.forEach(listener => listener()); };
const active = (scope: GuideReadingScope, token: number) => snapshot.scope === scope && token === generation;
const enqueue = (work: () => Promise<void>) => { queue = queue.catch(() => undefined).then(work); return queue; };
const persist = (scope: GuideReadingScope, entries: GuideReadingEntries) => forgotten.has(scope) ? Promise.resolve() : getLucidKeyValueStorage()
  .setItem(guideReadingStorageKey(scope), JSON.stringify(entries));

export function activateGuideReadingScope(scope: GuideReadingScope, options?: { transferGuest?: boolean }): Promise<void> {
  if (forgotten.has(scope)) return Promise.resolve();
  if (snapshot.scope === scope && snapshot.ready) return Promise.resolve();
  if (snapshot.scope === scope) return queue;
  const transferGuest = scope !== 'guest' && (options?.transferGuest ?? snapshot.scope === 'guest');
  const token = ++generation;
  publish({ ...empty, scope });
  return enqueue(async () => {
    try {
      const storage = getLucidKeyValueStorage();
      const guestRaw = await storage.getItem(guideReadingStorageKey('guest'));
      const guest = guestRaw ? JSON.parse(guestRaw) as Record<string, unknown> : null;
      let claim = typeof guest?.__claimOwner === 'string' && guest.__claimOwner.startsWith('user:')
        ? guest.__claimOwner as GuideReadingScope : null;
      if (guest && !claim && transferGuest) {
        // Reserve ownership before writing the account. A failed/interrupted transfer cannot give it to account B.
        claim = scope;
        await storage.setItem(guideReadingStorageKey('guest'), JSON.stringify({ ...guest, __claimOwner: claim }));
      }
      if (guest && claim) {
        if (!forgotten.has(claim)) {
          const ownerRaw = await storage.getItem(guideReadingStorageKey(claim));
          await persist(claim, mergeGuideReading(ownerRaw ? parseGuideReading(JSON.parse(ownerRaw)) : {}, parseGuideReading(guest)));
        }
        // A subsequent scope can finish this local transfer for its reserved owner, without seeing the contents.
        await storage.removeItem(guideReadingStorageKey('guest'));
      }
      const raw = await storage.getItem(guideReadingStorageKey(scope));
      const entries = raw ? parseGuideReading(JSON.parse(raw)) : {};
      if (active(scope, token)) publish({ ...snapshot, ready: true, entries });
    } catch {
      // Leave mutations disabled when local data cannot be read: never overwrite it with an empty collection.
      if (active(scope, token)) publish({ ...snapshot, error: true });
    }
  });
}

export function syncGuideReading(scope: GuideReadingScope): Promise<void> {
  const token = generation;
  return enqueue(async () => {
    if (!active(scope, token) || !snapshot.ready) return;
    publish({ ...snapshot, saving: true, error: false });
    try {
      await persist(scope, snapshot.entries);
      if (scope !== 'guest' && !isMockModeEnabled()) {
        const userId = scope.slice(5);
        const remote = await readRemoteGuideReading(userId);
        if (!active(scope, token)) return;
        publish({ ...snapshot, entries: mergeGuideReading(snapshot.entries, remote) });
        await persist(scope, snapshot.entries);
        // At most eight small records. Every response is merged with actions taken while awaiting it.
        for (const id of GUIDE_READING_IDS) {
          if (!active(scope, token)) return;
          const entry = snapshot.entries[id];
          if (!entry) continue;
          const saved = await writeRemoteGuideReading(userId, id, entry);
          if (!active(scope, token)) return;
          publish({ ...snapshot, entries: mergeGuideReading(snapshot.entries, saved) });
          await persist(scope, snapshot.entries);
        }
      }
      if (active(scope, token)) publish({ ...snapshot, saving: false });
    } catch {
      // Missing migration/offline/auth change keeps the account's local progress for an explicit or foreground retry.
      if (active(scope, token)) publish({ ...snapshot, saving: false, error: true });
    }
  });
}

export function updateGuideReading(scope: GuideReadingScope, id: DreamGuideId, section: number, complete = false): boolean {
  if (snapshot.scope !== scope || !snapshot.ready || !GUIDE_READING_IDS.includes(id)) return false;
  const previous = snapshot.entries[id];
  const bounded = Math.max(0, Math.min(100, Math.floor(section)));
  if (previous && previous.section === bounded && (!complete || previous.completedAt)) return true;
  if (previous && previous.section > 0 && bounded === 0 && !complete) return true;
  const now = Math.max(Date.now(), (previous?.updatedAt ?? 0) + 1);
  const entry = { section: bounded || previous?.section || 0, updatedAt: now,
    ...(previous?.completedAt || complete ? { completedAt: previous?.completedAt ?? now } : {}) };
  publish({ ...snapshot, entries: { ...snapshot.entries, [id]: entry } });
  const token = generation;
  const entries = snapshot.entries;
  // A sign-out must not discard an action already made for the old scope.
  void enqueue(async () => {
    try { await persist(scope, active(scope, token) ? snapshot.entries : entries); }
    catch { if (active(scope, token)) publish({ ...snapshot, error: true }); }
  });
  if (complete) void syncGuideReading(scope);
  return true;
}

/** Called only after successful account deletion, never on sign-out. */
export function forgetGuideReading(userId: string): Promise<void> {
  const scope: GuideReadingScope = `user:${userId}`;
  forgotten.add(scope);
  if (snapshot.scope === scope) suspendGuideReadingScope();
  // Wait for already-started local writes, then remove. Future queued writes cannot recreate it.
  return enqueue(async () => {
    const storage = getLucidKeyValueStorage();
    await storage.removeItem(guideReadingStorageKey(scope));
    const guestRaw = await storage.getItem(guideReadingStorageKey('guest'));
    if (guestRaw && (JSON.parse(guestRaw) as Record<string, unknown>).__claimOwner === scope) {
      await storage.removeItem(guideReadingStorageKey('guest'));
    }
  });
}

export function suspendGuideReadingScope(): void {
  generation += 1;
  publish(empty);
}
export function retryGuideReading(scope: GuideReadingScope): Promise<void> {
  if (!snapshot.ready && snapshot.scope === scope) suspendGuideReadingScope();
  return activateGuideReadingScope(scope).then(() => syncGuideReading(scope));
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useGuideReadingSnapshot(): Snapshot { return useSyncExternalStore(subscribe, () => snapshot, () => snapshot); }
export function flushGuideReadingForTests(): Promise<void> { return queue; }
export function resetGuideReadingForTests(): void { suspendGuideReadingScope(); queue = Promise.resolve(); forgotten.clear(); listeners.clear(); }
