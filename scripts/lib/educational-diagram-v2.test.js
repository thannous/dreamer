const {
  DESKTOP,
  DIAGRAMS,
  MOBILE,
  expectedSources,
  validateDefinitions,
} = require('./educational-diagram-v2');

describe('educational diagram v2 system', () => {
  it('defines ten localized concepts across the three shared templates', () => {
    expect(() => validateDefinitions()).not.toThrow();
    expect(DIAGRAMS).toHaveLength(10);
    expect(new Set(DIAGRAMS.map((diagram) => diagram.template))).toEqual(
      new Set(['sequence', 'matrix', 'checklist'])
    );
  });

  it('renders a desktop and mobile master for every concept', () => {
    const outputs = expectedSources();
    expect(outputs).toHaveLength(20);
    expect(outputs.filter(({ viewport }) => viewport === DESKTOP)).toHaveLength(10);
    expect(outputs.filter(({ viewport }) => viewport === MOBILE)).toHaveLength(10);

    for (const { contents, viewport } of outputs) {
      expect(contents).toContain(`width="${viewport.width}" height="${viewport.height}"`);
      expect(contents).toContain('data-release="pilot-2026-07-v2"');
      expect(contents).toContain("font-family:'Noctalia Fraunces'");
      expect(contents).toContain("font-family:'Noctalia Outfit'");
    }
  });
});
