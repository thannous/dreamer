import type { ThemeColors } from '@/constants/journalTheme';

export type LucidPalette = ReturnType<typeof getLucidPalette>;

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
    danger: dark ? '#FF9EA1' : '#A63B42',
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
