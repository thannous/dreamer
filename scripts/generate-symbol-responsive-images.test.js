const { collectIllustrations } = require('./generate-symbol-responsive-images');

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
});
