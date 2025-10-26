/**
 * Commonly used gradient color combinations
 */

export const GradientColors = {
  dreamJournal: ['#131022', '#4A3B5F'] as const,
  darkBase: ['#131022', '#131022'] as const,
  surreal: ['#1a0f2b', '#3b2a50'] as const,
} as const;

export type GradientColorKey = keyof typeof GradientColors;
