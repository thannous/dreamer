import { useEffect, useRef, useState } from 'react';
import { getSupabasePublicConfiguration } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import {
  createNativeLucidJournalImportRuntime,
  type JournalImportCopyAction,
  type JournalImportPerimeter,
  type LucidJournalImportRuntime,
  type LucidJournalImportRuntimeState,
} from '@/services/lucidJournalImportRuntime';

const INITIAL: LucidJournalImportRuntimeState = {
  status: 'idle', preparation: null, snapshot: null, progress: null, errorCode: null,
};

// Shared across route remounts: old credentials must be erased before a new runtime starts.
let credentialTeardown: Promise<void> = Promise.resolve();

/** Mounting inspects local copies only; remote authorization starts with prepare. */
export function useLucidJournalImport() {
  const { user } = useAuth();
  const { userScope } = useLucidTrainer();
  const ownerKey = JSON.stringify([userScope, user?.id ?? null]);
  const owner = useRef({ key: ownerKey, scope: userScope, userId: user?.id ?? null, generation: 0 });
  if (owner.current.key !== ownerKey) {
    owner.current = { key: ownerKey, scope: userScope, userId: user?.id ?? null, generation: owner.current.generation + 1 };
  }
  const runtime = useRef<{ key: string; value: LucidJournalImportRuntime } | null>(null);
  const [view, setView] = useState({ key: ownerKey, state: INITIAL, available: false, remoteAvailable: false });
  useEffect(() => {
    let active = true;
    let instance: LucidJournalImportRuntime | null = null;
    let unsubscribe: (() => void) | undefined;
    const publish = () => {
      if (active && owner.current.key === ownerKey && instance) {
        setView({ key: ownerKey, state: instance.getState(), available: true, remoteAvailable: instance.canPrepare() });
      }
    };
    const previousTeardown = credentialTeardown;
    const creation = previousTeardown.then(() => createNativeLucidJournalImportRuntime({
      ...(getSupabasePublicConfiguration() ?? {}),
      getOwner: () => owner.current.userId,
      getOwnerGeneration: () => String(owner.current.generation),
    }));
    void creation.then(async created => {
      instance = created;
      if (!active || owner.current.key !== ownerKey) return;
      runtime.current = { key: ownerKey, value: created };
      unsubscribe = created.subscribe(publish);
      publish();
      await created.inspectLocal();
      publish();
    }).catch(() => {
      if (active && owner.current.key === ownerKey) {
        setView({ key: ownerKey, state: { ...INITIAL, status: 'error', errorCode: 'unavailable' }, available: !!instance, remoteAvailable: instance?.canPrepare() ?? false });
      }
    });
    return () => {
      active = false;
      unsubscribe?.();
      if (runtime.current?.key === ownerKey) runtime.current = null;
      credentialTeardown = creation.then(created => created.dispose(), () => previousTeardown);
      void credentialTeardown.catch(() => undefined);
    };
  }, [ownerKey]);

  const run = async (action: (engine: LucidJournalImportRuntime) => Promise<unknown>) => {
    const current = runtime.current;
    if (!current || current.key !== ownerKey || owner.current.key !== ownerKey) return false;
    try { await action(current.value); return true; } catch { return false; /* Runtime publishes a safe error code. */ }
  };
  const current = view.key === ownerKey ? view : { state: INITIAL, available: false, remoteAvailable: false };
  return {
    state: current.state, available: current.available, remoteAvailable: current.remoteAvailable, signedIn: !!user,
    prepare: (perimeter: JournalImportPerimeter) => run(engine => engine.prepare(perimeter)),
    confirmStart: () => run(engine => engine.confirmStart()),
    inspectLocal: () => run(engine => engine.inspectLocal()),
    updateCopy: (identity: string, action: JournalImportCopyAction) => run(engine => engine.updateCopy(identity, action)),
    deleteAll: () => run(engine => engine.deleteAll()),
    cancel: () => run(engine => engine.cancel()),
  };
}
