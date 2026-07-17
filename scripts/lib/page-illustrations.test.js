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

  it('covers 34 page families in all five supported languages', () => {
    expect(Object.keys(config.families)).toHaveLength(34);
    expect(SUPPORTED_LANGS).toEqual(['en', 'fr', 'es', 'de', 'it']);
    expect(routes).toHaveLength(170);

    for (const pageId of Object.keys(config.families)) {
      expect(routes.filter((route) => route.pageId === pageId)).toHaveLength(5);
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
