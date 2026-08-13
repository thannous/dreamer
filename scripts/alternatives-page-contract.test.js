const fs = require('fs');
const path = require('path');

const {
  DOCS_SRC_DIR,
  getAndroidStoreUrl,
  getStaticPageConfig,
  siteConfig,
} = require('./lib/docs-site-config');
const { readSourceDocument } = require('./lib/docs-source-utils');

const PAGE_ID = 'page.alternatives';
const DATASET_IDENTIFIER = 'noctalia-dream-journal-apps-comparison-2026';
const DATASET_URL = 'https://noctalia.app/data/dream-journal-apps-comparison-2026.csv';
const APP_NAMES = [
  'Noctalia',
  'DreamApp',
  'Oniri',
  'Dreamiary',
  'Dreamlab',
  'DreamKit',
  'Rosebud',
  'Dreamz Journal',
  'DreamMirror',
  'DreamStream',
  'DreamNotes',
];

function sourceFor(lang) {
  return readSourceDocument(
    path.join(DOCS_SRC_DIR, 'content', 'pages', PAGE_ID, `${lang}.md`)
  );
}

function schemas(meta) {
  return meta.jsonLd.map((block) => (typeof block === 'string' ? JSON.parse(block) : block));
}

function schemaByType(meta, type) {
  return schemas(meta).find((schema) => schema['@type'] === type);
}

describe('dream journal app comparison contract', () => {
  const page = getStaticPageConfig(PAGE_ID);
  const languages = siteConfig.languages.filter((lang) => page.slugs?.[lang] != null);

  it('keeps the evidence-rich page limited to the five demand-backed locales', () => {
    expect(languages).toEqual(['en', 'fr', 'es', 'de', 'it']);
    expect(page.slugs['pt-br']).toBeUndefined();
  });

  it.each(['en', 'fr', 'es', 'de', 'it'])(
    'keeps %s content, conversion and evidence modules in parity',
    (lang) => {
      const { meta, body } = sourceFor(lang);
      const quickAnswer = body.slice(0, body.indexOf('id="findings"'));
      const localizedSvg = lang === 'en'
        ? '/img/research/dream-journal-apps-feature-snapshot-2026.svg'
        : `/img/research/dream-journal-apps-feature-snapshot-2026-${lang}.svg`;

      expect(meta.title.length).toBeGreaterThanOrEqual(35);
      expect(meta.description.length).toBeGreaterThanOrEqual(110);
      expect(meta.description.length).toBeLessThanOrEqual(160);
      expect(quickAnswer).toContain('href="#methodology"');
      expect(quickAnswer).toContain(`href="${getAndroidStoreUrl(lang)}"`);
      expect(body).toContain('id="findings"');
      expect(body).toContain('id="feature-snapshot"');
      expect(body).toContain('id="methodology"');
      expect(body).toContain('id="dataset"');
      expect(body).toContain(localizedSvg);
      expect(body).toMatch(/10[^<]*11/);
      expect(body).toMatch(/7[^<]*11/);
      expect(body).toMatch(/4[^<]*11/);
      expect(body).toMatch(/3[^<]*11/);

      const localSvgPath = path.join(DOCS_SRC_DIR, 'static', localizedSvg.slice(1));
      expect(fs.existsSync(localSvgPath)).toBe(true);
    }
  );

  it.each(['en', 'fr', 'es', 'de', 'it'])(
    'keeps %s comparison schema aligned with the visible page',
    (lang) => {
      const { meta } = sourceFor(lang);
      const itemList = schemaByType(meta, 'ItemList');
      const dataset = schemaByType(meta, 'Dataset');
      const image = schemaByType(meta, 'ImageObject');

      expect(itemList.numberOfItems).toBe(11);
      expect(itemList.itemListElement.map((item) => item.name)).toEqual(APP_NAMES);
      expect(dataset).toMatchObject({
        identifier: DATASET_IDENTIFIER,
        dateCreated: '2026-07-12',
        dateModified: '2026-08-09',
        version: '2026-08-09',
        temporalCoverage: '2026-07-12/2026-08-09',
        isAccessibleForFree: true,
        inLanguage: 'en',
      });
      expect(dataset.variableMeasured).toHaveLength(9);
      expect(dataset.distribution).toMatchObject({
        '@type': 'DataDownload',
        encodingFormat: 'text/csv',
        inLanguage: 'en',
        contentUrl: DATASET_URL,
      });
      expect(image).toMatchObject({
        '@type': 'ImageObject',
        encodingFormat: 'image/svg+xml',
        width: 1200,
        height: 675,
        creditText: 'Noctalia',
        copyrightNotice: '© 2026 Noctalia',
      });
      expect(image.license).toMatch(/^https:\/\/noctalia\.app\//);
      expect(image.acquireLicensePage).toMatch(/^https:\/\/noctalia\.app\//);
    }
  );
});
