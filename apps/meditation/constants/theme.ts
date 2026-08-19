/**
 * Noctalia design tokens — source of truth for values that cannot go through
 * Tailwind classes (SVG fills, gradient stops, native shadow objects).
 *
 * Anything that CAN be expressed as a utility class must be, via the CSS
 * variables declared in `global.css`. Keep the two files in sync.
 */

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = ThemeMode | 'auto';

export interface ThemeColors {
  background: string;
  backgroundCard: string;
  backgroundSecondary: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  /** Copy and icons. `accent` is for fills and rules ONLY — never for text. */
  accentText: string;
  accentDark: string;
  accentLight: string;
  textOnAccent: string;
  divider: string;
  navbarBg: string;
  navbarBorder: string;
}

export const NightTheme: ThemeColors = {
  background: '#03040D',
  backgroundCard: '#0D0B1C',
  backgroundSecondary: '#192344',
  textPrimary: '#FFF9EF',
  textSecondary: '#B7AEC9',
  textTertiary: '#8E84A7',
  accent: '#D4A574',
  accentText: '#EAD4B4',
  accentDark: '#9A6332',
  accentLight: '#EAD4B4',
  textOnAccent: '#3B2412',
  divider: '#514637',
  navbarBg: '#050510',
  navbarBorder: '#514637',
};

export const PaperTheme: ThemeColors = {
  background: '#FBFAF7',
  backgroundCard: '#FFFDF8',
  backgroundSecondary: '#F3EFE7',
  textPrimary: '#2A2838',
  textSecondary: '#6B6880',
  textTertiary: '#6F6C84',
  accent: '#D4A574',
  accentText: '#9A6332',
  accentDark: '#9A6332',
  accentLight: '#EAD4B4',
  textOnAccent: '#4A2F1B',
  divider: '#E4DDD2',
  navbarBg: '#FBFAF7',
  navbarBorder: '#E8E2D8',
};

export const Themes: Record<ThemeMode, ThemeColors> = {
  dark: NightTheme,
  light: PaperTheme,
};

/**
 * Atmosphere — the Noctalia answer to the template's "aurora gradients".
 * A quiet ink wash, thin gold orbits, and star dust. No decorative blobs.
 */
export const Atmosphere = {
  dark: {
    gradient: ['#03040D', '#120D23', '#0D0B1C'] as const,
    gradientLocations: [0, 0.55, 1] as const,
    orbit: 'rgba(234, 212, 180, 0.24)',
    star: 'rgba(234, 212, 180, 0.70)',
    veil: 'rgba(25, 35, 68, 0.42)',
    glow: '#D4A574',
    glowOpacity: 0.16,
    horizon: 'rgba(255, 249, 239, 0.08)',
  },
  light: {
    gradient: ['#FBFAF7', '#F3EFE7', '#FBFAF7'] as const,
    gradientLocations: [0, 0.55, 1] as const,
    orbit: 'rgba(154, 99, 50, 0.18)',
    star: 'rgba(154, 99, 50, 0.45)',
    veil: 'rgba(243, 239, 231, 0.72)',
    glow: '#D4A574',
    glowOpacity: 0.2,
    horizon: 'rgba(154, 99, 50, 0.10)',
  },
} as const;

/** Opacity of the glass card fill, per mode (matches the Noctalia journal app). */
export const GlassOpacity: Record<ThemeMode, number> = { dark: 0.3, light: 0.96 };

export const Radius = { sm: 8, md: 12, lg: 16, xl: 24, artwork: 28, full: 999 } as const;

export const Spacing = { xs: 4, sm: 8, md: 16, lg20: 20, lg: 24, xl: 32 } as const;

/** Short centred rule used under section headers. */
export const DecoRule = { width: 36, height: 2.5, radius: 1.5, opacity: 0.85 } as const;

/** Full-width accent stripe sitting on top of featured cards. */
export const DecoStripe = { height: 2.5, opacity: 0.95 } as const;
