import type { ThemeColors } from './journalTheme';
import type { ThemeMode } from '@/lib/types';
import type { ThemeAmbience } from '@/lib/themeAmbience';

/** Canonical app palette. CSS, native props and image gradients derive from this file. */
export function getNoctaliaPalette(mode: ThemeMode) {
  const dark = mode === 'dark';
  return {
    background: dark ? '#03040D' : '#F0E4D4',
    title: dark ? '#FFF9EF' : '#382D35',
    date: dark ? '#B7AEC9' : '#584447',
    muted: dark ? '#B7AEC9' : '#64514F',
    accent: dark ? '#EAD4B4' : '#7C4C2B',
    surface: dark ? 'rgba(234, 212, 180, 0.06)' : 'rgba(255, 249, 239, 0.14)',
    actionTint: dark ? 'rgba(234, 212, 180, 0.12)' : 'rgba(124, 76, 43, 0.08)',
    raised: dark ? '#14131A' : '#F5EADB',
    line: dark ? '#514637' : 'rgba(126, 83, 49, 0.25)',
    overlay: dark ? 'rgba(0, 0, 0, 0.64)' : 'rgba(38, 27, 28, 0.44)',
    onAccent: dark ? '#382D35' : '#FFF9EF',
    danger: dark ? '#E6A49B' : '#873830',
    status: {
      danger: { background: dark ? '#302126' : '#E4C2AF', border: dark ? '#936D68' : '#A56959', text: dark ? '#E6A49B' : '#873830', icon: dark ? '#E6A49B' : '#873830' },
      success: { background: dark ? '#1C2722' : '#D4D1B4', border: dark ? '#688060' : '#6F7F58', text: dark ? '#B7CFB0' : '#405539', icon: dark ? '#B7CFB0' : '#405539' },
      warning: { background: dark ? '#2C251D' : '#E6CCA6', border: dark ? '#8C7357' : '#9B784F', text: dark ? '#EAD4B4' : '#754B25', icon: dark ? '#EAD4B4' : '#754B25' },
    },
    gradient: dark
      ? (['rgba(3, 4, 13, 0.12)', 'rgba(3, 4, 13, 0.7)', '#03040D'] as const)
      : (['rgba(240, 228, 212, 0)', 'rgba(240, 228, 212, 0.04)', 'rgba(240, 228, 212, 0.5)', '#F0E4D4'] as const),
    gradientLocations: dark ? ([0.3, 0.65, 1] as const) : ([0.44, 0.58, 0.74, 1] as const),
  };
}

/** Opaque equivalent for legacy native consumers that append a hex alpha suffix. */
function onGround(rgba: string, ground: string): string {
  if (!rgba.startsWith('rgba')) return rgba;
  const [r, g, b, alpha] = rgba.match(/[\d.]+/g)!.map(Number);
  return '#' + [r, g, b].map((channel, index) => {
    const base = parseInt(ground.slice(1 + index * 2, 3 + index * 2), 16);
    return Math.round(channel * alpha + base * (1 - alpha)).toString(16).padStart(2, '0');
  }).join('').toUpperCase();
}

export function createNoctaliaTheme(mode: ThemeMode, ambience: ThemeAmbience): ThemeColors {
  const p = getNoctaliaPalette(mode);
  return {
    ambience,
    backgroundDark: p.background,
    backgroundCard: p.raised,
    backgroundSecondary: onGround(p.actionTint, p.background),
    textPrimary: p.title,
    textSecondary: p.muted,
    textTertiary: p.muted,
    textOnAccentSurface: p.onAccent,
    accent: p.accent,
    accentDark: p.accent,
    accentLight: p.accent,
    accentText: p.accent,
    timeline: onGround(p.line, p.background),
    divider: onGround(p.line, p.background),
    overlay: p.overlay,
    navbarBg: p.raised,
    navbarBorder: onGround(p.line, p.raised),
    navbarTextActive: p.title,
    navbarTextInactive: p.muted,
    tags: mode === 'dark'
      ? { surreal: '#7F6FA8', mystical: '#6C568F', calm: '#446B8C', noir: '#31354F' }
      : { surreal: '#B8AECB', mystical: '#C5B8D8', calm: '#A5C4E0', noir: '#A8A8C0' },
  };
}

