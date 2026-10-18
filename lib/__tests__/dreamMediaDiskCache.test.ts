/** @jest-environment node */
// Failure model: a cold start re-signed every private image (one storage request per
// 50 paths, images blank until it returned) although expo-image already held the bytes
// on disk under the same account-scoped key. The E2E web journeys cannot see the native
// disk cache, so this counts storage requests directly.
const mockSign = jest.fn();
const mockCachePath = jest.fn();

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('expo-image', () => ({ Image: { getCachePathAsync: (key: string) => mockCachePath(key) } }));
jest.mock('@/lib/guestSession', () => ({ getGuestMediaOwner: async () => null }));
jest.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrls: (paths: string[], ttl: number) => mockSign(paths, ttl) }) } },
}));

const { resolveWithDiskCache } = require('@/lib/dreamMediaDiskCache');
const { resolveDreamMedia, setDreamMediaScope, invalidateDreamMedia } = require('@/services/dreamMediaService');

const dreams = Array.from({ length: 20 }, (_, index) => ({
  imageUrl: `supabase-storage://dream-images/user-1/dream-${index}.png`,
  thumbnailUrl: `supabase-storage://dream-images/user-1/dream-${index}-thumb.png`,
  analyzedAt: 1_000 + index,
}));
const signedPaths = () => mockSign.mock.calls.reduce((total, [paths]) => total + paths.length, 0);

beforeEach(() => {
  setDreamMediaScope(null);
  setDreamMediaScope('user-1');
  invalidateDreamMedia();
  mockSign.mockReset().mockImplementation(async (paths: string[]) => ({
    data: paths.map(path => ({ path, signedUrl: `https://project.supabase.co/storage/v1/object/sign/dream-images/${path}?token=t` })),
    error: null,
  }));
  mockCachePath.mockReset().mockResolvedValue(null);
});

it('signs every image on a cold start when nothing is on disk', async () => {
  const results = await Promise.all(dreams.map(dream => resolveWithDiskCache(dream, 'user-1', false)));
  expect(mockSign).toHaveBeenCalledTimes(1);
  expect(signedPaths()).toBe(40);
  expect(results.every((media: { imageUrl: string }) => media.imageUrl.startsWith('https://'))).toBe(true);
});

// The native image-cache and private signing path are not observable in the web
// journeys. Count authorized paths here; image loading/fallback stays an E2E check.
it('warms twenty thumbnails without signing twenty unused originals', async () => {
  const results = await Promise.all(dreams.map(dream => resolveWithDiskCache(dream, 'user-1', false, { variant: 'thumbnail' })));
  expect(mockSign).toHaveBeenCalledTimes(1);
  expect(signedPaths()).toBe(20);
  expect(mockSign.mock.calls[0][0].every((path: string) => path.endsWith('-thumb.png'))).toBe(true);
  expect(results.every((media: { thumbnailUrl?: string }) => media.thumbnailUrl?.startsWith('https://'))).toBe(true);
});

it('warms a cached thumbnail without requesting its uncached original', async () => {
  const signed = await resolveDreamMedia(dreams[0], 'user-1');
  invalidateDreamMedia();
  mockSign.mockClear();
  mockCachePath.mockImplementation(async (key: string) => key === signed.thumbnailCacheKey ? '/cache/thumb' : null);

  const media = await resolveWithDiskCache(dreams[0], 'user-1', false, { variant: 'thumbnail' });
  expect(mockSign).not.toHaveBeenCalled();
  expect(media).toMatchObject({ thumbnailUrl: 'file:///cache/thumb', thumbnailCacheKey: signed.thumbnailCacheKey });
});

it('keeps the original available for warm-up when no thumbnail exists', async () => {
  const media = await resolveWithDiskCache({ ...dreams[0], thumbnailUrl: '' }, 'user-1', false, { variant: 'thumbnail' });
  expect(mockSign).toHaveBeenCalledWith(['user-1/dream-0.png'], expect.any(Number));
  expect(media.imageUrl).toMatch(/^https:\/\//);
});

it('shows images already on disk without any storage request, under the keys signing writes', async () => {
  const signed = await resolveDreamMedia(dreams[0], 'user-1');
  const onDisk = new Set([signed.imageCacheKey, signed.thumbnailCacheKey]);
  for (const dream of dreams.slice(1)) {
    const media = await resolveDreamMedia(dream, 'user-1');
    onDisk.add(media.imageCacheKey);
    onDisk.add(media.thumbnailCacheKey);
  }
  // A new launch: the signed URLs lived in memory only, the image bytes stayed on disk.
  invalidateDreamMedia();
  mockSign.mockClear();
  mockCachePath.mockImplementation(async (key: string) => onDisk.has(key) ? `/cache/${onDisk.size}-${key.length}` : null);

  const results = await Promise.all(dreams.map(dream => resolveWithDiskCache(dream, 'user-1', false)));
  expect(mockSign).not.toHaveBeenCalled();
  expect(results[0]).toMatchObject({
    imageUrl: expect.stringMatching(/^file:\/\/\/cache\//), imageCacheKey: signed.imageCacheKey, imageStatus: 'ready',
    thumbnailCacheKey: signed.thumbnailCacheKey, thumbnailStatus: 'ready',
  });
});

it('signs only the variant missing from disk', async () => {
  const signed = await resolveDreamMedia(dreams[0], 'user-1');
  invalidateDreamMedia();
  mockSign.mockClear();
  mockCachePath.mockImplementation(async (key: string) => key === signed.thumbnailCacheKey ? '/cache/thumb' : null);

  const media = await resolveWithDiskCache(dreams[0], 'user-1', false);
  expect(mockSign).toHaveBeenCalledWith(['user-1/dream-0.png'], expect.any(Number));
  expect(media).toMatchObject({ thumbnailUrl: 'file:///cache/thumb', imageStatus: 'ready', imageCacheKey: signed.imageCacheKey });
  expect(media.imageUrl).toMatch(/^https:\/\//);
});

it('never reads another account object or a changed image from disk', async () => {
  mockCachePath.mockResolvedValue('/cache/any');
  const foreign = await resolveWithDiskCache({ ...dreams[0], imageUrl: 'supabase-storage://dream-images/user-2/dream.png', thumbnailUrl: '' }, 'user-1', false);
  expect(foreign.imageUrl).toBe('');
  expect(foreign.imageStatus).toBe('error');
  expect(mockCachePath).not.toHaveBeenCalled();
  const unversioned = await resolveWithDiskCache({ imageUrl: dreams[0].imageUrl }, 'user-1', false);
  expect(unversioned.imageUrl).toMatch(/^https:\/\//);
  expect(mockCachePath).not.toHaveBeenCalled();
});
