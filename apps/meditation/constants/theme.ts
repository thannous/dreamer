/**
 * Noctalia design tokens — source of truth for values that cannot go through
 * Tailwind classes (SVG fills, gradient stops, native shadow objects).
 *
 * Anything that CAN be expressed as a utility class must be, via the CSS
 * variables declared in `global.css`. Keep the two files in sync.
 */

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = ThemeMode | 'auto';

/** The product opens in Noctalia's night palette; system mode is an explicit choice. */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'dark';

export interface ThemeColors {
  background: string;
  /**
   * Translucent on purpose: cards sit over the aurora and are meant to sample
   * it. An opaque fill punches a flat hole in the atmosphere — which is exactly
   * what made the surfaces read as paper rather than glass.
   */
  backgroundCard: string;
  backgroundSecondary: string;
  /** Chrome that floats over scrolling content — it has to stay readable. */
  backgroundRaised: string;
  /** Opaque base for the blur tint in `GlassCard`; alpha is applied separately. */
  glassTint: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  /** Copy and icons. `accent` is for fills and rules ONLY — never for text. */
  accentText: string;
  accentDark: string;
  accentLight: string;
  accentBorder: string;
  textOnAccent: string;
  divider: string;
  navbarBg: string;
  navbarBorder: string;
}

export const NightTheme: ThemeColors = {
  background: '#03040D',
  backgroundCard: 'rgba(20, 19, 26, 0.84)',
  backgroundSecondary: 'rgba(234, 212, 180, 0.06)',
  backgroundRaised: 'rgba(20, 19, 26, 0.9)',
  glassTint: '#14131A',
  textPrimary: '#FFF9EF',
  textSecondary: '#B7AEC9',
  textTertiary: '#B7AEC9',
  accent: '#EAD4B4',
  accentText: '#EAD4B4',
  accentDark: '#EAD4B4',
  accentLight: '#EAD4B4',
  accentBorder: '#514637',
  textOnAccent: '#382D35',
  divider: '#514637',
  navbarBg: 'rgba(20, 19, 26, 0.9)',
  navbarBorder: 'rgba(234, 212, 180, 0.18)'
};

export const PaperTheme: ThemeColors = {
  background: '#F0E4D4',
  backgroundCard: 'rgba(245, 234, 219, 0.88)',
  backgroundSecondary: 'rgba(255, 249, 239, 0.14)',
  backgroundRaised: 'rgba(245, 234, 219, 0.94)',
  glassTint: '#F5EADB',
  textPrimary: '#382D35',
  textSecondary: '#64514F',
  textTertiary: '#64514F',
  accent: '#7C4C2B',
  accentText: '#7C4C2B',
  accentDark: '#7C4C2B',
  accentLight: '#7C4C2B',
  accentBorder: 'rgba(126, 83, 49, 0.25)',
  textOnAccent: '#FFF9EF',
  divider: 'rgba(126, 83, 49, 0.25)',
  navbarBg: 'rgba(245, 234, 219, 0.94)',
  navbarBorder: 'rgba(124, 76, 43, 0.16)'
};

export const Themes: Record<ThemeMode, ThemeColors> = { dark: NightTheme, light: PaperTheme };

/** Generated from constants/noctaliaPalette.ts by npm run theme:generate. */
export const NavigationMaterial = {
  dark: {
    glass: {
      tint: 'rgba(20, 19, 26, 0.7)',
      solid: 'rgba(20, 19, 26, 0.9)',
      highlight: [
        'rgba(255, 249, 239, 0.09)',
        'rgba(255, 249, 239, 0)'
      ],
      rim: 'rgba(234, 212, 180, 0.18)'
    },
    active: {
      fill: 'rgba(234, 212, 180, 0.12)',
      sheen: [
        'rgba(255, 249, 239, 0.12)',
        'rgba(255, 249, 239, 0)'
      ],
      rim: 'rgba(234, 212, 180, 0.26)'
    }
  },
  light: {
    glass: {
      tint: 'rgba(245, 234, 219, 0.6)',
      solid: 'rgba(245, 234, 219, 0.94)',
      highlight: [
        'rgba(255, 255, 255, 0.55)',
        'rgba(255, 255, 255, 0)'
      ],
      rim: 'rgba(124, 76, 43, 0.16)'
    },
    active: {
      fill: 'rgba(124, 76, 43, 0.08)',
      sheen: [
        'rgba(255, 255, 255, 0.6)',
        'rgba(255, 255, 255, 0)'
      ],
      rim: 'rgba(124, 76, 43, 0.2)'
    }
  }
} as const;