export function getNoctaliaDesignTokens(colors: ThemeColors, mode: ThemeMode) {
  const p = getNoctaliaPalette(mode);
  const dark = mode === 'dark';
  return {
    screen: { background: p.background, gradient: [p.background, p.background] as const },
    cover: p,
    text: { primary: colors.textPrimary, secondary: colors.textSecondary, tertiary: colors.textTertiary, onAccent: colors.textOnAccentSurface },
    accent: { base: colors.accent, strong: colors.accentDark, soft: colors.accentLight, text: colors.accentText },
    surface: { base: p.raised, raised: p.raised, active: p.actionTint, soft: p.surface, border: p.line, borderStrong: p.line, overlay: p.overlay },
    action: { primary: p.accent, primaryBorder: p.line, primaryText: p.onAccent, disabled: p.actionTint, disabledBorder: p.line, disabledText: p.muted },
    status: p.status,
    nav: { background: colors.navbarBg, border: colors.navbarBorder, active: colors.navbarTextActive, inactive: colors.navbarTextInactive },
    atmosphere: {
      glow: p.accent,
      glowOpacity: dark ? 0.16 : 0.08,
      particle: dark ? 'rgba(234, 212, 180, 0.22)' : 'rgba(124, 76, 43, 0.12)',
      star: dark ? 'rgba(234, 212, 180, 0.7)' : 'rgba(124, 76, 43, 0.25)',
      veil: dark ? 'rgba(25, 35, 68, 0.42)' : 'rgba(240, 228, 212, 0.7)',
      orbit: dark ? 'rgba(234, 212, 180, 0.24)' : 'rgba(124, 76, 43, 0.12)',
      horizon: dark ? 'rgba(255, 249, 239, 0.08)' : 'rgba(124, 76, 43, 0.06)',
    },
  };
}

export type NoctaliaDesignTokens = ReturnType<typeof getNoctaliaDesignTokens>;

/** Single semantic mapping used by the CSS generator; no hand-maintained CSS palette. */
export function getNoctaliaCSSVariables(colors: ThemeColors, mode: ThemeMode): Record<`--${string}`, string> {
  const t = getNoctaliaDesignTokens(colors, mode);
  return {
    '--color-ink': t.screen.background,
    '--color-ink-panel': colors.backgroundSecondary,
    '--color-ink-card': t.surface.base,
    '--color-ink-raised': t.surface.raised,
    '--color-ink-active': t.surface.active,
    '--color-ink-soft': t.surface.soft,
    '--color-ink-solid': colors.backgroundCard,
    '--color-ink-overlay': t.surface.overlay,
    '--color-ink-nav': t.nav.background,
    '--color-ivory': t.text.primary,
    '--color-ivory-muted': t.text.secondary,
    '--color-ivory-faint': t.text.tertiary,
    '--color-ivory-disabled': t.action.disabledText,
    '--color-champagne': t.action.primary,
    '--color-champagne-on': t.accent.text,
    '--color-champagne-deep': t.accent.strong,
    '--color-champagne-soft': t.action.primaryBorder,
    '--color-champagne-dim': t.action.disabled,
    '--color-champagne-dim-line': t.action.disabledBorder,
    '--color-on-champagne': t.action.primaryText,
    '--color-line': t.surface.border,
    '--color-line-strong': t.surface.borderStrong,
    '--color-line-nav': t.nav.border,
    '--color-timeline': colors.timeline,
    '--color-nav-active': t.nav.active,
    '--color-nav-inactive': t.nav.inactive,
    ...Object.fromEntries(Object.entries(t.status).flatMap(([name, status]) => [
      [`--color-${name}`, status.background], [`--color-${name}-line`, status.border],
      [`--color-${name}-on`, status.text], [`--color-${name}-icon`, status.icon],
    ])),
    ...Object.fromEntries(Object.entries(colors.tags).map(([name, color]) => [`--color-tag-${name}`, color])),
    '--color-particle': t.atmosphere.particle,
    '--color-star': t.atmosphere.star,
    '--color-veil': t.atmosphere.veil,
    '--color-orbit': t.atmosphere.orbit,
    '--color-horizon': t.atmosphere.horizon,
  };
}
