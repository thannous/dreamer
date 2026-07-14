const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  generateSitemap,
  loadImageSitemapEntries,
} = require('./generate-sitemap-v2');

describe('generate-sitemap-v2 image sitemap support', () => {
  let tmpRoot;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-image-sitemap-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('preserves the sitemap shape when the image registry is absent', () => {
    const result = loadImageSitemapEntries(path.join(tmpRoot, 'missing.json'));
    expect(result.loaded).toBe(false);
    expect(result.map.size).toBe(0);

    const sitemap = generateSitemap(new Map([
      ['https://noctalia.app/en/blog/example', {
        hreflangs: {},
        lastmod: '2026-07-14',
      }],
    ]));

    expect(sitemap).not.toContain('xmlns:image=');
    expect(sitemap).not.toContain('<image:image>');
    expect(sitemap).toContain('<loc>https://noctalia.app/en/blog/example</loc>');
  });

  it('associates visible editorial and educational images with pilot pages', () => {
    const registryPath = path.join(tmpRoot, 'image-assets.json');
    fs.writeFileSync(registryPath, JSON.stringify({
      schemaVersion: 1,
      release: 'pilot-v1',
      variants: {
        formats: ['avif', 'webp'],
        fallbackFormat: 'webp',
      },
      assets: {
        'lucid-editorial': {
          role: 'editorial',
          source: 'docs-src/static/img/blog/lucid-dreaming.webp',
          outputStem: '/img/seo/lucid-dreaming-v2',
          visible: true,
          sitemap: true,
          aspects: {
            '16x9': { width: 1200, height: 675, widths: [480, 800, 1200] },
          },
        },
        'lucid-educational-en': {
          role: 'educational',
          source: 'docs-src/static/img/seo-src/lucid-steps-en.svg',
          outputStem: '/img/seo/lucid-steps-en',
          visible: true,
          sitemap: true,
          aspects: {
            '4x3': { width: 1200, height: 900, widths: [480, 800, 1200] },
          },
        },
      },
      pages: {
        '/en/blog/lucid-dreaming-beginners-guide': {
          pageId: 'blog.lucid-dreaming-beginners-guide',
          locale: 'en',
          kind: 'blog',
          insertBefore: '<h2>Steps</h2>',
          images: {
            editorial: {
              assetId: 'lucid-editorial',
              aspect: '16x9',
              alt: 'A lucid dream scene',
              caption: 'Lucid dreaming guide',
            },
            educational: {
              assetId: 'lucid-educational-en',
              aspect: '4x3',
              alt: 'Steps for lucid dreaming',
              caption: 'A practical lucid dreaming routine',
            },
          },
        },
      },
    }), 'utf8');

    const result = loadImageSitemapEntries(registryPath);

    expect(result.error).toBeNull();
    expect(result.pageCount).toBe(1);
    expect(result.imageCount).toBe(2);
    expect(result.map.get('https://noctalia.app/en/blog/lucid-dreaming-beginners-guide')).toEqual([
      'https://noctalia.app/img/seo/lucid-dreaming-v2-16x9-1200.webp',
      'https://noctalia.app/img/seo/lucid-steps-en-4x3-1200.webp',
    ]);
  });

  it('deduplicates image URLs and excludes hidden, disabled, and fallback assets', () => {
    const registryPath = path.join(tmpRoot, 'image-assets.json');
    fs.writeFileSync(registryPath, JSON.stringify({
      schemaVersion: 1,
      release: 'pilot-v1',
      variants: {
        formats: ['avif', 'webp'],
        fallbackFormat: 'webp',
      },
      assets: {
        shared: {
          role: 'editorial',
          source: 'shared.webp',
          outputStem: '/img/seo/shared',
          visible: true,
          sitemap: true,
          aspects: { '16x9': { width: 1200, height: 675, widths: [1200] } },
        },
        duplicate: {
          role: 'educational',
          source: 'shared.svg',
          outputStem: '/img/seo/shared',
          visible: true,
          sitemap: true,
          aspects: { '16x9': { width: 1200, height: 675, widths: [1200] } },
        },
        hidden: {
          role: 'editorial',
          source: 'hidden.webp',
          outputStem: '/img/seo/hidden',
          visible: false,
          sitemap: true,
          aspects: { '16x9': { width: 1200, height: 675, widths: [1200] } },
        },
        disabled: {
          role: 'educational',
          source: 'disabled.svg',
          outputStem: '/img/seo/disabled',
          visible: true,
          sitemap: false,
          aspects: { '4x3': { width: 1200, height: 900, widths: [1200] } },
        },
        'global-fallback': {
          role: 'fallback',
          source: 'fallback.webp',
          outputPattern: '/img/og/fallback-{width}x{height}.{format}',
          formats: ['webp'],
          fallbackFormat: 'webp',
          visible: false,
          sitemap: false,
          aspects: { social: { width: 1200, height: 630, widths: [1200] } },
        },
      },
      pages: {
        '/en/blog/example': {
          pageId: 'blog.example',
          locale: 'en',
          kind: 'blog',
          insertBefore: '<h2>Example</h2>',
          images: {
            editorial: {
              assetId: 'shared',
              aspect: '16x9',
              alt: 'Shared image',
              caption: 'Shared editorial image',
            },
            educational: {
              assetId: 'duplicate',
              aspect: '16x9',
              alt: 'Shared educational image',
              caption: 'Shared educational image',
            },
            hidden: { assetId: 'hidden', aspect: '16x9' },
            disabled: { assetId: 'disabled', aspect: '4x3' },
            fallback: { assetId: 'global-fallback', aspect: 'social' },
          },
        },
      },
    }), 'utf8');

    const result = loadImageSitemapEntries(registryPath);
    const images = result.map.get('https://noctalia.app/en/blog/example');
    expect(images).toEqual(['https://noctalia.app/img/seo/shared-16x9-1200.webp']);

    const sitemap = generateSitemap(new Map([
      ['https://noctalia.app/en/blog/example', {
        hreflangs: {},
        lastmod: null,
        images,
      }],
    ]));
    expect(sitemap).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    expect(sitemap.match(/<image:image>/g)).toHaveLength(1);
    expect(sitemap).toContain(
      '<image:loc>https://noctalia.app/img/seo/shared-16x9-1200.webp</image:loc>',
    );
    expect(sitemap).not.toContain('fallback.webp');
  });

  it('escapes absolute image URLs in XML', () => {
    const sitemap = generateSitemap(new Map([
      ['https://noctalia.app/en/blog/example', {
        hreflangs: {},
        lastmod: null,
        images: ['https://cdn.noctalia.app/image.webp?width=1200&format=webp'],
      }],
    ]));

    expect(sitemap).toContain(
      '<image:loc>https://cdn.noctalia.app/image.webp?width=1200&amp;format=webp</image:loc>',
    );
  });
});
