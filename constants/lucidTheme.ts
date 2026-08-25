import type { ThemeColors } from '@/constants/journalTheme';

export type LucidPalette = ReturnType<typeof getLucidPalette>;

// Les quatre échelles non chromatiques. Sans elles, chaque écran a dû inventer
// ses valeurs : le module comptait 13 tailles de texte, 15 rayons, 17 tailles
// d'icône et 13 gaps — aucune sur une grille commune. Ce ne sont pas 58 fautes
// de goût, ce sont 34 fichiers privés de barème.
//
// TOUTE VALEUR HORS ÉCHELLE EST UN BUG, PAS UNE INTENTION.
//
// Les paliers de texte reprennent ceux de global.css (l. 71-87), les rayons et
// les tailles d'icône ceux de constants/journalTheme.ts : Lucid emprunte à
// Noctalia ses barèmes déjà validés, pas sa teinte.

/** Paliers typographiques : [fontSize, lineHeight]. */
export const LucidType = {
  display: [34, 40],
  h1: [28, 34],
  h2: [22, 28],
  h3: [18, 24],
  body: [16, 24],
  bodySm: [14, 20],
  caption: [12, 16],
  overline: [11, 14],
} as const;

/** Rayons. `full` sert les pilules et les pastilles, jamais une carte. */
export const LucidRadius = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 } as const;

/** Tailles d'icône. En dehors de ces quatre valeurs, c'est une erreur de frappe. */
export const LucidIcon = { sm: 16, md: 20, lg: 24, xl: 32 } as const;

/** Espacements. `gutter` est la marge latérale d'écran, elle ne se négocie pas. */
export const LucidSpace = { xs: 4, sm: 8, md: 12, lg: 16, gutter: 20, xl: 24 } as const;

/** Retour de pression, déclaré une fois. Quatre littéraux le contredisaient. */
export const LucidPress = { opacity: 0.78, scale: 0.97 } as const;

/**
 * Contraste stable au-dessus des décors illustrés. Ces couleurs ne suivent pas
 * le thème de surface : une image nocturne reste sombre même en mode clair.
 */
export const LucidScene = {
  text: '#F2FAF7',
  textSecondary: '#C7DBD7',
  surface: 'rgba(3, 11, 16, 0.62)',
  border: 'rgba(232, 242, 241, 0.18)',
} as const;

