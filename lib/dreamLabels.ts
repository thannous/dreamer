import type { DreamTheme, DreamType } from './types';

type Translator = (key: string, replacements?: { [k: string]: string | number }) => string;

/**
 * Sentinel used by aggregations (statistics) for dreams that carry no dreamType
 * yet — typically a dream captured but never analyzed/categorized. It is kept
 * deliberately OUT of the canonical `DreamType` union so that every caller that
 * needs a real type stays exhaustive.
 */
export const UNKNOWN_DREAM_TYPE = 'Unknown';

/** A dream type as displayed: a canonical type, or the "no type yet" sentinel. */
export type DreamTypeKey = DreamType | typeof UNKNOWN_DREAM_TYPE;

const DREAM_TYPE_LABEL_KEYS: Record<DreamTypeKey, string> = {
  'Lucid Dream': 'dream.type.lucid',
  'Recurring Dream': 'dream.type.recurring',
  Nightmare: 'dream.type.nightmare',
  'Symbolic Dream': 'dream.type.symbolic',
  Unknown: 'dream.type.unknown',
};

const DREAM_THEME_LABEL_KEYS: Record<DreamTheme, string> = {
  surreal: 'dream.theme.surreal',
  mystical: 'dream.theme.mystical',
  calm: 'dream.theme.calm',
  noir: 'dream.theme.noir',
};

export function getDreamTypeLabel(dreamType: DreamTypeKey | null | undefined, t: Translator): string | undefined {
  if (!dreamType) return undefined;
  const key = DREAM_TYPE_LABEL_KEYS[dreamType];
  return key ? t(key) : dreamType;
}

export function getDreamThemeLabel(theme: DreamTheme | null | undefined, t: Translator): string | undefined {
  if (!theme) return undefined;
  const key = DREAM_THEME_LABEL_KEYS[theme];
  return key ? t(key) : theme;
}
