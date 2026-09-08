import { AfterglowTheme, DarkTheme, LightTheme, MorningTheme } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';

describe('ambience design tokens', () => {
  it('uses warm morning surfaces, disabled actions, feedback and atmosphere', () => {
    const tokens = getNoctaliaDesignTokens(MorningTheme, 'light');
    expect(tokens.surface.raised).toBe('#fff3e4');
    expect(tokens.surface.soft).toBe('#f0e1d2');
    expect(tokens.action.disabled).toBe('rgba(213, 138, 89, 0.25)');
    expect(tokens.status.danger.text).toBe('#8f333b');
    expect(tokens.status.success.background).toBe('#e1eee4');
    expect(tokens.status.warning.icon).toBe('#8a5a12');
    expect(tokens.atmosphere.veil).toBe('rgba(235, 220, 203, 0.7)');
    expect(tokens.text.primary).toBe(MorningTheme.textPrimary);
  });

  it('uses afterglow surfaces and feedback instead of the binary night palette', () => {
    const tokens = getNoctaliaDesignTokens(AfterglowTheme, 'dark');
    expect(tokens.surface.base).toBe('rgba(36, 23, 45, 0.94)');
    expect(tokens.surface.overlay).toBe('rgba(22, 15, 34, 0.76)');
    expect(tokens.action.disabledText).toBe('rgba(255, 244, 233, 0.45)');
    expect(tokens.status.danger.background).toBe('rgba(160, 40, 68, 0.25)');
    expect(tokens.status.success.text).toBe('#e0f3e1');
    expect(tokens.status.warning.border).toBe('rgba(243, 195, 125, 0.36)');
    expect(tokens.atmosphere.star).toBe('rgba(245, 192, 161, 0.72)');
    expect(tokens.nav.background).toBe(AfterglowTheme.navbarBg);
  });

  it('retains binary mode fallback for standard palettes', () => {
    const dark = getNoctaliaDesignTokens(DarkTheme, 'dark');
    const light = getNoctaliaDesignTokens(LightTheme, 'light');
    expect(dark.surface.raised).toBe('rgba(18, 13, 35, 0.86)');
    expect(dark.action.disabled).toBe('rgba(234, 212, 180, 0.20)');
    expect(dark.status.danger.text).toBe('#FFE4EA');
    expect(dark.atmosphere.veil).toBe('rgba(25, 35, 68, 0.42)');
    expect(light.surface.raised).toBe(LightTheme.backgroundCard);
    expect(light.action.disabled).toBe('rgba(212, 165, 116, 0.28)');
    expect(light.status.danger.text).toBe('#9F1239');
    expect(light.atmosphere.veil).toBe('rgba(243, 239, 231, 0.72)');
    expect(getNoctaliaDesignTokens(DarkTheme, 'light').status).toEqual(light.status);
    expect(getNoctaliaDesignTokens(LightTheme, 'dark').status).toEqual(dark.status);
  });
});
