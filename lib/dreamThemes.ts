import type { DreamTheme } from '@/lib/types';

/**
 * A dream's visual atmosphere, as its pre-analysis chooses it: how strange, light or dark
 * it feels, and how vivid or quiet. Not a subject, an emotion or a kind of dream, which
 * the reading and the dream's type carry. The order is the astrolabe's, clockwise from
 * the top, where the seal turns the signs while it chooses.
 */
export const DREAM_THEMES: readonly DreamTheme[] = ['mystical', 'luminous', 'calm', 'nostalgic', 'noir', 'surreal'];

/**
 * The theme an app that knows only surreal, mystical, calm and noir shows. The account
 * stores it in dreams.theme, and the full theme in dreams.precise_theme; the database
 * trigger applies the same projection (public.legacy_dream_theme).
 */
export const toLegacyDreamTheme = (theme: DreamTheme): DreamTheme =>
  theme === 'luminous' ? 'mystical' : theme === 'nostalgic' ? 'calm' : theme;
