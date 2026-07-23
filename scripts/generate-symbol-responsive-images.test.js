const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  assertCompleteSymbolCoverage,
  collectGeneratedIllustrations,
  collectIllustrations,
  collectPosterIllustrations,
  mergeIllustrations,
  WIDTHS,
} = require('./generate-symbol-responsive-images');
const {
  SYMBOL_CARD_RESPONSIVE_WIDTHS,
  buildResponsiveSymbolImage,
} = require('./lib/symbol-image-assets');

describe('responsive symbol image inventory', () => {
  it('deduplicates the same localized illustration source', () => {
    const result = collectIllustrations({
      symbols: {
        flying: {
          en: { illustration: { src: '/img/symbols/generated/flying.webp' } },
          es: { illustration: { src: '/img/symbols/generated/flying.webp' } },
        },
      },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({ symbolId: 'flying', stem: 'flying' })
    );
  });

  it('rejects two source files that would publish to the same stable stem', () => {
    expect(() =>
      collectIllustrations({
        symbols: {
          first: { en: { illustration: { src: '/img/a/dream.webp' } } },
          second: { en: { illustration: { src: '/img/b/dream.jpg' } } },
        },
      })
    ).toThrow('Responsive symbol stem collision: dream');
  });

  it('discovers generated poster sources and keeps editorial stems unique', () => {
    const posterDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-symbol-posters-'));
    fs.writeFileSync(path.join(posterDir, 'abandonment.webp'), 'fixture');

    try {
      const posters = collectPosterIllustrations(posterDir);
      expect(posters).toEqual([
        expect.objectContaining({
          symbolId: 'abandonment',
          stem: 'abandonment',
          src: '/img/symbols/posters-v1/abandonment.webp',
        }),
      ]);
      expect(
        mergeIllustrations(
          [{ symbolId: 'water', stem: 'water-dream-it', src: '/img/water.jpg' }],
          posters
        ).map((entry) => entry.stem)
      ).toEqual(['abandonment', 'water-dream-it']);
    } finally {
      fs.rmSync(posterDir, { recursive: true, force: true });
    }
  });

  it('rejects a generated poster that collides with an editorial output stem', () => {
    expect(() =>
      mergeIllustrations(
        [{ symbolId: 'first', stem: 'shared', src: '/img/shared.jpg' }],
        [{ symbolId: 'second', stem: 'shared', src: '/img/shared.webp' }]
      )
    ).toThrow('Responsive symbol stem collision: shared');
  });

  it('collects versioned generated masters from the symbol image registry', () => {
    expect(
      collectGeneratedIllustrations({
        assets: {
          abandonment: {
            src: '/img/symbols/editorial-2026-07-v2/abandonment-v2.webp',
          },
        },
      })
    ).toEqual([
      expect.objectContaining({
        symbolId: 'abandonment',
        stem: 'abandonment-v2',
        src: '/img/symbols/editorial-2026-07-v2/abandonment-v2.webp',
      }),
    ]);
  });

  it('requires one unique illustration source for every catalog symbol', () => {
    expect(() =>
      assertCompleteSymbolCoverage(
        [
          { symbolId: 'first', src: '/img/shared.webp' },
          { symbolId: 'second', src: '/img/shared.webp' },
        ],
        { symbols: [{ id: 'first' }, { id: 'second' }, { id: 'third' }] }
      )
    ).toThrow('shares /img/shared.webp with first');
  });

  it('keeps card variants inside the shared responsive symbol pipeline', () => {
    expect(WIDTHS).toEqual([240, 480, 800, 1200]);
    expect(SYMBOL_CARD_RESPONSIVE_WIDTHS).toEqual([240, 480]);
  });

  it('builds a 240w fallback and 240/480 srcset for dictionary cards', () => {
    const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-symbol-responsive-'));
    const responsiveDir = path.join(staticDir, 'img', 'seo', 'symbols-v2');
    fs.mkdirSync(responsiveDir, { recursive: true });
    fs.writeFileSync(path.join(responsiveDir, 'water-240w.webp'), 'fixture');
    fs.writeFileSync(path.join(responsiveDir, 'water-480w.webp'), 'fixture');

    try {
      expect(
        buildResponsiveSymbolImage(
          { src: '/img/symbols/water.jpg', width: 1600, height: 900 },
          {
            fallbackWidth: 240,
            registry: { responsiveBase: '/img/seo/symbols-v2' },
            staticDir,
            widths: SYMBOL_CARD_RESPONSIVE_WIDTHS,
          }
        )
      ).toEqual(
        expect.objectContaining({
          height: 135,
          src: '/img/seo/symbols-v2/water-240w.webp',
          srcset:
            '/img/seo/symbols-v2/water-240w.webp 240w, /img/seo/symbols-v2/water-480w.webp 480w',
          width: 240,
        })
      );
    } finally {
      fs.rmSync(staticDir, { recursive: true, force: true });
    }
  });
});
