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
  divider: '#E8E4DC', // Dividers - very light beige
  overlay: 'rgba(248, 246, 242, 0.9)', // Semi-transparent cream overlay

  // Tag colors - pastel versions
  tags: {
    surreal: '#B8AECB',
    mystical: '#C5B8D8',
    calm: '#A5C4E0',
    noir: '#A8A8C0',
  },
};

/**
 * Shadow system - adapted for light and dark themes
 */
export const Shadows = {
  dark: {
    // Subtle elevation for cards and small elements
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 2,
    },
    // Normal elevation for buttons and interactive elements
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    // Elevated elements like floating buttons
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 6,
    },
    // High elevation for modals and overlays
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 8,
    },
  },
  light: {
    // Subtle elevation for cards and small elements
    sm: {
      shadowColor: '#2A2838',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 1,
    },
    // Normal elevation for buttons and interactive elements
    md: {
      shadowColor: '#2A2838',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 3,
    },
    // Elevated elements like floating buttons
    lg: {
      shadowColor: '#2A2838',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 5,
    },
    // High elevation for modals and overlays
    xl: {
      shadowColor: '#2A2838',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.15,
      shadowRadius: 14,
      elevation: 7,
    },
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
