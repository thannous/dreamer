import type { ThemeColors } from '@/constants/journalTheme';

export type LucidPalette = ReturnType<typeof getLucidPalette>;

// Deux règles tiennent cette palette, et toute valeur ajoutée doit s'y plier.
//
// 1. Une teinte remplit, elle n'écrit pas. Pour du texte sur une surface
//    teintée, on prend la déclinaison `*On` (`cyanOn` sur `cyanSoft`), comme
//    `champagne` / `champagne-on` côté Noctalia (global.css:18).
// 2. `border` est un filet décoratif (1,4:1) : bord de carte, séparateur de
//    ligne. Dès qu'une bordure délimite une cible tactile, c'est
//    `borderInteractive`, qui tient 3:1 sur les quatre surfaces des deux
//    thèmes — le seuil WCAG 1.4.11.
export function getLucidPalette(colors: ThemeColors, mode: 'light' | 'dark') {
  const dark = mode === 'dark';
  return {
    background: dark ? '#070B18' : '#F6F6FB',
    backgroundDeep: dark ? '#050713' : '#ECECF6',
    surface: dark ? '#10172B' : '#FFFFFF',
    surfaceRaised: dark ? '#17213A' : '#F0F0F8',
    surfaceMuted: dark ? '#0C1224' : '#E8E8F2',
    border: dark ? '#2A3655' : '#DCDCE9',
    borderInteractive: dark ? '#63719B' : '#807F98',
    text: dark ? '#F7F5FF' : '#242238',
    textSecondary: dark ? '#B7B9CA' : '#66647A',
    textMuted: dark ? '#858AA5' : '#6F6C84',
    accent: dark ? '#B9A7FF' : '#6751BA',
    accentStrong: dark ? '#D0C5FF' : '#4D3999',
    accentSoft: dark ? '#2B2354' : '#ECE7FF',
    cyan: dark ? '#70D8D3' : '#197E7A',
    cyanOn: dark ? '#70D8D3' : '#146B68',
    cyanSoft: dark ? '#12383E' : '#DEF5F2',
    amber: dark ? '#F3C77D' : '#94621C',
    amberSoft: dark ? '#3A2C17' : '#FFF1D8',
    success: dark ? '#83D7A4' : '#287849',
    danger: dark ? '#FF9A9D' : '#A83E45',
    overlay: dark ? 'rgba(7, 11, 24, 0.92)' : 'rgba(246, 246, 251, 0.94)',
    inheritedAccent: colors.accent,
  } as const;
}