/** Noctalia's atmosphere; paintings carry the colour, without a second aurora palette. */
export const Atmosphere = {
  dark: {
    glow: '#EAD4B4',
    glowOpacity: 0.16,
    particle: 'rgba(234, 212, 180, 0.22)',
    star: 'rgba(234, 212, 180, 0.7)',
    veil: 'rgba(25, 35, 68, 0.42)',
    orbit: 'rgba(234, 212, 180, 0.24)',
    horizon: 'rgba(255, 249, 239, 0.08)',
    sheen: '#FFF9EF',
    gradient: [
      '#03040D',
      '#03040D',
      '#03040D'
    ],
    gradientLocations: [
      0,
      0.55,
      1
    ]
  },
  light: {
    glow: '#7C4C2B',
    glowOpacity: 0.08,
    particle: 'rgba(124, 76, 43, 0.12)',
    star: 'rgba(124, 76, 43, 0.25)',
    veil: 'rgba(240, 228, 212, 0.7)',
    orbit: 'rgba(124, 76, 43, 0.12)',
    horizon: 'rgba(124, 76, 43, 0.06)',
    sheen: '#93571F',
    gradient: [
      '#F0E4D4',
      '#F0E4D4',
      '#F0E4D4'
    ],
    gradientLocations: [
      0,
      0.55,
      1
    ]
  }
} as const;

/** Opacity of the glass card fill, per mode (matches the Noctalia journal app). */
export const GlassOpacity: Record<ThemeMode, number> = { dark: 0.3, light: 0.96 };

/** Readability veil for copy rendered over world thumbnails. Native prop
 * colours live here rather than as one-off RGBA literals in components. */
export const ArtworkScrim = {
  transparent: 'rgba(3, 4, 13, 0.04)',
  strong: 'rgba(3, 4, 13, 0.84)',
} as const;

/** Onboarding artwork uses the same ink ground as the listening experience. */
export const OnboardingScrim = {
  welcome: [
    'rgba(3, 4, 13, 0.7)',
    'rgba(3, 4, 13, 0.08)',
    'rgba(3, 4, 13, 0.14)',
    'rgba(3, 4, 13, 0.78)',
  ] as const,
  experience: 'rgba(3, 4, 13, 0.58)',
  dial: 'rgba(3, 4, 13, 0.74)',
} as const;

/**
 * Theme-aware material placed over world artwork. These values stay in
 * TypeScript because they feed native colour and border props rather than
 * utility classes.
 */
export const ArtworkGlass = {
  light: {
    fill: PaperTheme.backgroundCard,
    border: PaperTheme.divider,
    specular: NavigationMaterial.light.glass.highlight[0],
    artworkFill: PaperTheme.backgroundSecondary,
    artworkBorder: PaperTheme.divider,
    artworkOpacity: 1,
    artworkScrim: [
      'rgba(240, 228, 212, 0.56)',
      'rgba(240, 228, 212, 0.16)',
      'rgba(240, 228, 212, 0.00)',
    ],
    artworkScrimLocations: [0, 0.42, 1],
    artworkScrimEnd: { x: 0.76, y: 0 },
  },
  dark: {
    fill: NightTheme.backgroundCard,
    border: NightTheme.divider,
    specular: NavigationMaterial.dark.glass.highlight[0],
    artworkFill: NightTheme.backgroundSecondary,
    artworkBorder: NightTheme.divider,
    artworkOpacity: 1,
    artworkScrim: [
      'rgba(3, 4, 13, 0.90)',
      'rgba(3, 4, 13, 0.48)',
      'rgba(3, 4, 13, 0.00)',
    ],
    artworkScrimLocations: [0, 0.46, 1],
    artworkScrimEnd: { x: 0.72, y: 0 },
  },
} as const satisfies Record<ThemeMode, {
  fill: string;
  border: string;
  specular: string;
  artworkFill: string;
  artworkBorder: string;
  artworkOpacity: number;
  artworkScrim: readonly [string, string, string];
  artworkScrimLocations: readonly [number, number, number];
  artworkScrimEnd: { x: number; y: number };
}>;

export const Radius = { sm: 8, md: 12, lg: 16, xl: 24, artwork: 28, full: 999 } as const;
