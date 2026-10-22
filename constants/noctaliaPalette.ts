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
    // `raised` with a light veil: the screen's painting shows through cards laid on it.
    raisedTranslucent: dark ? 'rgba(20, 19, 26, 0.84)' : 'rgba(245, 234, 219, 0.88)',
    line: dark ? '#514637' : 'rgba(126, 83, 49, 0.25)',
    // The floating navigation's frosted glass: the tint laid over the blur, a denser tint
    // where nothing is blurred (Android), the light its top edge catches, and its rim.
    // The tint keeps the tab labels at 4.5:1 over a painting or card scrolling beneath.
    navGlass: {
      tint: dark ? 'rgba(20, 19, 26, 0.7)' : 'rgba(245, 234, 219, 0.6)',
      solid: dark ? 'rgba(20, 19, 26, 0.9)' : 'rgba(245, 234, 219, 0.94)',
      highlight: dark ? ['rgba(255, 249, 239, 0.09)', 'rgba(255, 249, 239, 0)'] as const : ['rgba(255, 255, 255, 0.55)', 'rgba(255, 255, 255, 0)'] as const,
      rim: dark ? 'rgba(234, 212, 180, 0.18)' : 'rgba(124, 76, 43, 0.16)',
    },
    // Noctalia listening: the halo that swells behind "I'm listening…" with the dreamer's voice.
    listeningHalo: dark ? '#F2D3B8' : '#E7A873',
    // The full moon's silver seal: its lit face, its seas, and a rim that holds it on paper
    // (the rim keeps 4.5:1 against the paper).
    fullMoon: {
      light: dark ? '#F3F5FA' : '#EEF0F5',
      shade: dark ? '#AEB6C6' : '#9AA2B2',
      rim: dark ? '#D9DEE8' : '#5E6778',
      halo: dark ? 'rgba(217, 222, 232, 0.3)' : 'rgba(94, 103, 120, 0.18)',
    },
    // The active tab's lens inside that glass: a champagne tint, a sheen across its top, a rim.
    navActive: {
      fill: dark ? 'rgba(234, 212, 180, 0.12)' : 'rgba(124, 76, 43, 0.08)',
      sheen: dark ? ['rgba(255, 249, 239, 0.12)', 'rgba(255, 249, 239, 0)'] as const : ['rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0)'] as const,
      rim: dark ? 'rgba(234, 212, 180, 0.26)' : 'rgba(124, 76, 43, 0.2)',
    },
    overlay: dark ? 'rgba(0, 0, 0, 0.64)' : 'rgba(38, 27, 28, 0.44)',
    onAccent: dark ? '#382D35' : '#FFF9EF',
    // The journal's block of leaves and its binding as its art draws them, in night paper
    // or ivory: the dream page's own edges take them over at the end of the capture seal.
    journalLeaves: {
      inner: dark ? '#161C2E' : '#DDCDB2',
      outer: dark ? '#0E1323' : '#B49B76',
      line: dark ? '#080D1D' : '#A68B66',
      light: dark ? '#1C2236' : '#E6D3B4',
      binding: dark ? '#060915' : '#B7A180',
    },
    // Dreamer uses curated paintings, with contrast measured behind actual copy.
    // Preserve their colour and detail rather than flattening them into the ground.
    backgroundArtwork: {
      // The journal cover's light veil. Screen headers lay no veil over their painting.
      scrim: dark ? 'rgba(3, 4, 13, 0.45)' : 'rgba(240, 228, 212, 0.60)',
      transparent: dark ? 'rgba(3, 4, 13, 0)' : 'rgba(240, 228, 212, 0)',
    },
    // Fixed contrast on artwork in every theme, including a pure-white or pure-black image:
    // the title sits on a near-opaque band of the theme's own ground (night, or paper on the
    // light theme, so no black band ever fades over a light page or a pale illustration).
    illustration: dark
      ? { text: '#FFF9EF', scrim: 'rgba(3, 4, 13, 0.86)', transparent: 'rgba(3, 4, 13, 0)' }
      : { text: '#382D35', scrim: 'rgba(245, 234, 219, 0.92)', transparent: 'rgba(245, 234, 219, 0)' },
    // The collection's cards are night objects in either theme, like the illustrations they
    // hold: a night ground, a frame of the tier's metal (shadow, light, shadow, edge), the
    // glow it casts and an ink at 4.5:1 or more on that ground. A card not yet earned has
    // no metal. The foil and sheen are the light the gold and silver cards catch.
    collection: {
      ground: ['#121A42', '#070B24', '#03040D'] as const,
      text: '#FFF9EF',
      muted: '#B7AEC9',
      locked: { frame: ['#2B3150', '#4A5175', '#2B3150', '#1C2038'] as const, glow: 'rgba(183, 174, 201, 0.12)', ink: '#B7AEC9' },
      bronze: { frame: ['#6B3F22', '#E6AE7E', '#9A5F35', '#4E2D18'] as const, glow: 'rgba(230, 174, 126, 0.3)', ink: '#EDBE95' },
      silver: { frame: ['#6F7789', '#F5F7FC', '#A3ACBD', '#4E5566'] as const, glow: 'rgba(225, 231, 243, 0.3)', ink: '#E3E8F2' },
      gold: { frame: ['#7E5414', '#FFF0B8', '#C9973A', '#5E3E0C'] as const, glow: 'rgba(255, 214, 128, 0.42)', ink: '#F5D88E' },
      foil: ['rgba(255, 170, 205, 0)', 'rgba(255, 170, 205, 0.5)', 'rgba(255, 236, 170, 0.5)', 'rgba(150, 240, 220, 0.5)', 'rgba(165, 175, 255, 0.5)', 'rgba(255, 170, 230, 0.5)', 'rgba(255, 170, 205, 0)'] as const,
      sheen: ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0)'] as const,
    },
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
      ? { surreal: '#7F6FA8', mystical: '#6C568F', calm: '#446B8C', noir: '#31354F', luminous: '#6B5A34', nostalgic: '#6E4F5B' }
      : { surreal: '#B8AECB', mystical: '#C5B8D8', calm: '#A5C4E0', noir: '#A8A8C0', luminous: '#E3D3A8', nostalgic: '#D9BFC5' },
  };
}

