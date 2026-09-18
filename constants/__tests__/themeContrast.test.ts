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

function compositeSurface(rgba: string, ground: string): string {
  const [r, g, b, alpha] = rgba.match(/[\d.]+/g)!.map(Number);
  return '#' + [r, g, b].map((channel, index) => {
    const base = parseInt(ground.slice(1 + index * 2, 3 + index * 2), 16);
    return Math.round(channel * alpha + base * (1 - alpha)).toString(16).padStart(2, '0');
  }).join('');
}

describe('theme contrast', () => {
  it.each(['light', 'dark'] as const)('keeps illustrated journal copy readable on its %s ground', (mode: 'light' | 'dark') => {
    const { cover } = getNoctaliaDesignTokens(mode === 'dark' ? DarkTheme : LightTheme, mode);
    for (const foreground of [cover.title, cover.date, cover.muted, cover.accent]) {
      expect(contrastRatio(foreground, cover.background)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(cover.danger, cover.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(cover.onAccent, cover.accent)).toBeGreaterThanOrEqual(4.5);
    for (const surface of [cover.surface, cover.actionTint]) {
      const background = compositeSurface(surface, cover.background);
      expect(contrastRatio(cover.title, background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(cover.accent, background)).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(['light', 'dark'] as const)('keeps app dialogs, inputs and semantic states readable in %s', (mode: 'light' | 'dark') => {
    const base = mode === 'dark' ? DarkTheme : LightTheme;
    const tokens = getNoctaliaDesignTokens(base, mode);
    for (const surface of [tokens.screen.background, tokens.surface.raised]) {
      for (const foreground of [tokens.text.primary, tokens.text.secondary, tokens.accent.text]) {
        expect(contrastRatio(foreground, surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
    for (const status of Object.values(tokens.status)) {
      expect(contrastRatio(status.text, status.background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps light-mode copy and accent text at WCAG AA on paper and cards', () => {
    const light = getNoctaliaDesignTokens(LightTheme, 'light');
    const surfaces = [LightTheme.backgroundDark, LightTheme.backgroundCard];

    expect(light.accent.base).toBe(LightTheme.accent);
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
