/**
 * Journal-specific theme constants
 * Adapted from SurrealTheme to match the journal mockup design
 */

export const JournalTheme = {
  // Background colors
  backgroundDark: '#131022', // Main background
  backgroundCard: '#1a0f2b', // Card background (from SurrealTheme.bgStart)
  backgroundSecondary: '#4B3F72', // Secondary elements (buttons, inputs)

  // Text colors
  textPrimary: '#FFFFFF', // Main text
  textSecondary: '#a097b8', // Secondary/muted text (from SurrealTheme.textMuted)
  textTertiary: '#6B6B8D', // Even more muted

  // Accent colors
  accent: '#FFD700', // Golden accent for icons and highlights
  accentDark: '#D4AF37', // Darker gold for pressed states
  accentLight: '#FFE55C', // Lighter gold for hover states

  // UI elements
  timeline: '#4f3d6b', // Timeline line color (from SurrealTheme.shape)
  divider: '#2e1d47', // Dividers (from SurrealTheme.darkAccent)
  overlay: 'rgba(19, 16, 34, 0.8)', // Semi-transparent overlay for bottom button

  // Tag colors (using theme as base)
  tags: {
    surreal: '#6b5a8e',
    mystical: '#5d4b7a',
    calm: '#4a6fa5',
    noir: '#3d3d5c',
  },

  // Spacing and sizes
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },

  // Border radius
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    full: 999,
  },

  // Icon sizes
  iconSize: {
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
  },

  // Timeline specific
  timelineIconSize: 32,
  timelineIconContainerSize: 32,
  timelineLineWidth: 2,
};

/**
 * Get tag color based on theme
 */
export function getTagColor(theme?: string): string {
  if (!theme) return JournalTheme.tags.surreal;

  const themeKey = theme.toLowerCase() as keyof typeof JournalTheme.tags;
  return JournalTheme.tags[themeKey] || JournalTheme.tags.surreal;
}