// Identité Lucid Trainer — « nuit jade ».
//
// Sœur de Noctalia par le vocabulaire : mêmes fontes, même rayon de carte (24),
// même matériau de verre (components/inspiration/GlassCard.tsx). Distincte par
// la teinte : là où Noctalia pose du champagne sur l'encre, Lucid pose du jade
// sur un pétrole nocturne.
//
// Quatre règles tiennent cette palette, et toute valeur ajoutée doit s'y plier.
//
// 1. UN SEUL ACCENT DE MARQUE. `accent` porte l'état actif, la sélection et la
//    progression. Ce module a longtemps eu trois accents de poids égal — violet,
//    cyan, ambre — qui se croisaient sur le même écran : la couleur n'y désignait
//    plus rien. `amber` reste, mais comme signal sémantique du matin et de la
//    vigilance, jamais comme deuxième marque.
// 2. UNE TEINTE REMPLIT, ELLE N'ÉCRIT PAS. Pour du texte sur une surface teintée,
//    on prend la déclinaison `*On` (`accentOn` sur `accentSoft`), comme
//    `champagne` / `champagne-on` côté Noctalia (global.css:18).
// 3. LE FOND EST CHROMATIQUE, PAS GRIS. L'élévation se lit à la teinte
//    (background → surface → surfaceRaised), pas à un filet de 1px partout.
//    C'est aussi ce qui permet au verre de prendre une couleur : un panneau
//    flouté sur un gris-noir ne rend que du gris sale.
// 4. `border` est un filet décoratif : bord de carte inerte, séparateur de ligne.
//    Dès qu'une bordure délimite une cible tactile, c'est `borderInteractive`,
//    qui tient 3:1 sur les quatre surfaces des deux thèmes — seuil WCAG 1.4.11.
//
// Tous les couples texte/surface tiennent 4,5:1 au pire cas, mesurés sur les
// quatre surfaces de chaque thème.
export function getLucidPalette(colors: ThemeColors, mode: 'light' | 'dark') {
  const dark = mode === 'dark';

  if (colors.ambience === 'morning') {
    return {
      background: '#F4EBDD',
      backgroundDeep: '#E7D8C5',
      surface: '#FFF8ED',
      surfaceRaised: '#F3E2CF',
      surfaceMuted: '#EEDCC9',
      border: '#D9C4B1',
      borderInteractive: '#927768',
      text: '#2E2724',
      textSecondary: '#6D5C53',
      textMuted: '#76645A',
      accent: '#BF7049',
      accentStrong: '#8D4A2F',
      accentSoft: '#F4D8C3',
      accentOn: '#82432C',
      amber: '#8A5A12',
      amberSoft: '#F7E6C9',
      success: '#35684A',
      successSoft: '#E1EEE4',
      danger: '#A63B42',
      dangerSoft: '#F7E3E1',
      overlay: 'rgba(244, 235, 221, 0.9)',
      atmosphere: [
        'rgba(213, 138, 89, 0.14)',
        'rgba(244, 235, 221, 0)',
        'rgba(135, 176, 184, 0.11)',
      ] as const,
      inheritedAccent: colors.accent,
    } as const;
  }

  if (colors.ambience === 'afterglow') {
    return {
      background: '#160F22',
      backgroundDeep: '#0D0917',
      surface: '#25182F',
      surfaceRaised: '#382342',
      surfaceMuted: '#1E142A',
      border: '#543A59',
      borderInteractive: '#A57A91',
      text: '#FFF3E8',
      textSecondary: '#D3B7C5',
      textMuted: '#B69BAC',
      accent: '#E99275',
      accentStrong: '#FFC09D',
      accentSoft: '#4A2436',
      accentOn: '#FFC09D',
      amber: '#F3C37D',
      amberSoft: '#3A291E',
      success: '#A7D6A8',
      successSoft: '#203226',
      danger: '#FF9EA1',
      dangerSoft: '#3B1D29',
      overlay: 'rgba(22, 15, 34, 0.9)',
      atmosphere: [
        'rgba(126, 76, 139, 0.22)',
        'rgba(22, 15, 34, 0)',
        'rgba(233, 146, 117, 0.2)',
      ] as const,
      inheritedAccent: colors.accent,
    } as const;
  }

  return {
    background: dark ? '#06131A' : '#F2F6F6',
    backgroundDeep: dark ? '#030B10' : '#E6EDED',
    surface: dark ? '#0D2029' : '#FFFFFF',
    surfaceRaised: dark ? '#153039' : '#EAF1F1',
    surfaceMuted: dark ? '#0A1B22' : '#E1EAEA',
    border: dark ? '#1D343D' : '#D4E0E0',
    borderInteractive: dark ? '#628288' : '#748889',
    text: dark ? '#E8F2F1' : '#132226',
    textSecondary: dark ? '#A4BCBB' : '#4F6467',
    textMuted: dark ? '#829A99' : '#586C6F',
    accent: dark ? '#6FE0BE' : '#0E7A63',
    accentStrong: dark ? '#8FEBD0' : '#0A6151',
    accentSoft: dark ? '#0C332C' : '#D8F2EA',
    accentOn: dark ? '#6FE0BE' : '#0B6A57',
    amber: dark ? '#F0C48A' : '#8A5A12',
    amberSoft: dark ? '#2E2415' : '#FBEEDA',
    success: dark ? '#8FDCA9' : '#1F6B41',
    // Les fonds sémantiques manquaient : à défaut, six sites calculaient un alpha
    // (`${palette.danger}18`) dont le rendu dépend de la surface en dessous.
    successSoft: dark ? '#0F2A1B' : '#E2F3E8',
    danger: dark ? '#FF9EA1' : '#A63B42',
    dangerSoft: dark ? '#33191B' : '#FBE7E8',
    // Surface de chrome flottante (tab bar, pastille de statut). Elle est prévue
    // pour recevoir un flou par-dessus sur iOS ; l'opacité est le vrai design,
    // le flou est le bonus. Voir components/lucid/LucidGlass.tsx.
    overlay: dark ? 'rgba(6, 19, 26, 0.86)' : 'rgba(242, 246, 246, 0.90)',
    // L'atmosphère d'écran est un token, pas six rgba en dur : changer l'accent
    // doit changer l'ambiance, sinon les deux dérivent en silence.
    atmosphere: dark
      ? (['rgba(111, 224, 190, 0.13)', 'rgba(6, 19, 26, 0)', 'rgba(20, 80, 86, 0.18)'] as const)
      : (['rgba(14, 122, 99, 0.10)', 'rgba(242, 246, 246, 0)', 'rgba(14, 122, 99, 0.07)'] as const),
    inheritedAccent: colors.accent,
  } as const;
}
