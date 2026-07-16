const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  INITIAL_SOURCE_REVISION,
  buildSnapshot,
  compareSnapshots,
  decodeHtmlEntitiesOnce,
  extractHtmlContract,
  parseMode,
  parseSitemap,
  run,
  writeBaseline,
} = require('./check-public-url-stability');

function writeFile(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function indexableHtml(overrides = {}) {
  const canonical = overrides.canonical || 'https://noctalia.app/Case/Page.html/';
  const extraHead = overrides.extraHead || '';
  const jsonLd = overrides.jsonLd || {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': `${canonical}#webpage`, url: canonical },
      {
        '@type': 'BlogPosting',
        '@id': `${canonical}#article`,
        url: canonical,
        mainEntityOfPage: { '@id': `${canonical}#webpage` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 2, item: `${canonical}Child.html` },
          { '@type': 'ListItem', position: 1, item: 'https://noctalia.app/' },
        ],
      },
    ],
  };

  return `<!doctype html>
<html>
<head>
  <link rel="canonical" href="${canonical}">
  <link rel="alternate" hreflang="en" href="${canonical}?a=1&amp;b=2">
  <link rel="alternate" hreflang="x-default" href="https://noctalia.app/">
  <meta property="og:url" content="${canonical}">
  ${extraHead}
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
  <a itemprop="item" href="/Case/Crumb.html">Crumb</a>
</body>
</html>`;
}

function createFixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-url-contract-'));
  writeFile(root, 'docs-src/config/site.config.json', JSON.stringify({ domain: 'https://noctalia.app' }));
  writeFile(root, 'docs-src/static/index.html', '<!doctype html><title>Home shell</title>');
  writeFile(root, 'docs-src/templates/base.html', '<!doctype html><title>Base shell</title>');
  writeFile(root, 'docs-src/static/_redirects', '# comment\n/Old.html /New 301\n/Case /Target 302\n');
  writeFile(root, 'docs-src/static/vercel.json', JSON.stringify({
    redirects: [{ source: '/Old.html', destination: '/New', permanent: true }],
    rewrites: [{ source: '/', destination: '/index.html' }],
  }));
  writeFile(root, 'data/site-manifest.json', JSON.stringify({
    schemaVersion: 1,
    collections: {
      pages: {
        entries: {
          'page.home': {
            id: 'page.home',
            type: 'landing',
            canonicalLanguage: 'en',
            canonicalSlug: '',
            locales: { en: { slug: '', path: '/' } },
          },
        },
      },
    },
  }));
  writeFile(root, 'docs/index.html', indexableHtml({ canonical: 'https://noctalia.app/' }));
  writeFile(root, 'docs/sitemap.xml', `<?xml version="1.0"?>
<urlset xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://noctalia.app/</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://noctalia.app/"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://noctalia.app/"/>
  </url>
</urlset>`);
  return root;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

