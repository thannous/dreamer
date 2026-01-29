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
  backgroundDark: 'rgb(26, 15, 43)', // Main background softened for better readability
  backgroundCard: '#231a3f', // Card background with higher lift above main background
  backgroundSecondary: '#5A4B89', // Secondary elements (buttons, inputs)

  // Text colors
  textPrimary: '#FFFFFF', // Main text
  textSecondary: '#a097b8', // Secondary/muted text
  textTertiary: '#6B6B8D', // Even more muted
  textOnAccentSurface: '#F2EDFF', // High-contrast lavender for tinted cards

  // Accent colors
  accent: '#6B5A8E', // Surreal purple accent for CTAs
  accentDark: '#4F3D6B', // Deeper purple for pressed states
  accentLight: '#A097B8', // Muted lilac for subtle highlights

  // UI elements
  timeline: '#5a4b89', // Timeline line color
  divider: '#2f2153', // Dividers
  overlay: 'rgba(27, 21, 51, 0.85)', // Semi-transparent overlay

  // Navbar colors
  navbarBg: 'rgb(26, 15, 43)', // Same as backgroundDark
  navbarBorder: '#2f2153', // Same as divider
  navbarTextActive: '#FFFFFF', // White for active tab
  navbarTextInactive: '#9B8EC7', // Muted purple for inactive tabs

  // Tag colors
  tags: {
    surreal: '#6b5a8e',
    mystical: '#5d4b7a',
    calm: '#4a6fa5',
    noir: '#3d3d5c',
  },
};

/**
 * Light theme - soft cream and champagne gold for gentle morning viewing
 */
export const LightTheme: ThemeColors = {
  // Background colors
  backgroundDark: '#F8F6F2', // Main background - soft cream
  backgroundCard: '#E3DACC', // Card background - beige sable
  backgroundSecondary: '#EEEBE6', // Secondary elements - light beige

  // Text colors
  textPrimary: '#2A2838', // Main text - deep purple-gray
  textSecondary: '#6B6880', // Secondary text - muted purple-gray
  textTertiary: '#9B98AC', // Tertiary text - lighter gray
  textOnAccentSurface: '#7A4B1F', // Rich amber for better contrast on warm cards

  // Accent colors
  accent: '#D4A574', // Champagne gold accent
  accentDark: '#C9A567', // Darker champagne
  accentLight: '#E3C592', // Lighter champagne

  // UI elements
  timeline: '#D4CFBF', // Timeline - soft beige
  divider: '#D5CFC4', // Dividers - visible beige with contrast
  overlay: 'rgba(248, 246, 242, 0.9)', // Semi-transparent cream overlay

  // Navbar colors
  navbarBg: '#F8F6F2', // Same as backgroundDark (light theme)
  navbarBorder: '#E8E4DC', // Same as divider
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
