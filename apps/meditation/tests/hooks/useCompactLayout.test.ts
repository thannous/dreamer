import { isCompactLayout } from '@/hooks/useCompactLayout';

describe('isCompactLayout', () => {
  it.each([
    [{ width: 320, height: 569, fontScale: 1 }, 'narrow Android'],
    [{ width: 375, height: 667, fontScale: 1 }, 'short phone'],
    [{ width: 412, height: 892, fontScale: 1.2 }, 'large Dynamic Type'],
  ])('uses compact density for a constrained viewport (%s)', (viewport) => {
    expect(isCompactLayout(viewport)).toBe(true);
  });

  it('keeps the regular hierarchy on a roomy viewport', () => {
    expect(isCompactLayout({ width: 390, height: 844, fontScale: 1 })).toBe(false);
  });
});
