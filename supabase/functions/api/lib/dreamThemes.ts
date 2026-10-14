/**
 * A dream's visual atmosphere: how strange, light or dark it feels, and how vivid or
 * quiet. The first four are the ones every app version can show; the others are offered
 * only to an app that says it can show them, so an older app never receives a theme it
 * would print as a raw word.
 */
export const LEGACY_DREAM_THEMES: readonly string[] = ['surreal', 'mystical', 'calm', 'noir'];
export const DREAM_THEME_VALUES: readonly string[] = [...LEGACY_DREAM_THEMES, 'luminous', 'nostalgic'];

const THEME_MEANINGS: Record<string, string> = {
  surreal: 'strange, impossible or shifting',
  mystical: 'spiritual, magical or otherworldly',
  calm: 'peaceful, quiet and gentle',
  noir: 'dark, tense or ominous',
  luminous: 'joyful, radiant, full of wonder',
  nostalgic: 'tender and bittersweet, turned towards the past or people missed',
};

/** The themes to offer for a request: the legacy four, and any newer one the app can show. */
export const offeredDreamThemes = (requested: unknown): string[] => {
  const shown = new Set(Array.isArray(requested) ? requested.filter((value) => typeof value === 'string') : []);
  return DREAM_THEME_VALUES.filter((theme) => LEGACY_DREAM_THEMES.includes(theme) || shown.has(theme));
};

/** The theme a model answered, kept to the themes offered. */
export const normalizeDreamTheme = (value: unknown, themes: readonly string[]): string =>
  themes.includes(String(value)) ? String(value) : 'surreal';

/** How the offered themes read in a prompt: as before for the legacy four, with their meanings once there are more. */
export const describeDreamThemes = (themes: readonly string[]): string =>
  themes.length === LEGACY_DREAM_THEMES.length
    ? themes.map((theme) => JSON.stringify(theme)).join(', ')
    : themes.map((theme) => `${JSON.stringify(theme)} (${THEME_MEANINGS[theme]})`).join(', ');
