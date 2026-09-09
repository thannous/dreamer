import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { Platform } from 'react-native';
import type { ProductOAuthStorage, ProductOAuthTokens } from './productOAuthSession';
import { getLucidKeyValueStorage, isLucidNativeKeyValueStorage, type LucidKeyValueStorage } from './lucidKeyValueStorage';
import { isLucidTrainerEncryptedValue, protectLucidTrainerStoredValue, revealLucidTrainerStoredValue } from './lucidTrainerSecureStorage';

const locks = new Map<string, Promise<unknown>>();
const unavailable = () => new Error('Secure product session storage unavailable');
function serialized<T>(key: string, run: () => Promise<T>): Promise<T> {
  const task = (locks.get(key) ?? Promise.resolve()).then(run, run);
  const settled = task.catch(() => undefined); locks.set(key, settled);
  void settled.then(() => { if (locks.get(key) === settled) locks.delete(key); });
  return task;
}
function parseTokens(value: unknown): ProductOAuthTokens {
  const item = value as ProductOAuthTokens;
  if (!item || typeof item !== 'object' || Array.isArray(item) ||
    typeof item.accessToken !== 'string' || !item.accessToken || item.accessToken.length > 100_000 ||
    typeof item.refreshToken !== 'string' || !item.refreshToken || item.refreshToken.length > 100_000 ||
    !Number.isFinite(item.expiresAt) || item.expiresAt <= 0) throw unavailable();
  return { accessToken: item.accessToken, refreshToken: item.refreshToken, expiresAt: item.expiresAt };
}
/** One protected KV value atomically replaces the previous token pair. Never falls back to plaintext. */
export async function createProductOAuthNativeStorage(input: { issuerOrigin: string; clientId: string }, injected?: {
  storage: LucidKeyValueStorage; isNative(): boolean;
  hash(value: string): Promise<string>;
  protect(key: string, value: string): Promise<string>;
  reveal(key: string, value: string): Promise<string>;
  isProtected(value: string): boolean;
}): Promise<ProductOAuthStorage> {
  const origin = new URL(input.issuerOrigin);
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/' ||
    !input.clientId || input.clientId.length > 256 || /[\u0000-\u0020\u007f]/.test(input.clientId) ||
    (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(origin.hostname)))) throw unavailable();
  // Avoid even resolving the web adapter. Device-key availability is enforced by
  // protect/reveal's existing SecureStore helper; empty reads need no key creation.
  if (!injected && Platform.OS === 'web') throw unavailable();
  const storage = injected?.storage ?? getLucidKeyValueStorage();
  if (!(injected ? injected.isNative() : isLucidNativeKeyValueStorage(storage))) throw unavailable();
  const scope = JSON.stringify([origin.origin, input.clientId]);
  const digest = await (injected?.hash ?? (value => digestStringAsync(CryptoDigestAlgorithm.SHA256, value)))(scope);
  if (!/^[a-f0-9]{64}$/i.test(digest)) throw unavailable();
  const key = `noctalia_product_oauth:v1:${digest.toLowerCase()}`;
  const protect = injected?.protect ?? protectLucidTrainerStoredValue;
  const reveal = injected?.reveal ?? revealLucidTrainerStoredValue;
  const isProtected = injected?.isProtected ?? isLucidTrainerEncryptedValue;
  const run = <T>(action: () => Promise<T>) => serialized(key, async () => {
    try { return await action(); } catch { throw unavailable(); }
  });
  return {
    load: () => run(async () => {
      const raw = await storage.getItem(key); if (raw === null) return null;
      if (!isProtected(raw)) throw unavailable();
      const envelope = JSON.parse(await reveal(key, raw));
      if (!envelope || envelope.version !== 1 || envelope.scope !== scope) throw unavailable();
      return parseTokens(envelope.tokens);
    }),
    save: async value => {
      // Snapshot before awaiting the lock: caller mutation cannot alter a queued write.
      const copy = parseTokens(value);
      return run(async () => {
        const raw = await protect(key, JSON.stringify({ version: 1, scope, tokens: copy }));
        if (!isProtected(raw)) throw unavailable();
        await storage.setItem(key, raw);
      });
    },
    remove: () => run(() => storage.removeItem(key)),
  };
}
