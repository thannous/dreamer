const { computeTier, renderTierInlineScript } = require('./experience-tier');

describe('computeTier', () => {
  const base = { cores: 8, ram: 8, coarse: false, reducedMotion: false, saveData: false };

  it('returns "full" for a recent desktop', () => {
    expect(computeTier(base)).toBe('full');
  });

  it('returns "static" when reduced motion is requested, whatever the hardware', () => {
    expect(computeTier({ ...base, cores: 16, ram: 32, reducedMotion: true })).toBe('static');
  });

  it('returns "static" when save-data is enabled', () => {
    expect(computeTier({ ...base, saveData: true })).toBe('static');
  });

  it('returns "static" for very weak CPUs', () => {
    expect(computeTier({ ...base, cores: 2 })).toBe('static');
    expect(computeTier({ ...base, cores: 1 })).toBe('static');
  });

  it('returns "static" for low-RAM mobile devices', () => {
    expect(computeTier({ ...base, coarse: true, ram: 2 })).toBe('static');
  });

  it('returns "light" for touch devices with decent hardware', () => {
    expect(computeTier({ ...base, coarse: true })).toBe('light');
  });

  it('returns "light" for desktops below the full thresholds', () => {
    expect(computeTier({ ...base, cores: 4, ram: 8 })).toBe('light');
    expect(computeTier({ ...base, cores: 8, ram: 4 })).toBe('light');
  });

  it('falls back to safe defaults when hardware hints are missing', () => {
    // Unknown cores are treated as weak hardware: conservative static tier.
    expect(computeTier({})).toBe('static');
    expect(computeTier({ cores: undefined, ram: undefined, coarse: true })).toBe('static');
  });

  it('does not penalize browsers without deviceMemory (Firefox, Safari)', () => {
    expect(computeTier({ cores: 8, ram: undefined, coarse: false })).toBe('full');
    expect(computeTier({ cores: 4, ram: undefined, coarse: true })).toBe('light');
  });
});

describe('renderTierInlineScript', () => {
  it('inlines a self-contained detection script', () => {
    const script = renderTierInlineScript();
    expect(script).toContain('<script>');
    expect(script).toContain('var computeTier = function computeTier(env)');
    expect(script).toContain("document.documentElement.dataset.expTier = tier;");
    expect(script).not.toContain('require(');
    // Exactly one closing tag: the serialized function must not contain a
    // literal "</script>" that would break HTML parsing.
    expect(script.split('</script>')).toHaveLength(2);
  });
});
