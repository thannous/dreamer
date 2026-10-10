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
