const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  collectIllustrations,
  collectPosterIllustrations,
  mergeIllustrations,
} = require('./generate-symbol-responsive-images');

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
});
