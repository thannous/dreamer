const {
  collectSchemaImageUrls,
  parseAttributes,
  validateAltText,
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
});
