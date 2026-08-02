import type { EmotionFamilyId } from './dreamEmotions';
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

/**
 * Labels for the 12 canonical emotion families.
 *
 * The MATCHING vocabulary — the ~975 fragments that turn free-text emotion names into a
 * family — is DATA and lives in `lib/dreamEmotions.ts`. Only these labels are UI copy, and
 * they are the only part of the feature that belongs in the i18n catalogues.
 *
 * `Record<EmotionFamilyId, string>` is exhaustive on purpose: adding a family without a key
 * fails `typecheck:app` instead of rendering a raw enum id on screen.
 *
 * The type-only import above is also deliberate. This module is imported by
 * `app/(tabs)/journal.tsx`, `app/journal/[id].tsx`, six `components/journal/*` files and
 * `hooks/useDreamStatistics.ts`; a value import would pull the whole lexicon into every one
 * of those bundles.
 */
const DREAM_EMOTION_FAMILY_LABEL_KEYS: Record<EmotionFamilyId, string> = {
  fear: 'stats.emotion.family.fear',
  loneliness: 'stats.emotion.family.loneliness',
  weariness: 'stats.emotion.family.weariness',
  helplessness: 'stats.emotion.family.helplessness',
  irritation: 'stats.emotion.family.irritation',
  disorientation: 'stats.emotion.family.disorientation',
  urgency: 'stats.emotion.family.urgency',
  tenderness: 'stats.emotion.family.tenderness',
  grief: 'stats.emotion.family.grief',
  joy: 'stats.emotion.family.joy',
  serenity: 'stats.emotion.family.serenity',
  guilt: 'stats.emotion.family.guilt',
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

export function getEmotionFamilyLabel(
  family: EmotionFamilyId | null | undefined,
  t: Translator
): string | undefined {
  if (!family) return undefined;
  const key = DREAM_EMOTION_FAMILY_LABEL_KEYS[family];
  return key ? t(key) : family;
}
