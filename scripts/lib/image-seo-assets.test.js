const {
  getPageImageSet,
  getPageResponsiveImages,
  getResponsiveImageData,
  readImageAssetRegistry,
  renderResponsivePicture,
} = require('./image-seo-assets');

describe('image SEO asset registry', () => {
  const registry = readImageAssetRegistry();

  it('contains the ten Search Console Image pilot pages', () => {
    expect(Object.keys(registry.pages)).toHaveLength(10);
    expect(
      Object.values(registry.pages).reduce((sum, page) => sum + page.impressions, 0)
    ).toBe(16290);
  });

  it('resolves a page by canonical URL or page id and locale', () => {
    expect(
      getPageImageSet(
        registry,
        'https://noctalia.app/es/blog/guia-diario-suenos?source=test'
      )?.locale
    ).toBe('es');
    expect(getPageImageSet(registry, 'blog.dream-journal-guide', 'en')?.locale).toBe('en');
  });

  it('provides stable responsive variants and intrinsic dimensions', () => {
    const image = getResponsiveImageData(registry, 'editorial.lucid-dreaming', '16x9');
    expect(image).toMatchObject({ width: 1200, height: 675, role: 'editorial' });
    expect(image.sources.avif.map((variant) => variant.width)).toEqual([480, 800, 1200]);
    expect(image.src).toBe(
      '/img/seo/pilot-2026-07-v1/editorial/lucid-dreaming-16x9-1200.webp'
    );
  });

  it('returns two localized images for every pilot page', () => {
    for (const canonicalPath of Object.keys(registry.pages)) {
      const images = getPageResponsiveImages(registry, canonicalPath);
      expect(images.editorial.alt).toBeTruthy();
      expect(images.educational.alt).toBeTruthy();
      expect(images.educational.role).toBe('educational');
    }
  });

  it('renders a picture with AVIF, WebP, dimensions and loading policy', () => {
    const page = getPageImageSet(registry, '/en/blog/lucid-dreaming-beginners-guide');
    const html = renderResponsivePicture(registry, page.images.editorial, { priority: true });
    expect(html).toContain('<picture>');
    expect(html).toContain('type="image/avif"');
    expect(html).toContain('type="image/webp"');
    expect(html).toContain('width="1200" height="675"');
    expect(html).toContain('loading="eager"');
    expect(html).toContain('fetchpriority="high"');
  });

  it('art-directs educational diagrams with a dedicated mobile composition', () => {
    const page = getPageImageSet(registry, '/en/blog/lucid-dreaming-beginners-guide');
    const html = renderResponsivePicture(registry, page.images.educational, {
      priority: false,
      figure: false,
    });

    expect(html).toContain('media="(max-width: 640px)"');
    expect(html).toContain('lucid-dreaming-method-3x4-480.avif');
    expect(html).toContain('width="800" height="1067"');
    expect(html).toContain('lucid-dreaming-method-4x3-1200.webp');
    expect(html).toContain('loading="lazy"');
  });

  it('keeps the generic fallback out of image sitemaps', () => {
    const fallback = registry.assets['fallback.noctalia-dreamscape-v2'];
    expect(fallback).toMatchObject({ role: 'fallback', visible: false, sitemap: false });
  });
});