export function getNoctaliaDesignTokens(colors: ThemeColors, mode: ThemeMode) {
  const p = getNoctaliaPalette(mode);
  const dark = mode === 'dark';
  return {
    screen: { background: p.background, gradient: [p.background, p.background] as const },
    cover: p,
    illustration: p.illustration,
    backgroundArtwork: p.backgroundArtwork,
    text: { primary: colors.textPrimary, secondary: colors.textSecondary, tertiary: colors.textTertiary, onAccent: colors.textOnAccentSurface },
    accent: { base: colors.accent, strong: colors.accentDark, soft: colors.accentLight, text: colors.accentText },
    surface: { base: p.raised, raised: p.raised, translucent: p.raisedTranslucent, active: p.actionTint, soft: p.surface, border: p.line, borderStrong: p.line, overlay: p.overlay },
    action: { primary: p.accent, primaryBorder: p.line, primaryText: p.onAccent, disabled: p.actionTint, disabledBorder: p.line, disabledText: p.muted },
    status: p.status,
    nav: { background: colors.navbarBg, border: colors.navbarBorder, active: colors.navbarTextActive, inactive: colors.navbarTextInactive, glass: p.navGlass, activePill: p.navActive },
    listeningHalo: p.listeningHalo,
    fullMoon: p.fullMoon,
    collection: p.collection,
    atmosphere: {
      glow: p.accent,
      glowOpacity: dark ? 0.16 : 0.08,
      particle: dark ? 'rgba(234, 212, 180, 0.22)' : 'rgba(124, 76, 43, 0.12)',
      star: dark ? 'rgba(234, 212, 180, 0.7)' : 'rgba(124, 76, 43, 0.25)',
      veil: dark ? 'rgba(25, 35, 68, 0.42)' : 'rgba(240, 228, 212, 0.7)',
      orbit: dark ? 'rgba(234, 212, 180, 0.24)' : 'rgba(124, 76, 43, 0.12)',
      horizon: dark ? 'rgba(255, 249, 239, 0.08)' : 'rgba(124, 76, 43, 0.06)',
      // The light a gilded word catches as a reflection crosses it: ivory by night, gold on
      // paper, still AA there.
      sheen: dark ? '#FFF9EF' : '#93571F',
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
    '--color-illustration-text': t.illustration.text,
    '--color-illustration-scrim': t.illustration.scrim,
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
