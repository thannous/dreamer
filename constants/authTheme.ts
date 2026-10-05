import type { ThemeColors } from './journalTheme';
import { getLucidPalette } from './lucidTheme';
import { getNoctaliaDesignTokens } from './noctaliaDesign';
import { isLucidTrainer } from '@/lib/appVariant';
import type { ThemeMode } from '@/lib/types';

/** Shared auth keeps Journal's default contract; the standalone Lucid app uses jade. */
export function getAuthDesignTokens(colors: ThemeColors, mode: ThemeMode) {
  const base = getNoctaliaDesignTokens(colors, mode);
  if (!isLucidTrainer) return base;
  const p = getLucidPalette(colors, mode);
  const status = (text: string, background: string) => ({ text, icon: text, background, border: text });
  return {
    ...base,
    screen: { background: p.background, gradient: [p.background, p.background] as const },
    text: { primary: p.text, secondary: p.textSecondary, tertiary: p.textMuted, onAccent: p.backgroundDeep },
    accent: { base: p.accent, strong: p.accentStrong, soft: p.accentSoft, text: p.accentOn },
    surface: { base: p.surface, raised: p.surface, active: p.surfaceRaised, soft: p.surfaceMuted, border: p.border, borderStrong: p.borderInteractive, overlay: p.overlay },
    action: { primary: p.accentStrong, primaryBorder: p.accentStrong, primaryText: p.backgroundDeep, disabled: p.surfaceRaised, disabledBorder: p.border, disabledText: p.textMuted },
    status: { danger: status(p.danger, p.dangerSoft), warning: status(p.amber, p.amberSoft), success: status(p.success, p.successSoft) },
  };
}
