const path = require('path');
const {
  ContentHubRegistryError,
  EXPECTED_LANGUAGES,
  loadContentHubRegistry,
} = require('./content-hub-registry');

const ROOT_DIR = path.resolve(__dirname, '..', '..');

function localizedEntry(id, type) {
  return {
    id,
    type,
    canonicalLanguage: 'en',
    canonicalSlug: id,
    locales: Object.fromEntries(
      EXPECTED_LANGUAGES.map((lang) => [
        lang,
        {
          slug: id,
          path: `/${lang}/${id}`,
        },
      ])
    ),
  };
}

function makeManifest() {
  return {
    schemaVersion: 1,
    defaultLanguage: 'en',
    languages: [...EXPECTED_LANGUAGES],
    collections: {
      blog: {
        entries: Object.fromEntries(
          [
            ['blog.index', 'blogIndex'],
            ['blog.hub.one', 'blogArticle'],
            ['blog.hub.two', 'blogArticle'],
            ['blog.spoke.a', 'blogArticle'],
            ['blog.spoke.b', 'blogArticle'],
            ['blog.spoke.c', 'blogArticle'],
            ['blog.spoke.d', 'blogArticle'],
            ['blog.spoke.e', 'blogArticle'],
          ].map(([id, type]) => [id, localizedEntry(id, type)])
        ),
      },
      guides: {
        entries: {
          'guide.index': localizedEntry('guide.index', 'guideIndex'),
          'guide.dictionary': localizedEntry('guide.dictionary', 'guideDictionary'),
        },
      },
      symbols: {
        entries: {
          'symbolCategory.animals': localizedEntry('symbolCategory.animals', 'symbolCategory'),
          'symbol.snake': localizedEntry('symbol.snake', 'symbol'),
        },
      },
    },
  };
}

function makeConfig() {
  return {
    schemaVersion: 1,
    hubs: [
      {
        id: 'hub-one',
        kind: 'hubAndSpoke',
        directoryPageId: 'blog.index',
        hubPageId: 'blog.hub.one',
        spokePageIds: ['blog.spoke.a', 'blog.spoke.b', 'blog.spoke.c', 'blog.spoke.d'],
        relatedByPageId: {
          'blog.spoke.a': ['blog.spoke.b', 'blog.spoke.c', 'blog.spoke.d'],
          'blog.spoke.b': [],
        },
        render: {
          hubMissingSpokes: true,
          spokeMissingLinks: true,
        },
      },
      {
        id: 'hub-two',
        kind: 'hubAndSpoke',
        directoryPageId: 'blog.index',
        hubPageId: 'blog.hub.two',
        spokePageIds: ['blog.spoke.e'],
        relatedByPageId: {
          'blog.spoke.e': [],
        },
        render: {
          hubMissingSpokes: true,
          spokeMissingLinks: true,
        },
      },
      {
        id: 'symbols',
        kind: 'contentDatabase',
        directoryPageId: 'guide.index',
        hubPageId: 'guide.dictionary',
        memberSelectors: [
          {
            collection: 'symbols',
            types: ['symbolCategory', 'symbol'],
          },
        ],
        renderMode: 'validateOnly',
      },
    ],
  };
}

function validSourceDocumentReader(filePath) {
  const lang = path.basename(filePath, '.md');
  const pageId = path.basename(path.dirname(filePath));
  return {
    meta: {
      pageId,
      lang,
      title: `Title for ${pageId} in ${lang}`,
    },
    body: '',
  };
}

function loadFixture(overrides = {}) {
  return loadContentHubRegistry({
    rootDir: ROOT_DIR,
    config: overrides.config || makeConfig(),
    manifest: overrides.manifest || makeManifest(),
    sourceDocumentReader: overrides.sourceDocumentReader || validSourceDocumentReader,
  });
}

function expectInvalid({ config = makeConfig(), manifest = makeManifest(), sourceDocumentReader }, pattern) {
  let received;
  try {
    loadFixture({ config, manifest, sourceDocumentReader });
  } catch (error) {
    received = error;
  }
  expect(received).toBeInstanceOf(ContentHubRegistryError);
  expect(received.message).toMatch(pattern);
}

