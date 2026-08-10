const fs = require('fs');
const path = require('path');
const {
  SUPPORTED_LANGS,
  getPageIllustration,
  listPageIllustrationRoutes,
  readCompleteImageAssetRegistry,
  readPageIllustrationConfig,
} = require('./page-illustrations');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

describe('sitewide page illustrations', () => {
  const config = readPageIllustrationConfig();
  const registry = readCompleteImageAssetRegistry();
  const routes = listPageIllustrationRoutes();

  it('covers 36 page families in exactly the languages where each page exists', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'data', 'site-manifest.json'), 'utf8')
    );
    const localeCountByPageId = {};
    for (const collection of Object.values(manifest.collections || {})) {
      for (const [pageId, entry] of Object.entries(collection.entries || {})) {
        localeCountByPageId[pageId] = Object.keys(entry.locales || {}).length;
      }
    }

    expect(Object.keys(config.families)).toHaveLength(36);
    expect(SUPPORTED_LANGS).toEqual(['en', 'fr', 'es', 'de', 'it', 'pt-br']);

    let expectedRouteCount = 0;
    for (const pageId of Object.keys(config.families)) {
      const localeCount = localeCountByPageId[pageId];
      expect(localeCount).toBeGreaterThan(0);
      expectedRouteCount += localeCount;
      expect(routes.filter((route) => route.pageId === pageId)).toHaveLength(localeCount);
    }
    expect(routes).toHaveLength(expectedRouteCount);

    // pt-br is a partial-coverage language: only families with a pt-br locale
    // in the site manifest expose pt-br illustration routes.
    const ptBrRoutes = routes.filter((route) => route.lang === 'pt-br');
    expect(ptBrRoutes.length).toBeGreaterThan(0);
    for (const route of ptBrRoutes) {
      expect(route.path).toMatch(/^\/pt-br\//);
    }
  });

  it('keeps every versioned master and responsive variant available', () => {
    for (const [pageId, stem] of Object.entries(config.families)) {
      const assetId = `sitewide.${pageId}`;
      const asset = registry.assets[assetId];
      expect(asset).toMatchObject({
        role: 'editorial',
        visible: true,
        sitemap: true,
        formats: ['avif', 'webp'],
      });
      expect(asset.source).toContain(`/${config.release}/masters/${stem}.png`);
      expect(fs.existsSync(path.join(REPO_ROOT, asset.source))).toBe(true);

      for (const [aspect, dimensions] of Object.entries({
        '16x9': { width: 1200, height: 675, widths: [480, 800, 1200] },
        '4x5': { width: 800, height: 1000, widths: [480, 800] },
      })) {
        expect(asset.aspects[aspect]).toMatchObject(dimensions);
        for (const width of dimensions.widths) {
          for (const format of asset.formats) {
            const output = path.join(
              REPO_ROOT,
              'docs-src',
              'static',
              `${asset.outputStem}-${aspect}-${width}.${format}`
            );
            expect(fs.existsSync(output)).toBe(true);
          }
        }
      }
    }
  });

  it('provides localized descriptive text and mobile art direction', () => {
    const localizedTitles = {
      en: 'About Noctalia',
      fr: 'À propos de Noctalia',
      es: 'Acerca de Noctalia',
      de: 'Über Noctalia',
      it: 'Informazioni su Noctalia',
    };

    for (const [lang, title] of Object.entries(localizedTitles)) {
      const illustration = getPageIllustration('page.about', lang, title);
      expect(illustration.ref).toMatchObject({
        assetId: 'sitewide.page.about',
        aspect: '16x9',
        mobileAspect: '4x5',
        mobileBreakpoint: '640px',
      });
      expect(illustration.ref.alt).toContain(title);
      expect(illustration.ref.caption).toContain(title);
      expect(illustration.image).toMatchObject({ width: 1200, height: 675 });
      expect(illustration.image.sources.avif.map((variant) => variant.width)).toEqual([
        480,
        800,
        1200,
      ]);
    }
  });
});
