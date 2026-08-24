/* global describe, it, expect */

const fs = require('fs');
const {
  ASO_SOURCE,
  SCREENSHOT_LAYOUT,
  escapeXml,
  validateBriefAgainstLayout,
  wrapCaption,
} = require('./build-google-play-store-assets');

function loadBrief() {
  return JSON.parse(fs.readFileSync(ASO_SOURCE, 'utf8'));
}

describe('Google Play store asset recipe', () => {
  it('matches the canonical seven-shot brief', () => {
    expect(validateBriefAgainstLayout(loadBrief())).toEqual({ valid: true, errors: [] });
    expect(SCREENSHOT_LAYOUT).toHaveLength(7);
  });

  it('rejects a reordered surface', () => {
    const brief = loadBrief();
    brief.screenshot_brief[0].surface = 'capture';
    expect(validateBriefAgainstLayout(brief)).toEqual({
      valid: false,
      errors: ['Surface invalide pour la capture 1.'],
    });
  });

  it('keeps capture in the conversion-critical second position', () => {
    expect(SCREENSHOT_LAYOUT.map(({ surface }) => surface)).toEqual([
      'journal',
      'capture',
      'dream-art',
      'dream-detail',
      'patterns',
      'emotions',
      'reflection',
    ]);
  });

  it('maps every generated screenshot to an explicit local source', () => {
    expect(SCREENSHOT_LAYOUT.every(({ source }) => typeof source === 'string' && source.length > 0)).toBe(true);
  });

  it('wraps captions and escapes SVG text safely', () => {
    expect(wrapCaption('Un journal qui grandit avec chaque rêve')).toEqual([
      'Un journal qui grandit',
      'avec chaque rêve',
    ]);
    expect(escapeXml('rêve & reflet')).toBe('rêve &amp; reflet');
  });
});
