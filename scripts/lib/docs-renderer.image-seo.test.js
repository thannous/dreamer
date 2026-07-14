const {
  insertEducationalImage,
  optimizeBlogArticleImages,
  resolvePageImageContext,
  synchronizePreferredImage,
} = require('./docs-renderer');

describe('docs renderer image SEO', () => {
  it('turns the matching article image into the single visible priority hero', () => {
    const source = [
      '<article>',
      '<figure><img src="../../img/blog/other-scene.webp" alt="Other scene"></figure>',
      '<figure class="mb-12"><img src="../../img/blog/lucid-dreaming-beginners-guide.webp" alt="Lucid dream landscape" width="1200" height="630"></figure>',
      '</article>',
    ].join('\n');
    const html = optimizeBlogArticleImages(source, {
      title: 'Lucid dreaming',
      ogImageAlt: 'Lucid dream landscape',
      preloadImage: '/img/blog/lucid-dreaming-beginners-guide.webp',
    });

    expect(html).toContain('data-image-seo-role="editorial"');
    expect(html).toContain('<picture>');
    expect(html).toContain('width="1200" height="675"');
    expect(html).toContain('fetchpriority="high"');
    expect(html.match(/data-image-seo-role="editorial"/g)).toHaveLength(1);
    expect(html).toContain('src="../../img/blog/other-scene.webp"');
  });

  it('inserts the localized educational image before the configured heading', () => {
    const entry = {
      locales: { en: { path: '/en/blog/lucid-dreaming-beginners-guide' } },
    };
    const context = resolvePageImageContext(entry, { lang: 'en' });
    const html = insertEducationalImage(
      '<article><h2 id="reality-checks">Reality checks</h2></article>',
      context
    );

    expect(html.indexOf('data-image-seo-role="educational"')).toBeLessThan(
      html.indexOf('id="reality-checks"')
    );
    expect(html).toContain('educational.lucid-dreaming.en');
    expect(html).toContain('loading="lazy"');
  });

  it('synchronizes Article and WebPage preferred image metadata', () => {
    const blocks = synchronizePreferredImage(
      [
        { '@type': 'BlogPosting', image: 'old.jpg' },
        { '@type': 'WebPage', primaryImageOfPage: 'old.jpg' },
      ],
      { url: 'https://noctalia.app/new.webp', width: 1200, height: 675 }
    );

    expect(blocks[0].image).toEqual(
      expect.objectContaining({ url: 'https://noctalia.app/new.webp', width: 1200, height: 675 })
    );
    expect(blocks[1].primaryImageOfPage).toEqual(
      expect.objectContaining({ url: 'https://noctalia.app/new.webp', width: 1200, height: 675 })
    );
  });
});
