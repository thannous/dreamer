/** Durable account copy. Only badge identities, counts and dates leave the device. */
import { mergeBadgeLedgers, parseBadgeLedger, settleBadgeLedger, type BadgeLedger } from '@/lib/badges/ledger';
import { supabase } from '@/lib/supabase';

export type RemoteBadgeLedger = { ledger: BadgeLedger; revision: number; accepted: boolean };
export type BadgeLedgerTransport = {
  exchange(userId: string, revision: number | null, ledger: BadgeLedger | null): Promise<RemoteBadgeLedger>;
};

export const badgeLedgerTransport: BadgeLedgerTransport = {
  async exchange(userId, revision, ledger) {
    // Binding the expected user in SQL closes the getSession -> RPC account-switch race.
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 15_000);
    try {
      const { data, error } = await supabase.rpc('sync_badge_ledger', {
        p_user_id: userId, p_revision: revision, p_ledger: ledger,
      }).abortSignal(abort.signal);
      if (error) throw error;
      if (!data || !Number.isSafeInteger(data.revision) || data.revision < 0 ||
          typeof data.accepted !== 'boolean' || data.ledger?.version !== 1) {
        throw new Error('Invalid badge sync response');
      }
      return { ...data, ledger: parseBadgeLedger(data.ledger) };
    } finally {
      clearTimeout(timer);
    }
  },
};

/**
 * Optimistic compare-and-swap prevents concurrent devices overwriting each other.
 * A lost acknowledgement is harmless: the next attempt unions the same facts.
 * No persistent outbox is needed: the entire local ledger is the durable pending state.
 */
export async function synchronizeBadgeLedger(
  userId: string,
  local: BadgeLedger,
  transport: BadgeLedgerTransport = badgeLedgerTransport,
  isCurrent: () => boolean = () => true,
): Promise<BadgeLedger | null> {
  let remote = await transport.exchange(userId, null, null);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (!isCurrent()) return null;
    const merged = settleBadgeLedger(mergeBadgeLedgers(remote.ledger, local), [], Date.now());
    // The merge returns its base when every local fact is already on the server.
    if (merged === remote.ledger) return merged;
    remote = await transport.exchange(userId, remote.revision, merged);
    if (remote.accepted) return isCurrent() ? remote.ledger : null;
  }
  throw new Error('Badge sync contention; retry later');
}
