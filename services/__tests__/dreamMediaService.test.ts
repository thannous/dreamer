import { createDreamMediaResolver, getDirectDreamMediaUrl } from '../dreamMediaService';

jest.mock('@/lib/supabase', () => ({ supabase: { storage: { from: jest.fn() } } }));

const ref = (path: string) => `supabase-storage://dream-images/${path}`;
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
function setup() {
  let time = 0;
  const sign = jest.fn(async (_bucket: string, paths: string[]) => ({
    data: paths.map(path => ({ path, signedUrl: `https://signed.test/${path}` })), error: null,
  }));
  const resolver = createDreamMediaResolver({ sign, now: () => time, storageOrigin: 'https://project.test' });
  resolver.setDreamMediaScope('A');
  return { resolver, sign, advance: (ms: number) => { time += ms; } };
}

describe('dream media resolver', () => {
  it.each([10, 100, 1000])('batches %i reference pairs with bounded cache', async count => {
    const { resolver, sign } = setup();
    const results = await Promise.all(Array.from({ length: count }, (_, i) => resolver.resolveDreamMedia({
      imageUrl: ref(`A/${i}.png`), thumbnailUrl: ref(`A/${i}-thumb.png`),
    }, 'A')));
    expect(results.every(result => result.imageStatus === 'ready' && result.thumbnailStatus === 'ready')).toBe(true);
    expect(sign).toHaveBeenCalledTimes(Math.ceil(count * 2 / 50));
    expect(sign.mock.calls.every(call => call[1].length <= 50)).toBe(true);
    expect(resolver.getDreamMediaMetrics().cacheEntries).toBe(Math.min(count * 2, 256));
  });

  it.each([10, 100, 1000])('deduplicates %i identical image/thumbnail pairs before batching', async count => {
    const { resolver, sign } = setup();
    await Promise.all(Array.from({ length: count }, (_, i) => resolver.resolveDreamMedia({
      imageUrl: ref(`A/${i}.png`), thumbnailUrl: ref(`A/${i}.png`),
    }, 'A')));
    expect(sign).toHaveBeenCalledTimes(Math.ceil(count / 50));
    expect(resolver.getDreamMediaMetrics().signedPaths).toBe(count);
  });

  it('does not start an old-account batch if scope changes in the dispatch microtask gap', async () => {
    const { resolver, sign } = setup();
    const result = resolver.resolveDreamMedia({ imageUrl: ref('A/a') }, 'A');
    // pump has reserved a batch, but its signer microtask has not run yet.
    await Promise.resolve();
    resolver.setDreamMediaScope('B');
    expect((await result).imageStatus).toBe('error');
    await flush();
    expect(sign).not.toHaveBeenCalled();
    expect(resolver.getDreamMediaMetrics().batches).toBe(0);
  });

  it('exposes only directly displayable values synchronously', () => {
    expect(getDirectDreamMediaUrl(ref('A/private'))).toBeUndefined();
    expect(getDirectDreamMediaUrl('https://cdn.test/image')).toBe('https://cdn.test/image');
    expect(getDirectDreamMediaUrl('file:///local.png')).toBe('file:///local.png');
    expect(getDirectDreamMediaUrl('bad value')).toBeUndefined();
  });

  it('rejects stale callers without switching the active account', async () => {
    const { resolver, sign } = setup();
    resolver.setDreamMediaScope('B');
    expect((await resolver.resolveDreamMedia({ imageUrl: ref('A/a') }, 'A')).imageStatus).toBe('error');
    expect(sign).not.toHaveBeenCalled();
    expect((await resolver.resolveDreamMedia({ imageUrl: ref('B/b') }, 'B')).imageStatus).toBe('ready');
    resolver.setDreamMediaScope(null);
    expect(resolver.getDreamMediaMetrics().cacheEntries).toBe(0);
  });

  it('deduplicates concurrent image/thumbnail requests and renews before expiry', async () => {
    const { resolver, sign, advance } = setup();
    const dream = { imageUrl: ref('A/a.png'), thumbnailUrl: ref('A/a.png') };
    await Promise.all([resolver.resolveDreamMedia(dream, 'A'), resolver.resolveDreamMedia(dream, 'A')]);
    expect(sign).toHaveBeenCalledTimes(1);
    expect(sign.mock.calls[0][1]).toEqual(['A/a.png']);
    await resolver.resolveDreamMedia(dream, 'A');
    expect(sign).toHaveBeenCalledTimes(1);
    advance(86_400_000 - 60_000);
    await resolver.resolveDreamMedia(dream, 'A');
    expect(sign).toHaveBeenCalledTimes(2);
  });

  it('returns the earliest private expiration, including cached resources', async () => {
    const { resolver, advance } = setup();
    const first = await resolver.resolveDreamMedia({ imageUrl: ref('A/a') }, 'A');
    expect(first.expiresAt).toBe(86_340_000);
    advance(1000);
    const mixed = await resolver.resolveDreamMedia({ imageUrl: ref('A/a'), thumbnailUrl: ref('A/b') }, 'A');
    expect(mixed.expiresAt).toBe(first.expiresAt);
    expect((await resolver.resolveDreamMedia({ imageUrl: 'https://cdn.test/a' }, 'A')).expiresAt).toBeUndefined();
  });

  it('limits in-flight batches to two', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const sign = jest.fn(async (_bucket: string, paths: string[]) => {
      await gate;
      return { data: paths.map(path => ({ path, signedUrl: `https://signed.test/${path}` })), error: null };
    });
    const resolver = createDreamMediaResolver({ sign });
    resolver.setDreamMediaScope('A');
    const promises = Array.from({ length: 120 }, (_, i) => resolver.resolveDreamMedia({ imageUrl: ref(`A/${i}`) }, 'A'));
    await flush();
    expect(sign).toHaveBeenCalledTimes(2);
    expect(resolver.getDreamMediaMetrics().activeBatches).toBe(2);
    release();
    await Promise.all(promises);
    expect(sign).toHaveBeenCalledTimes(3);
  });

  it.each(['B', null])('invalidates pending responses across A → %s → A', async intermediate => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const sign = jest.fn(async (_bucket: string, paths: string[]) => {
      await gate;
      return { data: paths.map(path => ({ path, signedUrl: 'https://old.test' })), error: null };
    });
    const resolver = createDreamMediaResolver({ sign });
    resolver.setDreamMediaScope('A');
    const old = resolver.resolveDreamMedia({ imageUrl: ref('A/a') }, 'A');
    await flush();
    resolver.setDreamMediaScope(intermediate);
    resolver.setDreamMediaScope('A');
    release();
    expect((await old).imageStatus).toBe('error');
    await flush();
    expect(resolver.getDreamMediaMetrics().cacheEntries).toBe(0);
  });

  it('handles partial failures without discarding successful image', async () => {
    const resolver = createDreamMediaResolver({ sign: async () => ({ data: [
      { path: 'A/a', signedUrl: 'https://signed.test/a' }, { path: 'A/b', error: 'missing' },
    ], error: null }) });
    resolver.setDreamMediaScope('A');
    expect(await resolver.resolveDreamMedia({ imageUrl: ref('A/a'), thumbnailUrl: ref('A/b') }, 'A')).toMatchObject({
      imageUrl: 'https://signed.test/a', thumbnailUrl: undefined, imageStatus: 'ready', thumbnailStatus: 'error',
    });
  });

  it('retries batch failures and never exposes private references', async () => {
    const { resolver, sign } = setup();
    sign.mockRejectedValueOnce(new Error('network'));
    expect((await resolver.resolveDreamMedia({ imageUrl: ref('A/a') }, 'A')).imageUrl).toBe('');
    expect((await resolver.resolveDreamMedia({ imageUrl: ref('A/a') }, 'A')).imageStatus).toBe('ready');
  });

  it('keeps external/local URLs, re-signs own URLs and rejects malformed/wrong-owner refs', async () => {
    const { resolver, sign } = setup();
    for (const imageUrl of ['https://cdn.test/a', 'file:///image.png', 'data:image/png;base64,AA']) {
      expect((await resolver.resolveDreamMedia({ imageUrl }, 'A')).imageUrl).toBe(imageUrl);
    }
    for (const imageUrl of [ref('A/%ZZ'), ref('B/a'), ref('A/../a'), 'supabase-storage://other/A/a']) {
      expect((await resolver.resolveDreamMedia({ imageUrl }, 'A')).imageStatus).toBe('error');
    }
    expect(sign).not.toHaveBeenCalled();
    await resolver.resolveDreamMedia({ imageUrl: 'https://project.test/storage/v1/object/sign/dream-images/A/a?token=expired' }, 'A');
    expect(sign.mock.calls[0][1]).toEqual(['A/a']);
  });

  it.each(['imageUpdatedAt', 'analysisRequestId', 'analyzedAt'] as const)('invalidates an in-flight same-path replacement using %s', async marker => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let calls = 0;
    const resolver = createDreamMediaResolver({ sign: async (_bucket, paths) => {
      const attempt = ++calls;
      if (attempt === 1) await gate;
      return { data: paths.map(path => ({ path, signedUrl: `https://signed.test/v${attempt}` })), error: null };
    } });
    resolver.setDreamMediaScope('A');
    const old = resolver.resolveDreamMedia({ imageUrl: ref('A/a'), [marker]: marker === 'analysisRequestId' ? 'request-1' : 1 }, 'A');
    await flush();
    const fresh = await resolver.resolveDreamMedia({ imageUrl: ref('A/a'), [marker]: marker === 'analysisRequestId' ? 'request-2' : 2 }, 'A');
    release();
    expect((await old).imageStatus).toBe('error');
    expect(fresh.imageUrl).toBe('https://signed.test/v2');
    expect((await resolver.resolveDreamMedia({ imageUrl: ref('A/a'), [marker]: marker === 'analysisRequestId' ? 'request-2' : 2 }, 'A')).imageUrl).toBe(fresh.imageUrl);
  });

  it('evicts least recently used entries and explicitly invalidates values', async () => {
    const { resolver, sign } = setup();
    await Promise.all(Array.from({ length: 256 }, (_, i) => resolver.resolveDreamMedia({ imageUrl: ref(`A/${i}`) }, 'A')));
    await resolver.resolveDreamMedia({ imageUrl: ref('A/0') }, 'A');
    await resolver.resolveDreamMedia({ imageUrl: ref('A/256') }, 'A');
    sign.mockClear();
    await resolver.resolveDreamMedia({ imageUrl: ref('A/0') }, 'A');
    expect(sign).not.toHaveBeenCalled();
    await resolver.resolveDreamMedia({ imageUrl: ref('A/1') }, 'A');
    expect(sign).toHaveBeenCalledTimes(1);
    resolver.invalidateDreamMedia(ref('A/0'));
    await resolver.resolveDreamMedia({ imageUrl: ref('A/0') }, 'A');
    expect(sign).toHaveBeenCalledTimes(2);
    resolver.invalidateDreamMedia();
    expect(resolver.getDreamMediaMetrics().cacheEntries).toBe(0);
  });
});