describe('check-public-url-stability', () => {
  const roots = [];

  afterEach(() => {
    while (roots.length) fs.rmSync(roots.pop(), { recursive: true, force: true });
  });

  it('preserves raw URL identity values after trim and entity decoding only', () => {
    const result = extractHtmlContract(indexableHtml(), 'docs/en/example.html');

    expect(result.canonical).toBe('https://noctalia.app/Case/Page.html/');
    expect(result.ogUrl).toBe('https://noctalia.app/Case/Page.html/');
    expect(result.hreflangs).toEqual([
      { hreflang: 'en', href: 'https://noctalia.app/Case/Page.html/?a=1&b=2' },
      { hreflang: 'x-default', href: 'https://noctalia.app/' },
    ]);
    expect(result.visibleBreadcrumbs).toEqual(['https://noctalia.app/Case/Crumb.html']);
    expect(result.jsonLdIdentities).toEqual(expect.arrayContaining([
      {
        type: 'BlogPosting',
        url: 'https://noctalia.app/Case/Page.html/',
        id: 'https://noctalia.app/Case/Page.html/#article',
        mainEntityOfPageId: 'https://noctalia.app/Case/Page.html/#webpage',
      },
      {
        type: 'WebPage',
        url: 'https://noctalia.app/Case/Page.html/',
        id: 'https://noctalia.app/Case/Page.html/#webpage',
        mainEntityOfPageId: null,
      },
    ]));
    expect(result.jsonLdBreadcrumbs).toEqual([[
      { position: '1', item: 'https://noctalia.app/' },
      { position: '2', item: 'https://noctalia.app/Case/Page.html/Child.html' },
    ]]);
  });

  it('decodes entities exactly once instead of accepting a nested-entity bypass', () => {
    expect(decodeHtmlEntitiesOnce('https://noctalia.app&amp;#47;en')).toBe(
      'https://noctalia.app&#47;en'
    );
    expect(
      parseSitemap(
        '<urlset><url><loc>https://noctalia.app&amp;#47;en</loc></url></urlset>'
      )[0].loc
    ).toBe('https://noctalia.app&#47;en');
  });

  it.each([
    ['canonical', '<link rel="canonical" href="https://noctalia.app/other">', /duplicate canonical/],
    ['og:url', '<meta property="og:url" content="https://noctalia.app/other">', /duplicate og:url/],
    ['hreflang', '<link rel="alternate" hreflang="en" href="https://noctalia.app/other">', /duplicate hreflang/],
  ])('rejects duplicate %s declarations', (_label, extraHead, expectedError) => {
    expect(() => extractHtmlContract(indexableHtml({ extraHead }), 'docs/en/example.html')).toThrow(expectedError);
  });

  it('rejects duplicate JSON-LD breadcrumb positions', () => {
    const jsonLd = {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { position: 1, item: 'https://noctalia.app/' },
        { position: '1', item: 'https://noctalia.app/other' },
      ],
    };
    expect(() => extractHtmlContract(indexableHtml({ jsonLd }), 'docs/en/example.html')).toThrow(
      /duplicate breadcrumb position/
    );
  });

  it('rejects duplicate sitemap locs and duplicate alternates', () => {
    const duplicateLoc = '<urlset><url><loc>https://noctalia.app/A</loc></url><url><loc>https://noctalia.app/A</loc></url></urlset>';
    expect(() => parseSitemap(duplicateLoc)).toThrow(/duplicate sitemap loc/);

    const duplicateAlternate = `<urlset><url><loc>https://noctalia.app/A</loc>
      <xhtml:link rel="alternate" hreflang="en" href="https://noctalia.app/A"/>
      <xhtml:link rel="alternate" hreflang="en" href="https://noctalia.app/B"/>
    </url></urlset>`;
    expect(() => parseSitemap(duplicateAlternate)).toThrow(/duplicate sitemap hreflang/);
  });

  it('builds a deterministic snapshot with manifest, HTML, sitemap and redirect identities', () => {
    const root = createFixtureRoot();
    roots.push(root);
    const snapshot = buildSnapshot(root, { sourceRevision: INITIAL_SOURCE_REVISION });

    expect(snapshot.counts).toEqual({
      logicalPages: 1,
      manifestPaths: 1,
      uniqueManifestPaths: 1,
      canonicalPages: 1,
      sitemapEntries: 1,
      allHtmlOutputPaths: 3,
    });
    expect(snapshot.allHtmlOutputPaths).toEqual([
      'docs-src/static/index.html',
      'docs-src/templates/base.html',
      'docs/index.html',
    ]);
    expect(snapshot.canonicalPages[0]).toMatchObject({
      pageId: 'page.home',
      lang: 'en',
      outputPath: 'docs/index.html',
      canonical: 'https://noctalia.app/',
    });
    expect(snapshot.redirects.netlifyRules).toEqual(['/Old.html /New 301', '/Case /Target 302']);
    expect(snapshot.redirects.vercel.redirects[0]).toEqual({
      destination: '/New',
      permanent: true,
      source: '/Old.html',
    });
  });

  it('reports pageId, language and exact expected/actual values on a protected change', () => {
    const root = createFixtureRoot();
    roots.push(root);
    const baseline = buildSnapshot(root, { sourceRevision: INITIAL_SOURCE_REVISION });
    const candidate = clone(baseline);
    candidate.canonicalPages[0].canonical = 'https://noctalia.app';

    expect(() => compareSnapshots(baseline, candidate)).toThrow(
      /canonical page changed.*pageId=page\.home language=en.*expected="https:\/\/noctalia\.app\/" actual="https:\/\/noctalia\.app"/
    );
  });

  it('allows only additive routes in extension mode', () => {
    const root = createFixtureRoot();
    roots.push(root);
    const baseline = buildSnapshot(root, { sourceRevision: INITIAL_SOURCE_REVISION });
    const candidate = clone(baseline);
    const newRoute = {
      collection: 'pages',
      pageId: 'page.new',
      type: 'content',
      canonicalLanguage: 'en',
      canonicalSlug: 'New',
      lang: 'en',
      slug: 'New',
      path: '/en/New',
    };
    candidate.manifestRoutes.push(newRoute);
    candidate.allHtmlOutputPaths.push('docs/en/New.html');
    candidate.canonicalPages.push({
      collection: 'pages',
      pageId: 'page.new',
      lang: 'en',
      outputPath: 'docs/en/New.html',
      canonical: 'https://noctalia.app/en/New',
      hreflangs: [{ hreflang: 'en', href: 'https://noctalia.app/en/New' }],
      ogUrl: 'https://noctalia.app/en/New',
      jsonLdIdentities: [],
      jsonLdBreadcrumbs: [],
      visibleBreadcrumbs: [],
    });
    candidate.sitemap.push({
      collection: 'pages',
      pageId: 'page.new',
      lang: 'en',
      loc: 'https://noctalia.app/en/New',
      alternates: [{ hreflang: 'en', href: 'https://noctalia.app/en/New' }],
    });
    candidate.counts = {
      logicalPages: 2,
      manifestPaths: 2,
      uniqueManifestPaths: 2,
      canonicalPages: 2,
      sitemapEntries: 2,
      allHtmlOutputPaths: 4,
    };

    expect(() => compareSnapshots(baseline, candidate, { allowAdditions: true })).not.toThrow();

    const missingSitemapEntry = clone(candidate);
    missingSitemapEntry.sitemap.pop();
    missingSitemapEntry.counts.sitemapEntries -= 1;
    expect(() =>
      compareSnapshots(baseline, missingSitemapEntry, { allowAdditions: true })
    ).toThrow(/invalid URL baseline parity/);

    candidate.manifestRoutes[0].path = '/renamed';
    expect(() => compareSnapshots(baseline, candidate, { allowAdditions: true })).toThrow(
      /manifest route changed.*field=path/
    );
  });

  it('freezes redirect order even in extension mode', () => {
    const root = createFixtureRoot();
    roots.push(root);
    const baseline = buildSnapshot(root, { sourceRevision: INITIAL_SOURCE_REVISION });
    const candidate = clone(baseline);
    candidate.redirects.netlifyRules.reverse();

    expect(() => compareSnapshots(baseline, candidate, { allowAdditions: true })).toThrow(
      /redirect contract changed/
    );
  });

  it('refuses to overwrite an existing baseline', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-url-write-'));
    roots.push(root);
    const baselinePath = path.join(root, 'baseline.json');
    fs.writeFileSync(baselinePath, '{}\n', 'utf8');

    expect(() => writeBaseline(baselinePath, { schemaVersion: 1 })).toThrow(/Refusing to replace/);
    expect(fs.readFileSync(baselinePath, 'utf8')).toBe('{}\n');
  });

  it('checks docs build readiness before reading the baseline', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-url-readiness-'));
    roots.push(root);
    writeFile(root, '.docs-build-state.json', JSON.stringify({ status: 'failed', error: 'render failed' }));

    expect(() => run({ rootDir: root, args: [] })).toThrow(/last docs build failed.*render failed/i);
  });

  it('accepts only one explicit mutation mode', () => {
    expect(parseMode([])).toBe('check');
    expect(parseMode(['--write-baseline'])).toBe('write');
    expect(parseMode(['--extend-baseline'])).toBe('extend');
    expect(() => parseMode(['--write-baseline', '--extend-baseline'])).toThrow(/exactly one/);
    expect(() => parseMode(['--force'])).toThrow(/unknown argument/);
  });
});
