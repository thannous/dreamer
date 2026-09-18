/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';
import { createNoctaliaTheme, getNoctaliaCSSVariables, getNoctaliaDesignTokens } from '../noctaliaPalette';

const variants = [
  { ambience: 'light' as const, mode: 'light' as const },
  { ambience: 'morning' as const, mode: 'light' as const },
  { ambience: 'dark' as const, mode: 'dark' as const },
  { ambience: 'afterglow' as const, mode: 'dark' as const },
];

describe('CSS and native theme contract', () => {
  it.each(variants)('keeps every generated CSS colour in sync for $ambience', ({ ambience, mode }) => {
    const colors = createNoctaliaTheme(mode, ambience);
    const variables = getNoctaliaCSSVariables(colors, mode);
    const css = fs.readFileSync(path.join(__dirname, '../../global.css'), 'utf8');
    const body = css.match(new RegExp(`@variant ${ambience} \\{([^}]+)\\}`))?.[1] ?? '';
    const actual = Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, key, value]) => [key, value.trim()]));
    expect(actual).toEqual(variables);
    expect(variables['--color-ink']).toBe(colors.backgroundDark);
    expect(variables['--color-ink-solid']).toBe(colors.backgroundCard);
    expect(variables['--color-champagne']).toBe(colors.accent);
    expect(variables['--color-on-champagne']).toBe(colors.textOnAccentSurface);
    expect(variables['--color-ivory']).toBe(colors.textPrimary);
    expect(variables['--color-nav-inactive']).toBe(colors.navbarTextInactive);
    expect(variables['--color-danger-on']).toBe(getNoctaliaDesignTokens(colors, mode).status.danger.text);
  });

  it.each(variants)('provides hex native surfaces for alpha-suffix consumers in $ambience', ({ ambience, mode }) => {
    const colors = createNoctaliaTheme(mode, ambience);
    for (const color of [colors.backgroundDark, colors.backgroundCard, colors.backgroundSecondary, colors.accent, colors.divider]) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
