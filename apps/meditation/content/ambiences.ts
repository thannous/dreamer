import type { AudioSource } from 'expo-audio';

export type AmbienceId = 'none' | 'rain' | 'ocean' | 'brown-noise';

export type Ambience = {
  id: AmbienceId;
  source: AudioSource | null;
};

/**
 * Loops layered under a session, at an independent volume. Shared with the
 * Noctalia journal app, which is why they are already recorded.
 *
 * `none` stays available for surfaces that let the user choose silence. World
 * journeys use their own restrained combinations from `worldSounds.ts`.
 */
export const AMBIENCES: Ambience[] = [
  { id: 'none', source: null },
  { id: 'rain', source: require('@/assets/audio/ambience/rain.m4a') },
  { id: 'ocean', source: require('@/assets/audio/ambience/ocean.m4a') },
  { id: 'brown-noise', source: require('@/assets/audio/ambience/brown-noise.m4a') },
];

export const AMBIENCE_BY_ID: Record<AmbienceId, Ambience> = AMBIENCES.reduce(
  (acc, ambience) => ({ ...acc, [ambience.id]: ambience }),
  {} as Record<AmbienceId, Ambience>
);
