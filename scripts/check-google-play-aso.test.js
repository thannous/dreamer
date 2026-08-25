/* global describe, it, expect */

const fs = require('fs');
const path = require('path');
const { DEFAULT_SOURCE, codePointLength, validateAsoSource } = require('./check-google-play-aso');

function source(overrides = {}) {
  const document = JSON.parse(fs.readFileSync(DEFAULT_SOURCE, 'utf8'));
  return { ...document, ...overrides };
}

describe('Google Play ASO source validator', () => {
  it('accepts the canonical French draft', () => {
    const result = validateAsoSource(source());
    expect(result).toMatchObject({ valid: true, errors: [] });
    expect(result.counts.title).toBeLessThanOrEqual(30);
    expect(result.counts.short_description).toBeLessThanOrEqual(80);
    expect(result.counts.full_description).toBeLessThanOrEqual(4000);
  });

  it.each([
    'google-play-en-us-2026-08-25.json',
    'google-play-es-es-2026-08-25.json',
    'google-play-it-it-2026-08-25.json',
  ])('accepts the canonical localized draft %s', (filename) => {
    const localized = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'marketing', 'aso', filename), 'utf8'));
    const result = validateAsoSource(localized);
    expect(result).toMatchObject({ valid: true, errors: [] });
    expect(result.counts.title).toBeLessThanOrEqual(30);
    expect(result.counts.short_description).toBeLessThanOrEqual(80);
    expect(result.counts.full_description).toBeLessThanOrEqual(4000);
  });

  it('counts Unicode code points instead of UTF-16 units', () => {
    expect(codePointLength('rêve 🌙')).toBe(6);
  });

  it('rejects publication permission and a voice-led first capture', () => {
    const document = source();
    document.publication.play_console_mutation_allowed = true;
    document.screenshot_brief[0].surface = 'capture';
    document.screenshot_brief[0].caption = 'Dicte ton rêve';

    const result = validateAsoSource(document);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'publication.play_console_mutation_allowed doit être false.',
        'La voix ne doit pas diriger les trois premières captures.',
      ])
    );
  });
});
