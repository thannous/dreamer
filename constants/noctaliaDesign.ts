import type { ThemeColors } from '@/constants/journalTheme';
import type { ThemeMode } from '@/lib/types';

export type NoctaliaDesignTokens = ReturnType<typeof getNoctaliaDesignTokens>;

export function getNoctaliaDesignTokens(colors: ThemeColors, mode: ThemeMode) {
  const isDark = mode === 'dark';
  const isMorning = colors.ambience === 'morning';
  const isAfterglow = colors.ambience === 'afterglow';

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
      /** Copy and icons on paper/night surfaces. `base` is for fills and rules only. */
      text: colors.accentText,
    },
    surface: {
      base: isMorning
        ? '#fff8ec'
        : isAfterglow
          ? 'rgba(36, 23, 45, 0.94)'
          : isDark ? 'rgba(13, 11, 28, 0.92)' : colors.backgroundCard,
      raised: isMorning
        ? '#fff3e4'
        : isAfterglow
          ? 'rgba(49, 29, 58, 0.9)'
          : isDark ? 'rgba(18, 13, 35, 0.86)' : colors.backgroundCard,
      active: isMorning
        ? '#ebdccb'
        : isAfterglow
          ? 'rgba(58, 36, 68, 0.92)'
          : isDark ? 'rgba(25, 35, 68, 0.88)' : colors.backgroundSecondary,
      soft: isMorning
        ? '#f0e1d2'
        : isAfterglow
          ? 'rgba(255, 244, 233, 0.07)'
          : isDark ? 'rgba(255, 249, 239, 0.06)' : colors.backgroundSecondary,
      border: colors.divider,
      borderStrong: isMorning
        ? '#cdb5a2'
        : isAfterglow
          ? 'rgba(245, 192, 161, 0.34)'
          : isDark ? 'rgba(234, 212, 180, 0.36)' : colors.divider,
      overlay: isMorning
        ? 'rgba(255, 248, 236, 0.9)'
        : isAfterglow
          ? 'rgba(22, 15, 34, 0.76)'
          : isDark ? 'rgba(3, 4, 13, 0.72)' : colors.overlay,
    },
    action: {
      primary: colors.accent,
      primaryBorder: colors.accentLight,
      primaryText: colors.textOnAccentSurface,
      disabled: isMorning
        ? 'rgba(213, 138, 89, 0.25)'
        : isAfterglow
          ? 'rgba(233, 154, 121, 0.22)'
          : isDark ? 'rgba(234, 212, 180, 0.20)' : 'rgba(212, 165, 116, 0.28)',
      disabledBorder: isMorning
        ? 'rgba(149, 84, 51, 0.2)'
        : isAfterglow
          ? 'rgba(245, 192, 161, 0.2)'
          : isDark ? 'rgba(234, 212, 180, 0.18)' : 'rgba(154, 99, 50, 0.18)',
      disabledText: isMorning
        ? 'rgba(48, 39, 34, 0.45)'
        : isAfterglow
          ? 'rgba(255, 244, 233, 0.45)'
          : isDark ? 'rgba(255, 249, 239, 0.44)' : 'rgba(42, 40, 56, 0.45)',
    },
    status: {
      danger: {
        background: isMorning
          ? '#fae8e5'
          : isAfterglow
            ? 'rgba(160, 40, 68, 0.25)'
            : isDark ? 'rgba(159, 18, 57, 0.22)' : '#FFF1F2',
        border: isMorning
          ? '#d99a94'
          : isAfterglow
            ? 'rgba(255, 158, 161, 0.38)'
            : isDark ? 'rgba(253, 164, 175, 0.35)' : '#FDA4AF',
        text: isMorning
          ? '#8f333b'
          : isAfterglow
            ? '#ffe5e6'
            : isDark ? '#FFE4EA' : '#9F1239',
        icon: isMorning
          ? '#a63b42'
          : isAfterglow
            ? '#ff9ea1'
            : isDark ? '#FDA4AF' : '#BE123C',
      },
      success: {
        background: isMorning
          ? '#e1eee4'
          : isAfterglow
            ? 'rgba(53, 104, 74, 0.27)'
            : isDark ? 'rgba(22, 101, 52, 0.22)' : '#ECFDF3',
        border: isMorning
          ? '#a5c9ad'
          : isAfterglow
            ? 'rgba(167, 214, 168, 0.34)'
            : isDark ? 'rgba(134, 239, 172, 0.28)' : '#BBF7D0',
        text: isMorning
          ? '#28583d'
          : isAfterglow
            ? '#e0f3e1'
            : isDark ? '#DCFCE7' : '#166534',
        icon: isMorning
          ? '#35684a'
          : isAfterglow
            ? '#a7d6a8'
            : isDark ? '#86EFAC' : '#16A34A',
      },
      warning: {
        background: isMorning
          ? '#f7e6c9'
          : isAfterglow
            ? 'rgba(126, 76, 51, 0.3)'
            : isDark ? 'rgba(154, 99, 50, 0.22)' : '#FEF3C7',
        border: isMorning
          ? '#d8ad6e'
          : isAfterglow
            ? 'rgba(243, 195, 125, 0.36)'
            : isDark ? 'rgba(234, 212, 180, 0.34)' : '#F59E0B',
        text: isMorning
          ? '#74470e'
          : isAfterglow
            ? '#fff0d7'
            : isDark ? '#FFF7D6' : '#92400E',
        icon: isMorning
          ? '#8a5a12'
          : isAfterglow
            ? '#f3c37d'
            : isDark ? '#EAD4B4' : '#D97706',
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
      particle: isMorning
        ? 'rgba(213, 138, 89, 0.35)'
        : isAfterglow
          ? 'rgba(245, 192, 161, 0.25)'
          : isDark ? 'rgba(234, 212, 180, 0.22)' : 'rgba(212, 165, 116, 0.34)',
      star: isMorning
        ? 'rgba(149, 84, 51, 0.42)'
        : isAfterglow
          ? 'rgba(245, 192, 161, 0.72)'
          : isDark ? 'rgba(234, 212, 180, 0.7)' : 'rgba(154, 99, 50, 0.45)',
      veil: isMorning
        ? 'rgba(235, 220, 203, 0.7)'
        : isAfterglow
          ? 'rgba(126, 76, 139, 0.36)'
          : isDark ? 'rgba(25, 35, 68, 0.42)' : 'rgba(243, 239, 231, 0.72)',
      orbit: isMorning
        ? 'rgba(149, 84, 51, 0.2)'
        : isAfterglow
          ? 'rgba(233, 154, 121, 0.28)'
          : isDark ? 'rgba(234, 212, 180, 0.24)' : 'rgba(154, 99, 50, 0.18)',
      horizon: isMorning
        ? 'rgba(135, 176, 184, 0.14)'
        : isAfterglow
          ? 'rgba(255, 244, 233, 0.1)'
          : isDark ? 'rgba(255, 249, 239, 0.08)' : 'rgba(154, 99, 50, 0.10)',
    },
  };
}
