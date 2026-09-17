import { createProductOAuthSession, createProductOAuthHttpTransport, type ProductOAuthTokens } from '../productOAuthSession';
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
function fixture() {
  let now = 1000, owner: string | null = 'owner', saved: ProductOAuthTokens | null = null, random = 0, ownerGeneration = 0;
  const fresh = (accessToken = 'access') => ({ accessToken, refreshToken: 'refresh-' + accessToken, expiresAt: now + 60_000 });
  const storage = { load: jest.fn(async () => saved), save: jest.fn(async (value: ProductOAuthTokens) => { saved = value; }), remove: jest.fn(async () => { saved = null; }) };
  const transport = { exchange: jest.fn(async () => fresh()), refresh: jest.fn(async () => fresh('rotated')), verify: jest.fn(async () => ({ userId: 'owner', clientId: 'client', product: 'lucid' as const })), logout: jest.fn(async () => undefined) };
  const session = createProductOAuthSession({ authorizationEndpoint: 'https://project.test/auth/v1/oauth/authorize', clientId: 'client', product: 'lucid', redirectUri: 'noctalia-lucid://oauth/callback', getExpectedOwner: () => owner, getOwnerGeneration: () => String(ownerGeneration), storage, transport,
    randomBase64Url: () => String(++random).padStart(48, 'a'), sha256Base64Url: async () => 'b'.repeat(43), now: () => now });
  const callback = async () => { const url = new URL(await session.begin()); return `noctalia-lucid://oauth/callback?code=code&state=${url.searchParams.get('state')}`; };
  return { session, storage, transport, fresh, callback, advance: (ms: number) => { now += ms; }, owner: (value: string | null) => { owner = value; ownerGeneration++; }, saved: () => saved };
}
describe('isolated product session', () => {
  it('publishes only verified owner/client/product after durable save', async () => {
    const f = fixture(), callback = await f.callback(), blocked = deferred<void>();
    f.storage.save.mockImplementationOnce(async () => blocked.promise);
    const pending = f.session.complete(callback); await Promise.resolve(); await Promise.resolve();
    expect(f.session.getAuthority()).toBeNull(); blocked.resolve(); await pending;
    expect(f.session.getAuthority()).toMatchObject({ userId: 'owner', clientId: 'client', product: 'lucid' });
    expect(f.transport.exchange).toHaveBeenCalledWith(expect.objectContaining({ code: 'code', clientId: 'client', redirectUri: 'noctalia-lucid://oauth/callback' }));
  });
  it.each(['state=wrong', 'state=wrong&state=other'])('rejects invalid state without exchange (%s)', async query => {
    const f = fixture(); await f.callback(); await expect(f.session.complete(`noctalia-lucid://oauth/callback?code=x&${query}`)).rejects.toThrow('unavailable'); expect(f.transport.exchange).not.toHaveBeenCalled();
  });
  it('rejects exact callback mismatch and consumes attempt', async () => {
    const f = fixture(), callback = await f.callback(); await expect(f.session.complete(callback.replace('/callback', '/other'))).rejects.toThrow(); await expect(f.session.complete(callback)).rejects.toThrow(); expect(f.transport.exchange).not.toHaveBeenCalled();
  });
  it('rejects expired attempts and replay', async () => {
    const f = fixture(), callback = await f.callback(); f.advance(300_001); await expect(f.session.complete(callback)).rejects.toThrow();
    const next = await f.callback(); await f.session.complete(next); await expect(f.session.complete(next)).rejects.toThrow(); expect(f.transport.exchange).toHaveBeenCalledTimes(1);
  });
  it('refuses an implicit account switch', async () => {
    const f = fixture(), callback = await f.callback(); f.transport.verify.mockResolvedValueOnce({ userId: 'other', clientId: 'client', product: 'lucid' }); await expect(f.session.complete(callback)).rejects.toThrow(); expect(f.saved()).toBeNull();
  });
  it('cancels late exchange and never stores its tokens', async () => {
    const f = fixture(), callback = await f.callback(), exchange = deferred<ProductOAuthTokens>(); f.transport.exchange.mockReturnValueOnce(exchange.promise);
    const completing = f.session.complete(callback); await Promise.resolve(); const cancelled = f.session.cancel(); exchange.resolve(f.fresh());
    await expect(completing).rejects.toThrow(); await cancelled; expect(f.storage.save).not.toHaveBeenCalled(); expect(f.session.getAuthority()).toBeNull();
  });
  it('cleans an in-flight storage write before cancellation completes', async () => {
    const f = fixture(), callback = await f.callback(), writing = deferred<void>(), entered = deferred<void>();
    f.storage.save.mockImplementationOnce(async () => { entered.resolve(); await writing.promise; });
    const completing = f.session.complete(callback); await entered.promise; const cancelled = f.session.cancel(); writing.resolve();
    await expect(completing).rejects.toThrow(); await cancelled; expect(f.storage.remove).toHaveBeenCalled(); expect(f.session.getAuthority()).toBeNull();
  });
  it('serializes refresh and persists rotation before returning either caller', async () => {
    const f = fixture(); await f.session.complete(await f.callback()); f.advance(31_000);
    const [one,two] = await Promise.all([f.session.getAccessToken(),f.session.getAccessToken()]); expect(one).toBe('rotated'); expect(two).toBe(one); expect(f.transport.refresh).toHaveBeenCalledTimes(1); expect(f.saved()?.refreshToken).toBe('refresh-rotated');
  });
  it('fails closed when rotation persistence fails', async () => {
    const f = fixture(); await f.session.complete(await f.callback()); f.advance(31_000); f.storage.save.mockRejectedValueOnce(new Error('private storage detail'));
    await expect(f.session.getAccessToken()).rejects.toThrow('Product session unavailable'); expect(f.session.getAuthority()).toBeNull(); expect(f.saved()).toBeNull();
  });
  it('rejects account change during refresh', async () => {
    const f = fixture(); await f.session.complete(await f.callback()); f.advance(31_000); const refresh = deferred<ProductOAuthTokens>(); f.transport.refresh.mockReturnValueOnce(refresh.promise);
    const pending = f.session.getAccessToken(); await Promise.resolve(); f.owner('other'); refresh.resolve(f.fresh()); await expect(pending).rejects.toThrow(); expect(f.saved()).toBeNull();
  });
  it('rejects A -> B -> A during exchange using the owner generation', async () => {
    const f=fixture(), callback=await f.callback(), exchanging=deferred<ProductOAuthTokens>();f.transport.exchange.mockReturnValueOnce(exchanging.promise);
    const pending=f.session.complete(callback);await Promise.resolve();f.owner('other');f.owner('owner');exchanging.resolve(f.fresh());await expect(pending).rejects.toThrow();expect(f.storage.save).not.toHaveBeenCalled();
  });
  it('restores only after server verification and rejects wrong client', async () => {
    const f=fixture();await f.session.complete(await f.callback());await f.session.restore();expect(f.session.getAuthority()).not.toBeNull();
    f.transport.verify.mockResolvedValueOnce({userId:'owner',clientId:'wrong',product:'lucid'});await expect(f.session.restore()).rejects.toThrow();expect(f.saved()).toBeNull();
  });
  it('invalidates authority immediately and clears storage even when logout fails', async () => {
    const f = fixture(); await f.session.complete(await f.callback()); f.transport.logout.mockRejectedValueOnce(new Error('offline')); const logout = f.session.logout(); expect(f.session.getAuthority()).toBeNull(); await expect(logout).rejects.toThrow(); expect(f.saved()).toBeNull();
  });
});
it('HTTP adapter uses OAuth endpoints and server verification, without legacy fallback', async () => {
  const claims = btoa(JSON.stringify({sub:'owner',exp:61,client_id:'client',aud:'authenticated',iss:'https://project.test/auth/v1'})); const bearer = `x.${claims}.x`;
  const fetcher = jest.fn().mockResolvedValueOnce({ok:true,json:async()=>({access_token:bearer,refresh_token:'refresh',expires_in:60,token_type:'bearer'})}).mockResolvedValueOnce({ok:true,json:async()=>({id:'owner'})}).mockResolvedValueOnce({ok:true,json:async()=> 'lucid'});
  const adapter = createProductOAuthHttpTransport({projectUrl:'https://project.test',publicKey:'public',fetch:fetcher,now:()=>1000});
  const token = await adapter.refresh({refreshToken:'old',clientId:'client'}); expect(await adapter.verify(token.accessToken)).toEqual({userId:'owner',clientId:'client',product:'lucid'});
  expect(fetcher.mock.calls.map(call=>call[0])).toEqual(['https://project.test/auth/v1/oauth/token','https://project.test/auth/v1/user','https://project.test/rest/v1/rpc/current_app_product']);
  expect(fetcher.mock.calls[0][1].body).toBe('grant_type=refresh_token&client_id=client&refresh_token=old');
});
