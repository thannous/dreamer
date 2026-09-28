/** Transient failures only: bounded, expiring and scoped to the active account. */
export function createThumbnailFailureCache({ now = Date.now, ttlMs = 30_000, capacity = 256 } = {}) {
  let owner: string | null = null;
  const entries = new Map<string, number>();
  const prune = () => {
    for (const [key, expiry] of entries) if (expiry <= now()) entries.delete(key);
  };
  return {
    ttlMs,
    setScope(scope: string | null) { if (scope !== owner) { entries.clear(); owner = scope; } },
    has(scope: string | null, key: string) { prune(); return owner === scope && entries.has(key); },
    record(scope: string | null, key: string) {
      if (scope !== owner || !key) return;
      prune(); entries.delete(key); entries.set(key, now() + ttlMs);
      while (entries.size > capacity) entries.delete(entries.keys().next().value!);
    },
    remove(scope: string | null, key: string) { if (scope === owner) entries.delete(key); },
    clear() { entries.clear(); },
  };
}
export const thumbnailFailures = createThumbnailFailureCache();
