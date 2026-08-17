import { describe, expect, it } from '@jest/globals';

import { DarkTheme, LightTheme } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';

function srgbChannel(value: number): number {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    throw new Error(`Expected a 6-digit hex color, got ${hex}`);
  }
  const r = srgbChannel(parseInt(normalized.slice(0, 2), 16));
  const g = srgbChannel(parseInt(normalized.slice(2, 4), 16));
  const b = srgbChannel(parseInt(normalized.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe('theme contrast', () => {
  it('keeps light-mode copy and accent text at WCAG AA on paper and cards', () => {
    const light = getNoctaliaDesignTokens(LightTheme, 'light');
    const surfaces = [LightTheme.backgroundDark, LightTheme.backgroundCard];

    expect(light.accent.base).toBe('#D4A574');
    expect(light.accent.text).toBe(LightTheme.accentDark);
    expect(light.text.tertiary).toBe(light.nav.inactive);

    for (const surface of surfaces) {
      expect(contrastRatio(light.text.primary, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(light.text.secondary, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(light.text.tertiary, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(light.accent.text, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(light.nav.inactive, surface)).toBeGreaterThanOrEqual(4.5);
    }

    expect(contrastRatio(light.action.primaryText, light.accent.base)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps dark-mode copy and accent text at WCAG AA on night surfaces', () => {
    const dark = getNoctaliaDesignTokens(DarkTheme, 'dark');
    const surfaces = [DarkTheme.backgroundDark, DarkTheme.backgroundCard];

    expect(dark.accent.text).toBe(DarkTheme.accentLight);

    for (const surface of surfaces) {
      expect(contrastRatio(dark.text.primary, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(dark.text.secondary, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(dark.text.tertiary, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(dark.accent.text, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(dark.nav.inactive, DarkTheme.navbarBg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
