const {
  extractArticleImage,
  extractHeroImage,
  extractSymbolCardImages,
  readMeta,
  sitemapImageForPage,
} = require('./check-symbol-image-contract');

describe('rendered symbol image contract parsing', () => {
  const imageUrl = 'https://noctalia.app/img/seo/symbols-v2/abandonment-v2-1200w.webp';
  const html = `
    <meta property="og:image" content="${imageUrl}">
    <figure data-image-seo-role="symbol-hero">
      <picture><img src="/img/seo/symbols-v2/abandonment-v2-1200w.webp"
        srcset="/img/abandonment-480w.webp 480w, /img/abandonment-800w.webp 800w, /img/abandonment-1200w.webp 1200w"
        alt="Abandonment" fetchpriority="high" width="1200" height="675"></picture>
    </figure>
    <script type="application/ld+json">{"@type":"Article","image":{"contentUrl":"${imageUrl}"}}</script>`;

  it('extracts marked hero, social metadata and Article image data', () => {
    expect(extractHeroImage(html)).toEqual(
      expect.objectContaining({ src: '/img/seo/symbols-v2/abandonment-v2-1200w.webp' })
    );
    expect(readMeta(html, 'property', 'og:image')).toBe(imageUrl);
    expect(extractArticleImage(html)).toBe(imageUrl);
  });

  it('finds the matching image in an image sitemap page entry', () => {
    const pageUrl = 'https://noctalia.app/fr/symboles/abandon';
    const sitemap = `<url><loc>${pageUrl}</loc><image:image><image:loc>${imageUrl}</image:loc></image:image></url>`;
    expect(sitemapImageForPage(sitemap, pageUrl)).toBe(imageUrl);
  });

  it('extracts responsive dictionary card images without mixing in heroes', () => {
    const dictionaryHtml = `
      <img class="dictionary-hero" src="/img/hero.webp" alt="Dictionary">
      <img class="symbol-card-image" src="/img/seo/symbols-v2/water-240w.webp"
        srcset="/img/seo/symbols-v2/water-240w.webp 240w, /img/seo/symbols-v2/water-480w.webp 480w"
        sizes="(max-width: 767px) min(50vw, 152px), min(21vw, 240px)"
        width="240" height="154" loading="lazy" alt="Water">`;

    expect(extractSymbolCardImages(dictionaryHtml)).toEqual([
      expect.objectContaining({
        src: '/img/seo/symbols-v2/water-240w.webp',
        width: '240',
      }),
    ]);
  });
});
