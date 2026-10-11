/** Local artwork is selected by the screen's purpose, never at random. */
export const DREAMER_ARTWORK = {
  reverie: require('@/assets/images/onboarding-reverie-background.webp'),
  path: require('@/assets/images/onboarding-path-background.webp'),
  capture: require('@/assets/images/onboarding-capture-background.png'),
  astral: require('@/assets/images/onboarding-astral-background.webp'),
  journal: require('@/assets/images/dreamer/journal-v1.webp'),
  dialogue: require('@/assets/images/dreamer/dialogue-v1.webp'),
  ritual: require('@/assets/images/dreamer/ritual-v1.webp'),
  sleep: require('@/assets/images/dreamer/sleep-v1.webp'),
  symbols: require('@/assets/images/dreamer/symbols-v1.webp'),
  observatory: require('@/assets/images/dreamer/observatory-v1.webp'),
} as const;

export type DreamerScene = keyof typeof DREAMER_ARTWORK;

/** The paper theme has its own luminous paintings, rather than a veil over night scenes. */
export const DREAMER_LIGHT_ARTWORK = {
  reverie: require('@/assets/images/dreamer/reverie-light-v1.webp'),
  path: require('@/assets/images/dreamer/path-light-v1.webp'),
  capture: require('@/assets/images/dreamer/capture-light-v1.webp'),
  astral: require('@/assets/images/dreamer/astral-light-v1.webp'),
  journal: require('@/assets/images/dreamer/journal-light-v1.webp'),
  dialogue: require('@/assets/images/dreamer/dialogue-light-v1.webp'),
  ritual: require('@/assets/images/dreamer/ritual-light-v1.webp'),
  sleep: require('@/assets/images/dreamer/sleep-light-v1.webp'),
  symbols: require('@/assets/images/dreamer/symbols-light-v1.webp'),
  observatory: require('@/assets/images/dreamer/observatory-light-v1.webp'),
} as const satisfies Record<DreamerScene, number>;

export function getDreamerArtwork(scene: DreamerScene, mode: 'light' | 'dark') {
  return (mode === 'light' ? DREAMER_LIGHT_ARTWORK : DREAMER_ARTWORK)[scene];
}
