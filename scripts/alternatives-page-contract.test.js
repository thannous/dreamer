const fs = require('fs');
const path = require('path');

const {
  DOCS_SRC_DIR,
  getAndroidStoreUrl,
  getStaticPageConfig,
  siteConfig,
} = require('./lib/docs-site-config');
const { readSourceDocument } = require('./lib/docs-source-utils');
const { loadComparisonData } = require('./lib/alternatives-table');

const PAGE_ID = 'page.alternatives';
const DATASET_IDENTIFIER = 'noctalia-dream-journal-apps-comparison-2026';
const DATASET_URL = 'https://noctalia.app/data/dream-journal-apps-comparison-2026.csv';
const comparisonRows = [...loadComparisonData().values()];
const datasetVersion = comparisonRows.map((row) => row.last_reviewed).sort().at(-1);
const featureCounts = [
  comparisonRows.filter((row) => ['Yes', 'Former listing advertised it'].includes(row.ai_interpretation)).length,
  comparisonRows.filter((row) => ['Strong', 'Yes', 'Text and voice positioning'].includes(row.voice_capture)).length,
  comparisonRows.filter((row) => ['Yes', 'Former listing advertised it'].includes(row.generated_images)).length,
  comparisonRows.filter((row) => ['Strong', 'Yes', 'Former listing advertised reality checks'].includes(row.lucid_dreaming)).length,
];
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
      const findings = body.slice(body.indexOf('id="findings"'), body.indexOf('id="feature-snapshot"'));
      const visibleCounts = [...findings.matchAll(/<p class="text-3xl[^"]*">(\d+)\D+11<\/p>/g)]
        .map((match) => Number(match[1]));
      expect(visibleCounts).toEqual(featureCounts);

      const localSvgPath = path.join(DOCS_SRC_DIR, 'static', localizedSvg.slice(1));
      expect(fs.existsSync(localSvgPath)).toBe(true);
      const svg = fs.readFileSync(localSvgPath, 'utf8');
      const chartCounts = [...svg.matchAll(/<text x="1028"[^>]*>(\d+) \/ 11<\/text>/g)]
        .map((match) => Number(match[1]));
      expect(chartCounts).toEqual(featureCounts);
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
        dateModified: datasetVersion,
        version: datasetVersion,
        temporalCoverage: `2026-07-12/${datasetVersion}`,
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
