import { Platform, type ViewStyle } from 'react-native';

/**
 * Journal-specific theme constants
 * Supports both dark and light themes with soft, gentle colors for morning use
 */

export interface ThemeColors {
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

/**
 * Dark theme - original purple and gold theme
 */
export const DarkTheme: ThemeColors = {
  // Background colors
  backgroundDark: '#03040D', // Deep nocturnal base used by the premium onboarding direction
  backgroundCard: '#0D0B1C', // Matte card surface with a quiet navy/purple undertone
  backgroundSecondary: '#192344', // Secondary panels and inputs, less saturated than the legacy violet

  // Text colors
  textPrimary: '#FFF9EF', // Warm ivory, softer than pure white
  textSecondary: '#B7AEC9', // Muted moon-lilac for secondary copy
  textTertiary: '#8E84A7', // Tertiary copy and inactive controls
  textOnAccentSurface: '#3B2412', // Deep amber-brown for gold CTAs

  // Accent colors
  accent: '#D4A574', // Champagne/wheat accent shared with the light palette
  accentDark: '#9A6332', // Pressed states and strong borders
  accentLight: '#EAD4B4', // Soft highlight and hairlines

  // UI elements
  timeline: '#6B573D', // Timeline line color
  divider: '#514637', // Warm hairlines, kept as hex for alpha suffix compatibility
  overlay: 'rgba(3, 4, 13, 0.88)', // Semi-transparent overlay

  // Navbar colors
  navbarBg: '#050510',
  navbarBorder: '#514637',
  navbarTextActive: '#FFF9EF',
  navbarTextInactive: '#AFA7BB',

  // Tag colors
  tags: {
    surreal: '#7F6FA8',
    mystical: '#6C568F',
    calm: '#446B8C',
    noir: '#31354F',
  },
};

/**
 * Light theme - soft cream and champagne gold for gentle morning viewing
 */
export const LightTheme: ThemeColors = {
  // Background colors
  backgroundDark: '#FBFAF7', // Main background - quiet paper tone
  backgroundCard: '#FFFDF8', // Card background - clean readable surface
  backgroundSecondary: '#F3EFE7', // Secondary elements - soft warm neutral

  // Text colors
  textPrimary: '#2A2838', // Main text - deep purple-gray
  textSecondary: '#6B6880', // Secondary text - muted purple-gray
  textTertiary: '#9B98AC', // Tertiary text - lighter gray
  textOnAccentSurface: '#4A2F1B', // Deep amber-brown for contrast on warm accents

  // Accent colors
  accent: '#D4A574', // Champagne gold accent
  accentDark: '#9A6332', // Darker amber for text, borders, pressed states
  accentLight: '#EAD4B4', // Lighter champagne

  // UI elements
  timeline: '#E7DED0', // Timeline - subtle warm line
  divider: '#E4DDD2', // Dividers - soft but visible
  overlay: 'rgba(251, 250, 247, 0.92)', // Semi-transparent paper overlay

  // Navbar colors
  navbarBg: '#FBFAF7', // Same as backgroundDark
  navbarBorder: '#E8E2D8', // Same family as divider
  navbarTextActive: '#2A2838', // Dark text for active tab
  navbarTextInactive: '#9B98AC', // Muted gray for inactive tabs

  // Tag colors - pastel versions
  tags: {
    surreal: '#B8AECB',
    mystical: '#C5B8D8',
    calm: '#A5C4E0',
    noir: '#A8A8C0',
  },
};

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
