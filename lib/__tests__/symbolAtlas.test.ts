import { describe, expect, it } from '@jest/globals';

import published from '../../data/app/symbol-atlas.json';
import { isSymbolAtlas } from '../symbolAtlas';

// The atlas reaches installed apps from the site, so a damaged publish must be refused
// before a sheet draws from it; no journey can serve the app such a file.
type Atlas = { base: unknown; symbols: Record<string, any> };

function damaged(change: (atlas: Atlas) => void): unknown {
  const atlas = JSON.parse(JSON.stringify(published)) as Atlas;
  change(atlas);
  return atlas;
}

describe('isSymbolAtlas', () => {
  it('accepts the atlas the site publishes', () => {
    expect(isSymbolAtlas(published)).toBe(true);
  });

  it('refuses a texture missing what the painting needs to move it', () => {
    expect(isSymbolAtlas(damaged((atlas) => delete atlas.symbols.candle.layers[0].op))).toBe(false);
    expect(isSymbolAtlas(damaged((atlas) => delete atlas.symbols.candle.scenes[0].layers[0].box))).toBe(false);
    expect(isSymbolAtlas(damaged((atlas) => (atlas.symbols.candle.layers[0].dur = 0)))).toBe(false);
  });

  it('refuses names that would leave the paintings folder on the site', () => {
    expect(isSymbolAtlas(damaged((atlas) => (atlas.base = 'img/symbols')))).toBe(false);
    expect(isSymbolAtlas(damaged((atlas) => (atlas.base = '//elsewhere.example/img')))).toBe(false);
    expect(isSymbolAtlas(damaged((atlas) => (atlas.base = '/img/../private')))).toBe(false);
    expect(isSymbolAtlas(damaged((atlas) => (atlas.symbols.candle.layers[0].file = '../layer.webp')))).toBe(false);
    expect(isSymbolAtlas(damaged((atlas) => (atlas.symbols.candle.portrait.files['480'] = 'a/b.webp')))).toBe(false);
    expect(isSymbolAtlas(damaged((atlas) => (atlas.symbols['../candle'] = atlas.symbols.candle)))).toBe(false);
  });
});
