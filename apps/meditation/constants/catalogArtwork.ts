import type { ImageSourcePropType } from 'react-native';

import type { ThemeMode } from '@/constants/theme';
import type { CategorySlug, SessionId } from '@/lib/types';

/** Generated editorial artwork bundled locally with the static catalogue. */
export const CATEGORY_ARTWORK: Record<CategorySlug, ImageSourcePropType> = {
  sleep: require('@/assets/session-artwork/categories/sleep.webp'),
  stress: require('@/assets/session-artwork/categories/stress.webp'),
  focus: require('@/assets/session-artwork/categories/focus.webp'),
  anxiety: require('@/assets/session-artwork/categories/anxiety.webp'),
  gratitude: require('@/assets/session-artwork/categories/gratitude.webp'),
  'dream-prep': require('@/assets/session-artwork/categories/dream-prep.webp'),
};

/** Daylight editorial variants used by worlds whose appearance is `light`. */
export const LIGHT_CATEGORY_ARTWORK: Record<CategorySlug, ImageSourcePropType> = {
  sleep: require('@/assets/session-artwork/light/categories/sleep.webp'),
  stress: require('@/assets/session-artwork/light/categories/stress.webp'),
  focus: require('@/assets/session-artwork/light/categories/focus.webp'),
  anxiety: require('@/assets/session-artwork/light/categories/anxiety.webp'),
  gratitude: require('@/assets/session-artwork/light/categories/gratitude.webp'),
  'dream-prep': require('@/assets/session-artwork/light/categories/dream-prep.webp'),
};

export const SESSION_ARTWORK: Record<SessionId, ImageSourcePropType> = {
  'sleep-descent': require('@/assets/session-artwork/sessions/sleep-descent.webp'),
  'sleep-quick-fall': require('@/assets/session-artwork/sessions/sleep-quick-fall.webp'),
  'sleep-body-scan': require('@/assets/session-artwork/sessions/sleep-body-scan.webp'),
  'sleep-night-return': require('@/assets/session-artwork/sessions/sleep-night-return.webp'),
  'stress-shoulders': require('@/assets/session-artwork/sessions/stress-shoulders.webp'),
  'stress-unclench': require('@/assets/session-artwork/sessions/stress-unclench.webp'),
  'stress-day-close': require('@/assets/session-artwork/sessions/stress-day-close.webp'),
  'stress-storm': require('@/assets/session-artwork/sessions/stress-storm.webp'),
  'focus-morning': require('@/assets/session-artwork/sessions/focus-morning.webp'),
  'focus-one-thing': require('@/assets/session-artwork/sessions/focus-one-thing.webp'),
  'focus-thread': require('@/assets/session-artwork/sessions/focus-thread.webp'),
  'focus-deep': require('@/assets/session-artwork/sessions/focus-deep.webp'),
  'anxiety-ground': require('@/assets/session-artwork/sessions/anxiety-ground.webp'),
  'anxiety-wave': require('@/assets/session-artwork/sessions/anxiety-wave.webp'),
  'anxiety-chest': require('@/assets/session-artwork/sessions/anxiety-chest.webp'),
  'anxiety-evening': require('@/assets/session-artwork/sessions/anxiety-evening.webp'),
  'gratitude-three': require('@/assets/session-artwork/sessions/gratitude-three.webp'),
  'gratitude-people': require('@/assets/session-artwork/sessions/gratitude-people.webp'),
  'gratitude-ordinary': require('@/assets/session-artwork/sessions/gratitude-ordinary.webp'),
  'gratitude-year': require('@/assets/session-artwork/sessions/gratitude-year.webp'),
  'dream-threshold': require('@/assets/session-artwork/sessions/dream-threshold.webp'),
  'dream-recall': require('@/assets/session-artwork/sessions/dream-recall.webp'),
  'dream-question': require('@/assets/session-artwork/sessions/dream-question.webp'),
  'dream-lucid': require('@/assets/session-artwork/sessions/dream-lucid.webp'),
};

export const LIGHT_SESSION_ARTWORK: Record<SessionId, ImageSourcePropType> = {
  'sleep-descent': require('@/assets/session-artwork/light/sessions/sleep-descent.webp'),
  'sleep-quick-fall': require('@/assets/session-artwork/light/sessions/sleep-quick-fall.webp'),
  'sleep-body-scan': require('@/assets/session-artwork/light/sessions/sleep-body-scan.webp'),
  'sleep-night-return': require('@/assets/session-artwork/light/sessions/sleep-night-return.webp'),
  'stress-shoulders': require('@/assets/session-artwork/light/sessions/stress-shoulders.webp'),
  'stress-unclench': require('@/assets/session-artwork/light/sessions/stress-unclench.webp'),
  'stress-day-close': require('@/assets/session-artwork/light/sessions/stress-day-close.webp'),
  'stress-storm': require('@/assets/session-artwork/light/sessions/stress-storm.webp'),
  'focus-morning': require('@/assets/session-artwork/light/sessions/focus-morning.webp'),
  'focus-one-thing': require('@/assets/session-artwork/light/sessions/focus-one-thing.webp'),
  'focus-thread': require('@/assets/session-artwork/light/sessions/focus-thread.webp'),
  'focus-deep': require('@/assets/session-artwork/light/sessions/focus-deep.webp'),
  'anxiety-ground': require('@/assets/session-artwork/light/sessions/anxiety-ground.webp'),
  'anxiety-wave': require('@/assets/session-artwork/light/sessions/anxiety-wave.webp'),
  'anxiety-chest': require('@/assets/session-artwork/light/sessions/anxiety-chest.webp'),
  'anxiety-evening': require('@/assets/session-artwork/light/sessions/anxiety-evening.webp'),
  'gratitude-three': require('@/assets/session-artwork/light/sessions/gratitude-three.webp'),
  'gratitude-people': require('@/assets/session-artwork/light/sessions/gratitude-people.webp'),
  'gratitude-ordinary': require('@/assets/session-artwork/light/sessions/gratitude-ordinary.webp'),
  'gratitude-year': require('@/assets/session-artwork/light/sessions/gratitude-year.webp'),
  'dream-threshold': require('@/assets/session-artwork/light/sessions/dream-threshold.webp'),
  'dream-recall': require('@/assets/session-artwork/light/sessions/dream-recall.webp'),
  'dream-question': require('@/assets/session-artwork/light/sessions/dream-question.webp'),
  'dream-lucid': require('@/assets/session-artwork/light/sessions/dream-lucid.webp'),
};

export const CATEGORY_ARTWORK_BY_APPEARANCE = {
  dark: CATEGORY_ARTWORK,
  light: LIGHT_CATEGORY_ARTWORK,
} as const satisfies Record<ThemeMode, Record<CategorySlug, ImageSourcePropType>>;

export const SESSION_ARTWORK_BY_APPEARANCE = {
  dark: SESSION_ARTWORK,
  light: LIGHT_SESSION_ARTWORK,
} as const satisfies Record<ThemeMode, Record<SessionId, ImageSourcePropType>>;

export function getCategoryArtwork(category: CategorySlug, appearance: ThemeMode = 'dark') {
  return CATEGORY_ARTWORK_BY_APPEARANCE[appearance][category];
}

export function getSessionArtwork(session: SessionId, appearance: ThemeMode = 'dark') {
  return SESSION_ARTWORK_BY_APPEARANCE[appearance][session];
}
