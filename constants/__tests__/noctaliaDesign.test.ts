import { AfterglowTheme, DarkTheme, LightTheme, MorningTheme } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';

describe('common semantic theme', () => {
  it.each([
    { standard: LightTheme, automatic: MorningTheme, mode: 'light' as const },
    { standard: DarkTheme, automatic: AfterglowTheme, mode: 'dark' as const },
  ])('keeps automatic $mode surfaces and actions consistent with the selected mode', ({ standard, automatic, mode }) => {
    const baseline = getNoctaliaDesignTokens(standard, mode);
    const timed = getNoctaliaDesignTokens(automatic, mode);
    expect(timed).toEqual(baseline);
    expect(automatic.ambience).not.toBe(standard.ambience);
  });

  it('preserves the approved dark palette', () => {
    const dark = getNoctaliaDesignTokens(DarkTheme, 'dark');
    expect(dark.screen.background).toBe('#03040D');
    expect(dark.surface.raised).toBe('#14131A');
    expect(dark.surface.active).toBe('rgba(234, 212, 180, 0.12)');
    expect(dark.surface.soft).toBe('rgba(234, 212, 180, 0.06)');
    expect(dark.text.primary).toBe('#FFF9EF');
    expect(dark.text.secondary).toBe('#B7AEC9');
    expect(dark.action.primary).toBe('#EAD4B4');
    expect(dark.action.primaryText).toBe('#382D35');
    expect(dark.status.danger.text).toBe('#E6A49B');
  });

  it('uses lighter satin for the page, illustration fade and solid dialogs', () => {
    const light = getNoctaliaDesignTokens(LightTheme, 'light');
    expect(light.screen.background).toBe('#F0E4D4');
    expect(light.cover.gradient.at(-1)).toBe(light.screen.background);
    expect(light.surface.raised).toBe(LightTheme.backgroundCard);
    expect(light.nav.background).toBe(light.surface.raised);
  });
});
