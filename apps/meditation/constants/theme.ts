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
  textOnAccent: string;
  divider: string;
  navbarBg: string;
  navbarBorder: string;
}

export const NightTheme: ThemeColors = {
  background: '#03040D',
  backgroundCard: 'rgba(20, 18, 40, 0.55)',
  backgroundSecondary: 'rgba(25, 35, 68, 0.42)',
  backgroundRaised: 'rgba(8, 8, 20, 0.92)',
  glassTint: '#0D0B1C',
  textPrimary: '#FFF9EF',
  textSecondary: '#B7AEC9',
  textTertiary: '#8E84A7',
  accent: '#D4A574',
  accentText: '#EAD4B4',
  accentDark: '#9A6332',
  accentLight: '#EAD4B4',
  textOnAccent: '#3B2412',
  divider: 'rgba(234, 212, 180, 0.16)',
  navbarBg: 'rgba(8, 8, 20, 0.92)',
  navbarBorder: 'rgba(234, 212, 180, 0.14)',
};

export const PaperTheme: ThemeColors = {
  background: '#F5F0E8',
  backgroundCard: 'rgba(255, 253, 248, 0.62)',
  backgroundSecondary: 'rgba(243, 239, 231, 0.55)',
  backgroundRaised: 'rgba(252, 251, 248, 0.92)',
  glassTint: '#FFFDF8',
  textPrimary: '#2A2838',
  textSecondary: '#6B6880',
  textTertiary: '#6F6C84',
  accent: '#D4A574',
  accentText: '#9A6332',
  accentDark: '#9A6332',
  accentLight: '#EAD4B4',
  textOnAccent: '#4A2F1B',
  divider: 'rgba(154, 99, 50, 0.16)',
  navbarBg: 'rgba(252, 251, 248, 0.92)',
  navbarBorder: 'rgba(154, 99, 50, 0.14)',
};

export const Themes: Record<ThemeMode, ThemeColors> = {
  dark: NightTheme,
  light: PaperTheme,
};

/**
 * Atmosphere — the Noctalia answer to the template's "aurora gradients".
 * An ink wash, thin gold orbits, star dust, and a few very wide colour fields.
 *
 * Those colour fields used to be ruled out on purpose. They came back because
 * translucent surfaces need something to refract: the light gradient was three
 * near-identical off-whites, so every card sampled the same beige and the glass
 * read as flat paper. Warm ground, cool counterpoint — that tension is what the
 * light theme was missing, and the dark theme already had.
 *
 * They stay wide (radius near the screen's long side) and low in opacity: the
 * eye should read a coloured light, never a blob with an edge.
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
    aurora: [
      { cx: 0.12, cy: 0.26, r: 0.82, color: '#4F3D6B', opacity: 0.5 },
      { cx: 0.9, cy: 0.58, r: 0.72, color: '#26456B', opacity: 0.42 },
      { cx: 0.42, cy: 0.9, r: 0.66, color: '#6C568F', opacity: 0.26 },
    ] as const,
  },
  light: {
    // Deeper than the cards on purpose. A near-white ground under a
    // near-white translucent card gives no separation at all — the panels
    // have to read as lighter than what they float on.
    gradient: ['#F5F0E8', '#EFE9E1', '#E8E5EF'] as const,
    gradientLocations: [0, 0.55, 1] as const,
    orbit: 'rgba(154, 99, 50, 0.18)',
    star: 'rgba(154, 99, 50, 0.45)',
    // Much lighter than its dark counterpart. The veil exists so text stays
    // readable over the lower half, but in this theme the text is ink on a pale
    // ground and was never at risk — all a heavy veil did was wash the aurora
    // out precisely where the cards sit and most need something to sample.
    veil: 'rgba(243, 239, 231, 0.3)',
    glow: '#D4A574',
    glowOpacity: 0.3,
    horizon: 'rgba(154, 99, 50, 0.10)',
    aurora: [
      { cx: 0.08, cy: 0.34, r: 0.85, color: '#9B86C4', opacity: 0.44 },
      { cx: 0.88, cy: 0.62, r: 0.74, color: '#87AFD6', opacity: 0.36 },
      { cx: 0.5, cy: 0.94, r: 0.68, color: '#E8CBA4', opacity: 0.52 },
    ] as const,
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
