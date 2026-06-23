import type { ThemeColors } from '@/constants/journalTheme';
import type { ThemeMode } from '@/lib/types';

export type NoctaliaDesignTokens = ReturnType<typeof getNoctaliaDesignTokens>;

export function getNoctaliaDesignTokens(colors: ThemeColors, mode: ThemeMode) {
  const isDark = mode === 'dark';

  return {
    screen: {
      background: colors.backgroundDark,
      gradient: isDark
        ? (['#03040D', '#120D23'] as const)
        : ([colors.backgroundDark, colors.backgroundSecondary] as const),
    },
    text: {
      primary: colors.textPrimary,
      secondary: colors.textSecondary,
      tertiary: colors.textTertiary,
      onAccent: colors.textOnAccentSurface,
    },
    accent: {
      base: colors.accent,
      strong: colors.accentDark,
      soft: colors.accentLight,
    },
    surface: {
      base: isDark ? 'rgba(13, 11, 28, 0.92)' : colors.backgroundCard,
      raised: isDark ? 'rgba(18, 13, 35, 0.86)' : colors.backgroundCard,
      active: isDark ? 'rgba(25, 35, 68, 0.88)' : colors.backgroundSecondary,
      soft: isDark ? 'rgba(255, 249, 239, 0.06)' : colors.backgroundSecondary,
      border: colors.divider,
      borderStrong: isDark ? 'rgba(234, 212, 180, 0.36)' : colors.divider,
      overlay: isDark ? 'rgba(3, 4, 13, 0.72)' : colors.overlay,
    },
    action: {
      primary: colors.accent,
      primaryBorder: colors.accentLight,
      primaryText: colors.textOnAccentSurface,
      disabled: isDark ? 'rgba(234, 212, 180, 0.20)' : 'rgba(212, 165, 116, 0.28)',
      disabledBorder: isDark ? 'rgba(234, 212, 180, 0.18)' : 'rgba(154, 99, 50, 0.18)',
      disabledText: isDark ? 'rgba(255, 249, 239, 0.44)' : 'rgba(42, 40, 56, 0.45)',
    },
    status: {
      danger: {
        background: isDark ? 'rgba(159, 18, 57, 0.22)' : '#FFF1F2',
        border: isDark ? 'rgba(253, 164, 175, 0.35)' : '#FDA4AF',
        text: isDark ? '#FFE4EA' : '#9F1239',
        icon: isDark ? '#FDA4AF' : '#BE123C',
      },
      success: {
        background: isDark ? 'rgba(22, 101, 52, 0.22)' : '#ECFDF3',
        border: isDark ? 'rgba(134, 239, 172, 0.28)' : '#BBF7D0',
        text: isDark ? '#DCFCE7' : '#166534',
        icon: isDark ? '#86EFAC' : '#16A34A',
      },
      warning: {
        background: isDark ? 'rgba(154, 99, 50, 0.22)' : '#FEF3C7',
        border: isDark ? 'rgba(234, 212, 180, 0.34)' : '#F59E0B',
        text: isDark ? '#FFF7D6' : '#92400E',
        icon: isDark ? '#EAD4B4' : '#D97706',
      },
    },
    nav: {
      background: colors.navbarBg,
      border: colors.navbarBorder,
      active: colors.navbarTextActive,
      inactive: colors.navbarTextInactive,
    },
    atmosphere: {
      glow: colors.accent,
      glowOpacity: isDark ? 0.16 : 0.2,
      particle: isDark ? 'rgba(234, 212, 180, 0.22)' : 'rgba(212, 165, 116, 0.34)',
      star: isDark ? 'rgba(234, 212, 180, 0.7)' : 'rgba(154, 99, 50, 0.45)',
      veil: isDark ? 'rgba(25, 35, 68, 0.42)' : 'rgba(243, 239, 231, 0.72)',
      orbit: isDark ? 'rgba(234, 212, 180, 0.24)' : 'rgba(154, 99, 50, 0.18)',
      horizon: isDark ? 'rgba(255, 249, 239, 0.08)' : 'rgba(154, 99, 50, 0.10)',
    },
  };
}
