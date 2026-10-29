/**
 * The native bundle swaps these shims in through Metro (scripts/metro-native-stubs.js),
 * which Jest does not use. These tests load the shims directly so the shipped
 * behaviour is covered.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../..');

// The part of culori Uniwind's native runtime calls (culori ships no types).
type Culori = {
  parse(color: string): ({ alpha?: number } & Record<string, unknown>) | undefined;
  formatHex(color: unknown): string;
  formatHex8(color: unknown): string;
  interpolate(colors: string[]): (weight: number) => unknown;
};

describe('culori-lite (Uniwind native runtime)', () => {
  const lite = require('../culori-lite') as Culori;
  const full = jest.requireActual('culori') as Culori;
  const toHex8 = (color: string, culori: Culori) => {
    const parsed = culori.parse(color);
    return parsed ? culori.formatHex8(parsed) : undefined;
  };

  it('parses every theme colour exactly like the full library', () => {
    const sources = ['global.css', 'constants/noctaliaPalette.ts'].map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8'));
    const colours = new Set(sources.flatMap((source) => source.match(/#[\da-f]{3,8}\b|\b(?:rgba?|hsla?)\([^)]*\)/gi) ?? []));
    expect(colours.size).toBeGreaterThan(20);
    for (const colour of colours) {
      expect([colour, toHex8(colour, lite)]).toEqual([colour, toHex8(colour, full)]);
    }
  });

  it('keeps opacity utilities translucent, as Uniwind colorMix computes them', () => {
    // colorMix(color, weight, '#00000000') for bg-black/40 and friends.
    const withAlpha = (color: string, weight: number) => {
      const parsed = lite.parse(color);
      return parsed && lite.formatHex8({ ...parsed, alpha: weight * (parsed.alpha ?? 1) });
    };
    expect(withAlpha('#000000', 0.4)).toBe('#00000066');
    expect(withAlpha('black', 0.4)).toBe('#00000066');
    expect(withAlpha('rgba(255, 255, 255, 0.5)', 0.6)).toBe('#ffffff4d');
    expect(withAlpha('hsl(0 100% 50%)', 0.9)).toBe('#ff0000e6');
    expect(lite.parse('unset')).toBeUndefined();
  });

  it('mixes two colours like the full library', () => {
    expect(lite.formatHex(lite.interpolate(['#000000', '#ffffff'])(0.5))).toBe(full.formatHex(full.interpolate(['#000000', '#ffffff'])(0.5)));
  });
});

describe('character-entities-lite (Markdown policy pass)', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('character-entities', () => jest.requireActual('../character-entities-lite'));
  });

  it('decodes the common references and leaves rare ones to the renderer', () => {
    const { decodeNamedCharacterReference } = require('decode-named-character-reference') as typeof import('decode-named-character-reference');
    expect(decodeNamedCharacterReference('amp')).toBe('&');
    expect(decodeNamedCharacterReference('nbsp')).toBe(' ');
    expect(decodeNamedCharacterReference('eacute')).toBe(false);
  });

  it('keeps the link policy at least as strict', () => {
    const { sanitizeMarkdown } = require('@/lib/markdownSecurity') as typeof import('@/lib/markdownSecurity');
    expect(sanitizeMarkdown('[Site](https://example.com?a=1&amp;b=2)')).toBe('[Site](https://example.com?a=1&amp;b=2)');
    expect(sanitizeMarkdown('[Bad](javascript&colon;alert(1))')).not.toContain('](');
    expect(sanitizeMarkdown('Un caf&eacute; et caf&#233;.')).toBe('Un caf&eacute; et caf&#233;.');
  });
});

describe('supabase-realtime shim', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('@supabase/realtime-js', () => jest.requireActual('../supabase-realtime'));
  });

  it('lets supabase-js build a client and follow auth events without Realtime', async () => {
    const { RealtimeClient } = require('../supabase-realtime') as { RealtimeClient: new () => unknown };
    const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
    const client = createClient('https://example.supabase.co', 'anon-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const internal = client as unknown as {
      realtime: InstanceType<typeof RealtimeClient> & { setAuth: jest.Mock };
      _handleTokenChanged: (event: string, source: string, token?: string) => void;
    };
    expect(internal.realtime).toBeInstanceOf(RealtimeClient);
    internal._handleTokenChanged('SIGNED_IN', 'CLIENT', 'token');
    internal._handleTokenChanged('TOKEN_REFRESHED', 'CLIENT', 'token-2');
    internal._handleTokenChanged('SIGNED_OUT', 'CLIENT');
    expect(client.getChannels()).toEqual([]);
    await expect(client.removeAllChannels()).resolves.toEqual([]);
    expect(() => client.channel('room')).toThrow('Supabase Realtime is not bundled');
  });
});
