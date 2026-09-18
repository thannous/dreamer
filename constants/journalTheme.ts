import { Platform, type ViewStyle } from 'react-native';
import { createNoctaliaTheme } from './noctaliaPalette';
import type { ThemeAmbience } from '@/lib/themeAmbience';

/**
 * Journal-specific theme constants
 * Supports both dark and light themes with soft, gentle colors for morning use
 */

export interface ThemeColors {
  /** Ambient identity used by feature palettes that retain their own brand colors. */
  ambience: ThemeAmbience;

  // Background colors
  backgroundDark: string;
  backgroundCard: string;
  backgroundSecondary: string;

  // Text colors
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textOnAccentSurface: string;

  // Accent colors
  accent: string;
  accentDark: string;
  accentLight: string;
  /** Accessible accent for copy and icons on paper/night surfaces. Do not use `accent` as text. */
  accentText: string;

  // UI elements
  timeline: string;
  divider: string;
  overlay: string;

  // Navbar colors
  navbarBg: string;
  navbarBorder: string;
  navbarTextActive: string;
  navbarTextInactive: string;

  // Tag colors
  tags: {
    surreal: string;
    mystical: string;
    calm: string;
    noir: string;
  };
}

/** All runtime modes share the same semantic light/dark contract. */
export const DarkTheme: ThemeColors = createNoctaliaTheme('dark', 'dark');
export const LightTheme: ThemeColors = createNoctaliaTheme('light', 'light');
export const MorningTheme: ThemeColors = createNoctaliaTheme('light', 'morning');
export const AfterglowTheme: ThemeColors = createNoctaliaTheme('dark', 'afterglow');

type ShadowConfig = {
  color: string;
  offsetY: number;
  radius: number;
  opacity: number;
  elevation: number;
};

const hexToRgba = (hex: string, opacity: number): string => {
  const normalized = hex.replace('#', '');
  const hasShortSyntax = normalized.length === 3;
  const hexValue = hasShortSyntax
    ? normalized
        .split('')
        .map((char) => char + char)
        .join('')
    : normalized;

  const parsed = Number.parseInt(hexValue, 16);
  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const createShadowStyle = ({ color, offsetY, radius, opacity, elevation }: ShadowConfig): ViewStyle => {
  const nativeShadow: ViewStyle = {
    shadowColor: color,
    shadowOffset: { width: 0, height: offsetY },
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation,
  };

  if (Platform.OS === 'web') {
    return {
      boxShadow: `0px ${offsetY}px ${radius}px ${hexToRgba(color, opacity)}`,
    } as ViewStyle;
  }

  return nativeShadow;
};

/**
 * Shadow system - adapted for light and dark themes
 */
export const Shadows = {
  dark: {
    // Subtle elevation for cards and small elements
    sm: createShadowStyle({
      color: '#000',
      offsetY: 2,
      radius: 4,
      opacity: 0.15,
      elevation: 2,
    }),
    // Normal elevation for buttons and interactive elements
    md: createShadowStyle({
      color: '#000',
      offsetY: 4,
      radius: 8,
      opacity: 0.2,
      elevation: 4,
    }),
    // Elevated elements like floating buttons
    lg: createShadowStyle({
      color: '#000',
      offsetY: 6,
      radius: 12,
      opacity: 0.25,
      elevation: 6,
    }),
    // High elevation for modals and overlays
    xl: createShadowStyle({
      color: '#000',
      offsetY: 8,
      radius: 16,
      opacity: 0.3,
      elevation: 8,
    }),
  },
  light: {
    // Subtle elevation for cards and small elements
    sm: createShadowStyle({
      color: '#2A2838',
      offsetY: 1,
      radius: 3,
      opacity: 0.08,
      elevation: 1,
    }),
    // Normal elevation for buttons and interactive elements
    md: createShadowStyle({
      color: '#2A2838',
      offsetY: 2,
      radius: 6,
      opacity: 0.1,
      elevation: 3,
    }),
    // Elevated elements like floating buttons
    lg: createShadowStyle({
      color: '#2A2838',
      offsetY: 4,
      radius: 10,
      opacity: 0.12,
      elevation: 5,
    }),
    // High elevation for modals and overlays
    xl: createShadowStyle({
      color: '#2A2838',
      offsetY: 6,
      radius: 14,
      opacity: 0.15,
      elevation: 7,
    }),
  },
};

/**
 * Common theme properties (non-color)
 */
export const ThemeLayout = {
  // Spacing and sizes
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg20: 20,
    lg: 24,
    xl: 32,
  },

  // Border radius
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 999,
  },

  // Icon sizes
  iconSize: {
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
  },

  // Timeline specific
  timelineIconSize: 32,
  timelineIconContainerSize: 32,
  timelineLineWidth: 2,
};

/**
 * Decorative line presets used across the app.
 */
export const DecoLines = {
  /** Full-width accent stripe (GlassCard tops) */
  stripe: {
    height: 2.5,
    width: '100%' as const,
    opacity: 0.95,
  },
  /** Short centered rule (headers, section dividers) */
  rule: {
    width: 36,
    height: 2.5,
    borderRadius: 1.5,
    opacity: 0.85,
    alignSelf: 'center' as const,
  },
} as const;

/**
 * Legacy export for backward compatibility
 * @deprecated Use DarkTheme or LightTheme directly
 */
// Backward-compatible theme that includes both colors and layout tokens
// Many components import `JournalTheme` and expect spacing/borderRadius, so
// we merge color palette with layout tokens here.
export type JournalThemeType = ThemeColors & typeof ThemeLayout;
export const JournalTheme: JournalThemeType = {
  ...DarkTheme,
  ...ThemeLayout,
};

/**
 * Get tag color based on theme type and color mode
 * @param theme - The dream theme type (surreal, mystical, calm, noir)
 * @param colors - The theme colors to use (DarkTheme or LightTheme)
 */
export function getTagColor(theme?: string, colors: ThemeColors = DarkTheme): string {
  if (!theme) return colors.tags.surreal;

  const themeKey = theme.toLowerCase() as keyof typeof colors.tags;
  return colors.tags[themeKey] || colors.tags.surreal;
}
