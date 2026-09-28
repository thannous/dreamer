import { createThumbnailFailureCache } from '../thumbnailFailureCache';

describe('thumbnail failure retry boundary', () => {
  it('expires errors, bounds memory and rejects late callbacks after account changes', () => {
    let now = 0;
    const cache = createThumbnailFailureCache({ now: () => now, ttlMs: 100, capacity: 2 });
    cache.setScope('A');
    cache.record('A', 'one'); cache.record('A', 'two'); cache.record('A', 'three');
    expect(cache.has('A', 'one')).toBe(false);
    expect(cache.has('A', 'two')).toBe(true);
    now = 101;
    expect(cache.has('A', 'two')).toBe(false);
    cache.setScope('B'); cache.record('A', 'late');
    expect(cache.has('B', 'late')).toBe(false);
    cache.setScope('A');
    expect(cache.has('A', 'late')).toBe(false);
    expect(cache.has('A', 'three')).toBe(false);
  });
});
