import { createNoctaliaTheme, getNoctaliaPalette } from './noctaliaPalette';
import type { ThemeColors } from '@/constants/journalTheme';
import { TypeScale, type TypeScaleStep } from '@/constants/typeScale';

export type LucidPalette = ReturnType<typeof getLucidPalette>;

// Les quatre échelles non chromatiques. Sans elles, chaque écran a dû inventer
// ses valeurs : le module comptait 13 tailles de texte, 15 rayons, 17 tailles
// d'icône et 13 gaps — aucune sur une grille commune. Ce ne sont pas 58 fautes
// de goût, ce sont 34 fichiers privés de barème.
//
// TOUTE VALEUR HORS ÉCHELLE EST UN BUG, PAS UNE INTENTION.
//
// Les paliers de texte sont ceux de constants/typeScale.ts (le miroir de global.css),
// les rayons et les tailles d'icône ceux de constants/journalTheme.ts : Lucid emprunte
// à Noctalia ses barèmes et sa palette validés.

const step = (name: TypeScaleStep) => [TypeScale[name].fontSize, TypeScale[name].lineHeight] as const;

/** Paliers typographiques : [fontSize, lineHeight]. */
export const LucidType = {
  /** One title per screen, at the scale of the landing; Fraunces regular, as in Dreams. */
  saga: [44, 48],
  display: step('display'),
  h1: step('h1'),
  h2: step('h2'),
  h3: step('h3'),
  body: step('body'),
  bodySm: step('bodySm'),
  caption: step('caption'),
  overline: step('overline'),
} as const;

/** Rayons. `full` sert les pilules et les pastilles, jamais une carte. */
export const LucidRadius = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 } as const;

/** Tailles d'icône. En dehors de ces quatre valeurs, c'est une erreur de frappe. */
export const LucidIcon = { sm: 16, md: 20, lg: 24, xl: 32 } as const;

/** Espacements. `gutter` est la marge latérale d'écran, elle ne se négocie pas. */
export const LucidSpace = { xs: 4, sm: 8, md: 12, lg: 16, gutter: 20, xl: 24 } as const;

/** Retour de pression, déclaré une fois. Quatre littéraux le contredisaient. */
export const LucidPress = { opacity: 0.78, scale: 0.97 } as const;

/** Fixed night ink for artwork that remains nocturnal in either appearance. */
const night = getNoctaliaPalette('dark');
export const LucidScene = {
  text: night.title,
  textSecondary: night.muted,
  surface: night.navGlass.solid,
  border: night.navGlass.rim,
  accent: night.accent,
  shadow: night.background,
  scrim: night.backgroundArtwork.scrim,
} as const;

export const LUCID_NIGHT_GROUND = night.background;

/** Lucid uses Noctalia's exact art direction, including Morning/Paper and Afterglow/Night.
 * Keep the product's semantic names so its practice and safety states stay intact.
 * `onAccent` is the ink on a filled action, never the screen's background.
 */
export function getLucidPalette(colors: ThemeColors, mode: 'light' | 'dark') {
  const p = getNoctaliaPalette(mode);
  const reading = createNoctaliaTheme(mode, mode);
  return {
    background: p.background,
    backgroundDeep: p.background,
    surface: p.raised,
    surfaceRaised: p.raised,
    surfaceMuted: reading.backgroundSecondary,
    border: p.line,
    // Interactive outlines remain distinguishable on both the ground and cards.
    borderInteractive: p.muted,
    text: p.title,
    textSecondary: p.muted,
    textMuted: p.muted,
    accent: p.accent,
    accentStrong: p.accent,
    // This role also backs labels directly on paintings; keep the composited
    // opaque equivalent so Paper's bronze ink cannot land on a night image.
    accentSoft: reading.backgroundSecondary,
    accentOn: p.accent,
    onAccent: p.onAccent,
    amber: p.status.warning.text,
    amberSoft: p.status.warning.background,
    success: p.status.success.text,
    successSoft: p.status.success.background,
    danger: p.status.danger.text,
    dangerSoft: p.status.danger.background,
    overlay: p.navGlass.solid,
    // The painting carries the atmosphere; do not recolour it with a jade wash.
    atmosphere: [p.backgroundArtwork.transparent, p.backgroundArtwork.transparent, p.backgroundArtwork.transparent] as const,
    inheritedAccent: colors.accent,
  } as const;
}
