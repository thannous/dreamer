/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';

import APP_MEDIA from '@/assets/remote/app-media.json';
import { prefetchRemoteArt, remoteArtUrl, useRemoteArt, type RemoteArtKey } from '@/lib/remoteArt';

const mockPrefetch = jest.fn<Promise<boolean>, [string[], string]>();
jest.mock('expo-image', () => ({ Image: { prefetch: (urls: string[], cachePolicy: string) => mockPrefetch(urls, cachePolicy) } }));

const BUNDLED = 42;
const KEY: RemoteArtKey = 'badges/night-journal';
const SHA = APP_MEDIA[KEY][2];

describe('remote art', () => {
  beforeEach(() => mockPrefetch.mockReset());

  it('names each painting by its content only, on the immutable CDN namespace', () => {
    expect(remoteArtUrl(KEY)).toBe(`https://media.noctalia.app/app/v1/${SHA}.webp`);
    for (const key of Object.keys(APP_MEDIA) as RemoteArtKey[]) {
      expect(remoteArtUrl(key)).toMatch(/^https:\/\/media\.noctalia\.app\/app\/v1\/[a-f0-9]{64}\.webp$/);
    }
  });

  it('shows the bundled export while the painting loads, and in its place when it cannot be fetched', () => {
    const { result } = renderHook(() => useRemoteArt(KEY, BUNDLED));
    expect(result.current.source).toEqual({ uri: remoteArtUrl(KEY) });
    expect(result.current.placeholder).toBe(BUNDLED);

    // Offline with nothing cached, or unreachable: expo-image reports the load as failed.
    act(() => result.current.onError());
    expect(result.current.source).toBe(BUNDLED);
    expect(result.current.placeholder).toBeUndefined();

    // Only if the bundled export fails too is nothing left, for the caller's drawn stand-in.
    act(() => result.current.onError());
    expect(result.current.source).toBeNull();
  });

  it('draws the bundled export directly without a key, and nothing once that fails', () => {
    const { result } = renderHook(() => useRemoteArt(null, BUNDLED));
    expect(result.current.source).toBe(BUNDLED);
    expect(result.current.placeholder).toBeUndefined();
    act(() => result.current.onError());
    expect(result.current.source).toBeNull();
  });

  it('prefetches to disk under the URLs drawn, retrying after an offline attempt and never twice after success', async () => {
    mockPrefetch.mockRejectedValueOnce(new Error('The Internet connection appears to be offline.'));
    await expect(prefetchRemoteArt([KEY, KEY])).resolves.toBe(false);
    expect(mockPrefetch).toHaveBeenLastCalledWith([remoteArtUrl(KEY)], 'disk');

    mockPrefetch.mockResolvedValueOnce(false);
    await expect(prefetchRemoteArt([KEY])).resolves.toBe(false);

    mockPrefetch.mockResolvedValueOnce(true);
    await expect(prefetchRemoteArt([KEY, 'badges/observatory'])).resolves.toBe(true);
    expect(mockPrefetch).toHaveBeenLastCalledWith([remoteArtUrl(KEY), remoteArtUrl('badges/observatory')], 'disk');

    await expect(prefetchRemoteArt([KEY])).resolves.toBe(true);
    expect(mockPrefetch).toHaveBeenCalledTimes(3);
  });
});
