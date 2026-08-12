const {
  collectSchemaImageObjects,
  collectSchemaImageUrls,
  parseAttributes,
  validateAltText,
  validateEditorialHero,
  validateFeatureSnapshotLicenseMetadata,
} = require('./check-image-seo-contract');

describe('image SEO contract helpers', () => {
  it('parses and decodes image attributes', () => {
    expect(parseAttributes('<img src="/dream.webp" alt="Dreamer&#39;s journal" width="1200">')).toEqual(
      expect.objectContaining({
        src: '/dream.webp',
        alt: "Dreamer's journal",
        width: '1200',
      })
    );
  });

  it('accepts concise contextual alt text', () => {
    expect(validateAltText('A dreamer recording a vivid dream beside the bed')).toEqual([]);
  });

  it('rejects missing or obviously repetitive alt text', () => {
    expect(validateAltText('')).toContain('missing alt');
    expect(validateAltText('dream dream dream dream dream meaning')).toContain(
      'alt repeats one term more than four times'
    );
  });

  it('collects preferred images from Article and WebPage schemas', () => {
    const urls = collectSchemaImageUrls([
      {
        '@type': 'BlogPosting',
        image: { '@type': 'ImageObject', url: 'https://noctalia.app/img/article.webp' },
        mainEntityOfPage: {
          '@type': 'WebPage',
          primaryImageOfPage: 'https://noctalia.app/img/article.webp',
        },
      },
    ]);
    expect([...urls]).toEqual(['https://noctalia.app/img/article.webp']);
  });

  it('collects ImageObject nodes from nested schema graphs', () => {
    const images = collectSchemaImageObjects({
      '@graph': [
        {
          '@type': 'WebPage',
          primaryImageOfPage: {
            '@type': 'ImageObject',
            contentUrl: 'https://noctalia.app/img/research/chart.svg',
          },
        },
      ],
    });

    expect(images).toEqual([
      expect.objectContaining({ contentUrl: 'https://noctalia.app/img/research/chart.svg' }),
    ]);
  });

  it('requires consistent feature snapshot license metadata and visible targets', () => {
    const image = {
      '@context': 'https://schema.org',
      '@type': 'ImageObject',
      contentUrl: 'https://noctalia.app/img/research/dream-journal-apps-feature-snapshot-2026.svg',
      copyrightNotice: '© 2026 Noctalia',
      license: 'https://noctalia.app/en/press#media-license',
      acquireLicensePage: 'https://noctalia.app/en/press#media-contact',
    };
    const render = (schema, body = '') => ({
      html: `<script type="application/ld+json">${JSON.stringify(schema)}</script>${body}`,
    });
    const pageMap = new Map([
      ['/en/dream-journal-apps', render(image)],
      [
        '/en/press',
        render(image, '<section id="media-license"></section><section id="media-contact"></section>'),
      ],
    ]);
    const errors = [];

    validateFeatureSnapshotLicenseMetadata({ pageMap, errors });

    expect(errors).toEqual([]);

    pageMap.set('/en/dream-journal-apps', render({ ...image, license: undefined }));
    validateFeatureSnapshotLicenseMetadata({ pageMap, errors });
    expect(errors).toContain('/en/dream-journal-apps: feature snapshot license mismatch');
  });

  it('accepts a crawlable priority image inside the shared article hero', () => {
    const html = `<!doctype html><html class="blog-article"><body><header data-image-seo-hero="true">
      <figure data-image-seo-role="editorial"><picture><img src="/img/dream.webp" sizes="100vw" width="1200" height="675" alt="A dream scene" loading="eager" fetchpriority="high"></picture></figure>
      <div class="article-hero-copy"><h1>Dream</h1></div>
    </header></body></html>`;

    expect(validateEditorialHero(html, 'article')).toEqual({ eligible: true, errors: [] });
  });

  it('rejects an illustrated article that does not use the shared hero', () => {
    const html = `<!doctype html><html class="blog-article"><body>
      <figure data-image-seo-role="editorial"><img src="/img/dream.webp" alt="A dream scene"></figure>
    </body></html>`;

    expect(validateEditorialHero(html, 'article').errors).toContain(
      'article: illustrated page is missing its immersive hero'
    );
  });
});
