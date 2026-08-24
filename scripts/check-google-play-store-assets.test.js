/* global describe, it, expect */

const fs = require('fs');
const {
  ASO_SOURCE,
  LOCALE_CONFIGS,
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

  it('keeps French and English executions on the same seven-shot system', () => {
    const englishBrief = JSON.parse(fs.readFileSync(LOCALE_CONFIGS['en-US'].asoSource, 'utf8'));
    expect(validateBriefAgainstLayout(englishBrief)).toEqual({ valid: true, errors: [] });
  });

  it('rejects a reordered surface', () => {
    const brief = loadBrief();
    brief.screenshot_brief[0].surface = 'capture';
    expect(validateBriefAgainstLayout(brief)).toEqual({
      valid: false,
      errors: ['Surface invalide pour la capture 1.'],
    });
  });

  it('keeps the approved conversion story order', () => {
    expect(SCREENSHOT_LAYOUT.map(({ surface }) => surface)).toEqual([
      'journal',
      'dream-art',
      'capture',
      'dream-chat',
      'symbols-guides',
      'patterns',
      'emotions',
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
