/**
 * Commonly used gradient color combinations
 */

export const GradientColors = {
  dreamJournal: ['#03040D', '#120D23'] as const,
  darkBase: ['#03040D', '#03040D'] as const,
  surreal: ['#03040D', '#192344'] as const,
} as const;

export type GradientColorKey = keyof typeof GradientColors;
