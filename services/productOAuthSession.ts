/** An opt-in product session. Never reads or replaces the legacy Supabase session. */
export type OAuthProduct = 'journal' | 'lucid';
export interface ProductOAuthTokens { accessToken: string; refreshToken: string; expiresAt: number }
export interface ProductOAuthIdentity { userId: string; clientId: string; product: OAuthProduct }
export interface ProductOAuthTransport {
  exchange(input: { code: string; verifier: string; redirectUri: string; clientId: string }): Promise<ProductOAuthTokens>;
  refresh(input: { refreshToken: string; clientId: string }): Promise<ProductOAuthTokens>;
  /** Must verify this exact bearer with the issuer and server product mapping. */
  verify(accessToken: string): Promise<ProductOAuthIdentity>;
  logout(accessToken: string): Promise<void>;
}
export interface ProductOAuthStorage {
  /** Dedicated secure key, separate from legacy auth; writes must be atomic. */
  load(): Promise<ProductOAuthTokens | null>;
  save(tokens: ProductOAuthTokens): Promise<void>;
  remove(): Promise<void>;
}
export interface ProductOAuthAuthority extends ProductOAuthIdentity { sessionGeneration: string }
const fail = () => new Error('Product session unavailable');
function tokens(value: ProductOAuthTokens, now: number): ProductOAuthTokens {
  if (!value || typeof value.accessToken !== 'string' || !value.accessToken ||
    typeof value.refreshToken !== 'string' || !value.refreshToken ||
    !Number.isFinite(value.expiresAt) || value.expiresAt <= now) throw fail();
  return { ...value };
}
export function createProductOAuthSession(deps: {
  authorizationEndpoint: string; clientId: string; product: OAuthProduct; redirectUri: string;
  getExpectedOwner(): string | null;
  /** Changes on every owner-auth transition, including A -> B -> A. */
  getOwnerGeneration(): string;
  storage: ProductOAuthStorage; transport: ProductOAuthTransport;
  /** Cryptographically secure base64url output, without padding. */
  randomBase64Url(bytes: number): string;
  sha256Base64Url(value: string): Promise<string>;
  now(): number;
}) {
  const endpoint = new URL(deps.authorizationEndpoint);
  const redirect = new URL(deps.redirectUri);
  if (!deps.clientId || endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
    (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && ['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname))) ||
    redirect.username || redirect.password || redirect.search || redirect.hash ||
    ['javascript:', 'data:', 'file:'].includes(redirect.protocol)) throw fail();
  let epoch = 0;
  let ownerGeneration = deps.getOwnerGeneration();
  let marker = deps.randomBase64Url(32);
  let current: { tokens: ProductOAuthTokens; identity: ProductOAuthIdentity } | null = null;
  let attempt: { state: string; verifier: string; owner: string; epoch: number; expiry: number } | null = null;
  let tail: Promise<unknown> = Promise.resolve();
  let refreshing: Promise<string> | null = null;
  const serial = <T>(run: () => Promise<T>): Promise<T> => {
    const pending = tail.then(run, run); tail = pending.catch(() => undefined); return pending;
  };
  const guard = (version: number, owner: string) => {
    if (epoch !== version || !owner || !ownerGeneration || deps.getOwnerGeneration() !== ownerGeneration || deps.getExpectedOwner() !== owner) throw fail();
  };
  const invalidate = () => {
    epoch++; ownerGeneration = deps.getOwnerGeneration(); marker = deps.randomBase64Url(32); current = null; attempt = null; refreshing = null;
  };
  const remove = async () => { try { await deps.storage.remove(); } catch { throw fail(); } };
  const publish = async (raw: ProductOAuthTokens, version: number, owner: string) => {
    guard(version, owner);
    const next = tokens(raw, deps.now());
    const identity = await deps.transport.verify(next.accessToken);
    guard(version, owner);
    if (identity.userId !== owner || identity.clientId !== deps.clientId || identity.product !== deps.product) throw fail();
    await deps.storage.save(next);
    guard(version, owner);
    if (next.expiresAt <= deps.now()) throw fail();
    current = { tokens: next, identity: { ...identity } };
    return next.accessToken;
  };
  const protectedRun = async <T>(run: () => Promise<T>): Promise<T> => {
    try { return await run(); } catch {
      current = null;
      // Serialized with all writes: failed/late saves cannot survive a completed cancellation.
      await remove();
      throw fail();
    }
  };
  return {
    async begin(): Promise<string> {
      invalidate();
      const version = epoch, owner = deps.getExpectedOwner();
      return serial(() => protectedRun(async () => {
        await remove(); if (!owner) throw fail(); guard(version, owner);
        const state = deps.randomBase64Url(32), verifier = deps.randomBase64Url(48);
        if (!/^[A-Za-z0-9_-]{43,128}$/.test(verifier) || !/^[A-Za-z0-9_-]{32,128}$/.test(state)) throw fail();
        const challenge = await deps.sha256Base64Url(verifier); guard(version, owner);
        if (!/^[A-Za-z0-9_-]{43}$/.test(challenge)) throw fail();
        attempt = { state, verifier, owner, epoch: version, expiry: deps.now() + 5 * 60_000 };
        const url = new URL(deps.authorizationEndpoint);
        url.search = new URLSearchParams({ client_id: deps.clientId, redirect_uri: deps.redirectUri,
          response_type: 'code', scope: 'email', state, code_challenge: challenge, code_challenge_method: 'S256' }).toString();
        return url.toString();
      }));
    },
    complete(callback: string): Promise<string> {
      const pending = attempt; attempt = null; // Single use, including malformed callbacks.
      return serial(() => protectedRun(async () => {
        if (!pending || pending.expiry <= deps.now()) throw fail();
        guard(pending.epoch, pending.owner);
        const url = new URL(callback);
        if (url.username || url.password || url.protocol !== redirect.protocol || url.host !== redirect.host || url.pathname !== redirect.pathname || url.hash ||
          url.searchParams.getAll('state').length !== 1 || url.searchParams.get('state') !== pending.state ||
          url.searchParams.has('error') || url.searchParams.getAll('code').length !== 1 || !url.searchParams.get('code')) throw fail();
        const result = await deps.transport.exchange({ code: url.searchParams.get('code')!, verifier: pending.verifier,
          redirectUri: deps.redirectUri, clientId: deps.clientId });
        return publish(result, pending.epoch, pending.owner);
      }));
    },
    restore(): Promise<void> {
      invalidate(); const version = epoch, owner = deps.getExpectedOwner();
      return serial(() => protectedRun(async () => {
        if (!owner) throw fail(); guard(version, owner);
        const saved = await deps.storage.load(); guard(version, owner);
        if (!saved) return;
        if (typeof saved.accessToken !== 'string' || !saved.accessToken || typeof saved.refreshToken !== 'string' ||
          !saved.refreshToken || !Number.isFinite(saved.expiresAt)) throw fail();
        const fresh = saved.expiresAt > deps.now() + 30_000 ? saved :
          await deps.transport.refresh({ refreshToken: saved.refreshToken, clientId: deps.clientId });
        await publish(fresh, version, owner);
      }));
    },
    getAuthority(): ProductOAuthAuthority | null {
      if (!current || deps.getOwnerGeneration() !== ownerGeneration || deps.getExpectedOwner() !== current.identity.userId || current.tokens.expiresAt <= deps.now()) return null;
      return { ...current.identity, sessionGeneration: marker };
    },
    getAccessToken(): Promise<string> {
      if (!current || deps.getOwnerGeneration() !== ownerGeneration || deps.getExpectedOwner() !== current.identity.userId) return Promise.reject(fail());
      if (current.tokens.expiresAt > deps.now() + 30_000) return Promise.resolve(current.tokens.accessToken);
      if (refreshing) return refreshing;
      const saved = current, version = epoch, owner = saved.identity.userId;
      const pending = serial(() => protectedRun(async () => {
        guard(version, owner);
        return publish(await deps.transport.refresh({ refreshToken: saved.tokens.refreshToken, clientId: deps.clientId }), version, owner);
      }));
      refreshing = pending;
      void pending.finally(() => { if (refreshing === pending) refreshing = null; }).catch(() => undefined);
      return pending;
    },
    cancel(): Promise<void> { invalidate(); return serial(remove); },
    logout(): Promise<void> {
      const bearer = current?.tokens.accessToken; invalidate();
      return serial(async () => {
        try { if (bearer) await deps.transport.logout(bearer); }
        catch { throw fail(); }
        finally { await remove(); }
      });
    },
  };
}

/** Explicit OAuth-server endpoints; legacy auth helpers deliberately are not imported. */
export function createProductOAuthHttpTransport(deps: {
  projectUrl: string; publicKey: string; fetch: typeof fetch; now(): number; allowLocalhost?: boolean;
}): ProductOAuthTransport {
  const base = new URL(deps.projectUrl);
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/' ||
    (base.protocol !== 'https:' && !(deps.allowLocalhost && base.protocol === 'http:' &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)))) throw fail();
  const origin = base.origin;
  const request = async (path: string, input: { bearer?: string; form?: Record<string, string>; json?: object; logout?: boolean } = {}) => {
    const abort = new AbortController(); const timeout = setTimeout(() => abort.abort(), 10_000);
    try {
      const response = await deps.fetch(origin + path, { method: input.form || input.json || input.logout ? 'POST' : 'GET',
        signal: abort.signal, redirect: 'error', headers: { apikey: deps.publicKey,
          ...(input.bearer ? { Authorization: `Bearer ${input.bearer}` } : {}),
          ...(input.form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
          ...(input.json ? { 'Content-Type': 'application/json' } : {}) },
        body: input.form ? new URLSearchParams(input.form).toString() : input.json ? JSON.stringify(input.json) : undefined });
      if (!response.ok) throw fail();
      return input.logout ? null : await response.json();
    } catch { throw fail(); } finally { clearTimeout(timeout); }
  };
  const decode = (bearer: string) => {
    try {
      const parts = bearer.split('.'); if (parts.length !== 3) throw fail();
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
    } catch { throw fail(); }
  };
  const exchange = async (form: Record<string, string>): Promise<ProductOAuthTokens> => {
    const value = await request('/auth/v1/oauth/token', { form });
    if (typeof value?.token_type !== 'string' || value.token_type.toLowerCase() !== 'bearer' || !Number.isFinite(value.expires_in) || value.expires_in <= 0) throw fail();
    const claims = decode(value.access_token);
    if (!Number.isFinite(claims.exp)) throw fail();
    return tokens({ accessToken: value.access_token, refreshToken: value.refresh_token,
      expiresAt: Math.min(claims.exp * 1000, deps.now() + value.expires_in * 1000) }, deps.now());
  };
  return {
    exchange: input => exchange({ grant_type: 'authorization_code', client_id: input.clientId,
      code: input.code, code_verifier: input.verifier, redirect_uri: input.redirectUri }),
    refresh: input => exchange({ grant_type: 'refresh_token', client_id: input.clientId, refresh_token: input.refreshToken }),
    async verify(accessToken) {
      const user = await request('/auth/v1/user', { bearer: accessToken });
      // /user just verified this exact bearer. Decoding is only extracting its signed
      // client claim, never a substitute for issuer verification or server policy.
      const claims = decode(accessToken);
      if (!user?.id || claims.sub !== user.id || claims.iss !== origin + '/auth/v1' ||
        !Number.isFinite(claims.exp) || claims.exp * 1000 <= deps.now() || claims.aud !== 'authenticated' || typeof claims.client_id !== 'string' || !claims.client_id) throw fail();
      const product = await request('/rest/v1/rpc/current_app_product', { bearer: accessToken, json: {} });
      if (product !== 'journal' && product !== 'lucid') throw fail();
      return { userId: user.id, clientId: claims.client_id, product };
    },
    async logout(accessToken) { await request('/auth/v1/logout?scope=local', { bearer: accessToken, logout: true }); },
  };
}
