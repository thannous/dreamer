const {
  parseContentDate,
  sanitizeReviewedBy,
  synchronizeArticleJsonLdDates,
  synchronizeJsonLdDates,
  synchronizeVisibleArticleDate,
  todayDateOnly,
  validateArticleDates,
  validateJsonLdDates,
} = require('./article-date-contract');
const {
  normalizeCanonicalOrganization,
  optimizeBlogIndexImages,
  protectMailtoLinksFromCloudflareObfuscation,
  renderJsonLd,
} = require('./docs-renderer');
const {
  findMalformedSpanishInvertedQuestions,
  findSpanishOrthographyIssues,
  hasTruncatedConnectorClause,
  normalizeSymbolDescriptionTemplate,
  terminalMetadataWord,
  validateExpandedSymbolLocale,
} = require('../check-content-release-gates');

describe('article date and content release contracts', () => {
  it('accepts explicit editorial dates and rejects future freshness', () => {
    expect(parseContentDate('2026-07-06T00:00:00+02:00')?.dateOnly).toBe('2026-07-06');
    expect(
      validateArticleDates(
        { publishedTime: '2026-07-01', modifiedTime: '2026-07-06' },
        { now: new Date('2026-07-09T12:00:00Z') }
      ).errors
    ).toEqual([]);
    expect(
      validateArticleDates(
        { publishedTime: '2026-07-01', modifiedTime: '2026-07-10' },
        { now: new Date('2026-07-09T12:00:00Z') }
      ).errors
    ).toContain('modifiedTime cannot be in the future');
  });

  it('uses the local calendar date just after midnight instead of the UTC date', () => {
    const justAfterMidnightInParis = new Date('2026-07-09T22:30:00Z');
    expect(todayDateOnly({ now: justAfterMidnightInParis })).toBe('2026-07-10');
    expect(
      todayDateOnly({ now: justAfterMidnightInParis, timeZone: 'Europe/Paris' })
    ).toBe('2026-07-10');
    expect(
      validateArticleDates(
        { publishedTime: '2026-07-01', modifiedTime: '2026-07-10' },
        { now: justAfterMidnightInParis, timeZone: 'Europe/Paris' }
      ).errors
    ).toEqual([]);
  });

  it('synchronizes article schema dates and removes organization-only review claims', () => {
    const [article, webPage] = synchronizeArticleJsonLdDates(
      [
        {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          datePublished: '2020-01-01',
          dateModified: '2020-01-01',
        },
        {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          reviewedBy: { '@type': 'Organization', name: 'Noctalia' },
        },
      ],
      { publishedTime: '2026-06-01', modifiedTime: '2026-07-06' }
    );

    expect(article.datePublished).toBe('2026-06-01');
    expect(article.dateModified).toBe('2026-07-06');
    expect(webPage).not.toHaveProperty('reviewedBy');
  });

  it('preserves a named Person reviewer without inventing credentials', () => {
    const [, webPage] = synchronizeArticleJsonLdDates(
      [
        { '@type': 'BlogPosting' },
        { '@type': 'WebPage', reviewedBy: { '@type': 'Person', name: 'Named Reviewer' } },
      ],
      { publishedTime: '2026-06-01', modifiedTime: '2026-07-06' }
    );
    expect(webPage.reviewedBy).toEqual({ '@type': 'Person', name: 'Named Reviewer' });
  });

  it('synchronizes only declared page modification dates without inventing publication dates', () => {
    const [article, datedWebPage, datedCollection, undatedWebPage] = synchronizeJsonLdDates(
      [
        { '@type': 'Article', datePublished: '2020-01-01', dateModified: '2020-01-02' },
        { '@type': 'WebPage', dateModified: '2020-01-02' },
        { '@type': 'CollectionPage', dateModified: '2020-01-02' },
        { '@type': 'WebPage' },
      ],
      {
        publishedTime: '2026-06-01T00:00:00+02:00',
        modifiedTime: '2026-07-09T00:00:00+02:00',
      }
    );

    expect(article).toMatchObject({
      datePublished: '2026-06-01T00:00:00+02:00',
      dateModified: '2026-07-09T00:00:00+02:00',
    });
    expect(datedWebPage.dateModified).toBe('2026-07-09T00:00:00+02:00');
    expect(datedCollection.dateModified).toBe('2026-07-09T00:00:00+02:00');
    expect(datedWebPage).not.toHaveProperty('datePublished');
    expect(datedCollection).not.toHaveProperty('datePublished');
    expect(undatedWebPage).not.toHaveProperty('dateModified');
    expect(undatedWebPage).not.toHaveProperty('datePublished');
  });

  it('validates exact schema dates and rejects future page freshness', () => {
    const mismatch = validateJsonLdDates(
      [
        { '@type': 'BlogPosting', datePublished: '2026-06-01', dateModified: '2026-07-08' },
        { '@type': 'WebPage', dateModified: '2026-07-08' },
      ],
      { publishedTime: '2026-06-01', modifiedTime: '2026-07-09' },
      { now: new Date('2026-07-09T12:00:00Z') }
    );
    expect(mismatch.errors).toEqual([
      'Article dateModified must exactly match modifiedTime',
      'WebPage/CollectionPage dateModified must exactly match modifiedTime',
    ]);

    const future = validateJsonLdDates(
      [{ '@type': 'CollectionPage', dateModified: '2026-07-10' }],
      { modifiedTime: '2026-07-10' },
      { now: new Date('2026-07-09T12:00:00Z') }
    );
    expect(future.errors).toEqual(['modifiedTime cannot be in the future']);
  });

  it('applies the page date contract through the renderer without adding datePublished', () => {
    const html = renderJsonLd(
      {
        layout: 'content',
        modifiedTime: '2026-07-09T00:00:00+02:00',
        jsonLd: [
          { '@context': 'https://schema.org', '@type': 'WebPage', dateModified: '2026-06-18' },
        ],
      },
      {},
      ''
    );
    expect(html).toContain('"dateModified": "2026-07-09T00:00:00+02:00"');
    expect(html).not.toContain('datePublished');
  });

  it('removes an Organization reviewer while preserving a named Person', () => {
    const schema = {
      '@type': 'WebPage',
      reviewedBy: [
        { '@type': 'Organization', name: 'Noctalia' },
        { '@type': 'Person', name: 'Qualified Reviewer' },
      ],
    };
    sanitizeReviewedBy(schema);
    expect(schema.reviewedBy).toEqual([{ '@type': 'Person', name: 'Qualified Reviewer' }]);
  });

  it('links the Noctalia brand to its canonical legal publisher identity', () => {
    const [schema] = normalizeCanonicalOrganization([
      { '@type': 'Organization', '@id': 'https://noctalia.app/#organization', name: 'Noctalia' },
    ]);
    expect(schema).toMatchObject({
      '@id': 'https://noctalia.app/#organization',
      name: 'Noctalia',
      legalName: 'Thanh Chau, entrepreneur individuel (TiMax)',
      taxID: 'SIREN 995316981',
      url: 'https://noctalia.app',
      brand: { '@type': 'Brand', name: 'Noctalia' },
      address: {
        '@type': 'PostalAddress',
        streetAddress: '70 rue la Barrière Saint-Marc',
        postalCode: '45000',
        addressLocality: 'Orléans',
        addressCountry: 'FR',
      },
    });
  });

  it('replaces stale visible copy with one localized machine-readable date', () => {
    const html = synchronizeVisibleArticleDate(
      '<article><p>Body</p><p class="small">Last updated: January 1, 2020</p></article>',
      { layout: 'blogArticle', lang: 'en', modifiedTime: '2026-07-06' }
    );
    expect(html).not.toContain('January 1, 2020');
    expect(html.match(/data-article-modified/g)).toHaveLength(1);
    expect(html).toContain('<time datetime="2026-07-06">July 6, 2026</time>');
  });

  it('loads only the first blog-index image eagerly and adds stable dimensions', () => {
    const html = optimizeBlogIndexImages(
      '<img src="../../img/blog/anxiety-dreams-meaning.webp" alt="First">' +
        '<img src="../../img/blog/why-we-forget-dreams.webp" alt="Second" loading="eager">'
    );
    const images = html.match(/<img\b[^>]*>/g);
    expect(images[0]).toContain('loading="eager"');
    expect(images[0]).toContain('fetchpriority="high"');
    expect(images[0]).toContain('width="800"');
    expect(images[0]).toContain('height="450"');
    expect(images[0]).toContain('srcset=');
    expect(images[1]).toContain('loading="lazy"');
    expect(images[1]).not.toContain('fetchpriority=');
  });

  it('keeps public mailto links out of Cloudflare email obfuscation', () => {
    const link =
      '<a href="mailto:contact@noctalia.app" class="contact">contact@noctalia.app</a>';
    const html = protectMailtoLinksFromCloudflareObfuscation(`<p>${link}</p>`);

    expect(html).toContain(`<!--email_off-->${link}<!--/email_off-->`);
    expect(protectMailtoLinksFromCloudflareObfuscation(html)).toBe(html);
  });

  it('flags an unclosed declarative inverted question but permits a real question', () => {
    expect(findMalformedSpanishInvertedQuestions('<p>¿Los sueños son una señal.</p>')).toHaveLength(1);
    expect(findMalformedSpanishInvertedQuestions('<p>¿Los sueños son una señal?</p>')).toEqual([]);
  });

  it('exposes dangling terminal words for the metadata release gate', () => {
    expect(terminalMetadataWord('Tracker: cosa misurano e | Noctalia')).toBe('e');
    expect(terminalMetadataWord('Découvrez pourquoi le journal de.')).toBe('de');
    expect(terminalMetadataWord('A complete sentence about dream tracking.')).toBe('tracking');
  });

  it('blocks unfinished connector titles while permitting concise complete titles', () => {
    expect(hasTruncatedConnectorClause('Cambio de hora: como el horario | Noctalia')).toBe(true);
    expect(hasTruncatedConnectorClause('Ora legale: effetti su sonno e sogni | Noctalia')).toBe(false);
  });

  it('finds targeted Spanish orthography regressions without matching inflected words', () => {
    expect(findSpanishOrthographyIssues('<p>Suenos junto a rios.</p>')).toEqual(['suenos', 'rios']);
    expect(findSpanishOrthographyIssues('<p>Los sumerios mantenían registros.</p>')).toEqual([]);
  });

  it('blocks thin or duplicated content before expanding the symbol inventory', () => {
    const errors = [];
    validateExpandedSymbolLocale(
      {
        seoTitle: 'New symbol',
        shortDescription: 'Too short.',
        askYourself: ['Repeated prompt', 'Repeated prompt', 'Third prompt'],
        faq: [
          { question: 'What does it mean?', answer: 'Short answer.' },
          { question: 'What does it mean?', answer: 'Another short answer.' },
          { question: 'A third question?', answer: 'Still too short.' },
        ],
      },
      '[symbol localization] example.en',
      errors
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('shortDescription'),
        expect.stringContaining('prompts must be distinct'),
        expect.stringContaining('FAQ answer'),
        expect.stringContaining('FAQ questions must be distinct'),
      ])
    );
  });

  it('normalizes symbol names so templated descriptions cannot evade duplicate checks', () => {
    const birth = normalizeSymbolDescriptionTemplate({
      name: 'Naissance',
      shortDescription:
        'Naissance dans un rêve n’a presque jamais un seul sens. Le contexte précise la lecture.',
    });
    const surgery = normalizeSymbolDescriptionTemplate({
      name: 'Chirurgie',
      shortDescription:
        'Chirurgie dans un rêve n’a presque jamais un seul sens. Le contexte précise la lecture.',
    });

    expect(birth).toBe(surgery);
    expect(
      normalizeSymbolDescriptionTemplate({
        name: 'Naissance',
        shortDescription:
          'Quand naissance prend toute la place dans un rêve, le contexte précise la lecture.',
      })
    ).toBe(
      'quand [symbol] prend toute la place dans un rêve, le contexte précise la lecture.'
    );
    expect(
      normalizeSymbolDescriptionTemplate({
        name: 'Ring',
        shortDescription: 'During the dream, a broken circle can evoke a fragile commitment.',
      })
    ).toBe('during the dream, a broken circle can evoke a fragile commitment.');
  });
});