describe('content hub registry', () => {
  it('loads the real topology with exactly the 27 approved blog spokes', () => {
    const registry = loadContentHubRegistry({ rootDir: ROOT_DIR });
    const blogHubs = registry.hubs.filter((hub) => hub.kind === 'hubAndSpoke');
    const actualSpokes = blogHubs.flatMap((hub) => hub.spokePageIds).sort();
    const expectedSpokes = [
      'blog.anxiety-dreams-meaning',
      'blog.being-chased-dreams',
      'blog.children-dreams-guide',
      'blog.death-dreams-meaning',
      'blog.dream-incubation-guide',
      'blog.dream-interpretation-history',
      'blog.dream-journal-guide',
      'blog.dreams-about-ex',
      'blog.dreams-and-creativity',
      'blog.dreams-mental-health',
      'blog.exam-dreams-meaning',
      'blog.falling-dreams-meaning',
      'blog.flying-dreams-meaning',
      'blog.how-to-remember-dreams',
      'blog.lucid-dreaming-beginners-guide',
      'blog.precognitive-dreams-science',
      'blog.pregnancy-dreams-meaning',
      'blog.recurring-dreams-meaning',
      'blog.rem-sleep-dreams',
      'blog.sleep-paralysis-guide',
      'blog.snake-dreams-meaning',
      'blog.stop-nightmares-guide',
      'blog.stress-dreams-work',
      'blog.teeth-falling-out-dreams',
      'blog.water-dreams-meaning',
      'blog.why-we-dream-science',
      'blog.why-we-forget-dreams',
    ].sort();

    expect(registry.hubs).toHaveLength(4);
    expect(actualSpokes).toEqual(expectedSpokes);
    expect(new Set(actualSpokes).size).toBe(27);
    expect(Object.isFrozen(registry.hubs)).toBe(true);
    expect(Object.isFrozen(registry.getHubByPageId('blog.dream-meanings'))).toBe(true);
  });

  it('resolves primary hubs, related ids, paths, titles, and validate-only members', () => {
    const registry = loadFixture();

    expect(registry.getHubByPageId('blog.hub.one')?.id).toBe('hub-one');
    expect(registry.getHubByPageId('blog.spoke.a')).toBeNull();
    expect(registry.getPrimaryHubForSpoke('blog.spoke.a')?.id).toBe('hub-one');
    expect(registry.getRelatedSpokes('blog.spoke.a')).toEqual([
      'blog.spoke.b',
      'blog.spoke.c',
      'blog.spoke.d',
    ]);
    expect(Object.isFrozen(registry.getRelatedSpokes('blog.spoke.a'))).toBe(true);
    expect(registry.resolvePath('blog.spoke.a', 'fr')).toBe('/fr/blog.spoke.a');
    expect(registry.resolveTitle('blog.spoke.a', 'fr')).toBe(
      'Title for blog.spoke.a in fr'
    );
    expect(registry.selectMembers('symbols')).toEqual([
      'symbol.snake',
      'symbolCategory.animals',
    ]);
    expect(registry.selectMembers('hub-one')).toEqual([
      'blog.spoke.a',
      'blog.spoke.b',
      'blog.spoke.c',
      'blog.spoke.d',
    ]);
  });

  it('selects the existing 8 categories and 150 symbols without rendering them', () => {
    const registry = loadContentHubRegistry({ rootDir: ROOT_DIR });
    const members = registry.selectMembers('dream-symbols');

    expect(members.filter((pageId) => pageId.startsWith('symbolCategory.'))).toHaveLength(8);
    expect(members.filter((pageId) => pageId.startsWith('symbol.'))).toHaveLength(150);
    expect(registry.getHubByPageId('guide.dictionary')?.renderMode).toBe('validateOnly');
  });

  it.each(['url', 'path', 'slug', 'canonical', 'hreflang'])(
    'rejects recursively nested %s identity fields',
    (field) => {
      const config = makeConfig();
      config.metadata = { nested: { [field]: 'must-not-be-configured' } };
      expectInvalid({ config }, new RegExp(`metadata\\.nested\\.${field} is forbidden`));
    }
  );

  it('rejects a manifest that does not provide exactly the five supported languages', () => {
    const manifest = makeManifest();
    manifest.languages = ['en', 'fr', 'es', 'de'];
    expectInvalid({ manifest }, /languages must be exactly en, fr, es, de, it/);
  });

  it('rejects unknown pageIds and incomplete localized entries', () => {
    const unknownConfig = makeConfig();
    unknownConfig.hubs[0].spokePageIds[0] = 'blog.missing';
    expectInvalid({ config: unknownConfig }, /unknown pageId "blog\.missing"/);

    const incompleteManifest = makeManifest();
    delete incompleteManifest.collections.blog.entries['blog.spoke.a'].locales.it;
    expectInvalid({ manifest: incompleteManifest }, /"blog\.spoke\.a" must exist in exactly/);
  });

  it('enforces a single primary hub per spoke', () => {
    const config = makeConfig();
    config.hubs[1].spokePageIds = ['blog.spoke.a'];
    config.hubs[1].relatedByPageId = {};
    expectInvalid({ config }, /"blog\.spoke\.a" belongs to both "hub-one" and "hub-two"/);
  });

  it('rejects self, cross-hub, duplicate, and oversized related-spoke lists', () => {
    const selfConfig = makeConfig();
    selfConfig.hubs[0].relatedByPageId['blog.spoke.a'] = ['blog.spoke.a'];
    expectInvalid({ config: selfConfig }, /cannot relate a spoke to itself/);

    const crossHubConfig = makeConfig();
    crossHubConfig.hubs[0].relatedByPageId['blog.spoke.a'] = ['blog.spoke.e'];
    expectInvalid({ config: crossHubConfig }, /must belong to the same primary hub/);

    const duplicateConfig = makeConfig();
    duplicateConfig.hubs[0].relatedByPageId['blog.spoke.a'] = [
      'blog.spoke.b',
      'blog.spoke.b',
    ];
    expectInvalid({ config: duplicateConfig }, /duplicates "blog\.spoke\.b"/);

    const oversizedConfig = makeConfig();
    oversizedConfig.hubs[0].relatedByPageId['blog.spoke.a'] = [
      'blog.spoke.b',
      'blog.spoke.c',
      'blog.spoke.d',
      'blog.spoke.e',
    ];
    expectInvalid({ config: oversizedConfig }, /cannot contain more than three related spokes/);
  });

  it('requires selectors to match localized manifest members', () => {
    const config = makeConfig();
    config.hubs[2].memberSelectors[0].types.push('missingType');
    expectInvalid({ config }, /does not match any "missingType" entry/);
  });

  it('requires localized front matter pageId, lang, and title instead of slug fallbacks', () => {
    const sourceDocumentReader = (filePath) => {
      const source = validSourceDocumentReader(filePath);
      if (filePath.endsWith(path.join('blog.spoke.a', 'fr.md'))) source.meta.title = '  ';
      if (filePath.endsWith(path.join('blog.spoke.b', 'de.md'))) source.meta.lang = 'en';
      if (filePath.endsWith(path.join('blog.spoke.c', 'it.md'))) source.meta.pageId = 'blog.other';
      return source;
    };

    expectInvalid(
      { sourceDocumentReader },
      /front matter title is missing for "blog\.spoke\.a" locale "fr"/
    );
    expectInvalid(
      { sourceDocumentReader },
      /front matter lang mismatch for "blog\.spoke\.b" locale "de"/
    );
    expectInvalid(
      { sourceDocumentReader },
      /front matter pageId mismatch for "blog\.spoke\.c" locale "it"/
    );
  });

  it('fails clearly when callers request unknown pages or languages', () => {
    const registry = loadFixture();
    expect(() => registry.resolvePath('blog.unknown', 'fr')).toThrow(/Unknown content hub pageId/);
    expect(() => registry.resolvePath('blog.spoke.a', 'pt')).toThrow(
      /Unsupported content hub language/
    );
    expect(() => registry.resolveTitle('guide.dictionary', 'en')).toThrow(
      /Missing validated front matter title/
    );
  });
});
