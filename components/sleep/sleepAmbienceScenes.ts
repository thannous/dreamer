import type { ImageContentPosition } from 'expo-image';

import { DREAMER_ARTWORK } from '@/constants/dreamerArtwork';
import type { SleepSoundId } from '@/lib/sleepSounds';

/** A warm point of light painted into the scene, which breathes or flickers in place. */
export type SceneLight = {
  /** Centre and radius of the glow, in the painting's own pixels. */
  x: number;
  y: number;
  r: number;
  period: number;
  min: number;
  max: number;
};

export type SleepAmbienceScene = {
  source: number;
  /** Intrinsic size of the painting, in pixels. */
  width: number;
  height: number;
  /** Which part of the painting survives the crop: 0 is the left or top edge, 1 the other. */
  alignX: number;
  alignY: number;
  /**
   * Share of the screen's height the painting covers from the top. A landscape painting
   * stops above the copy, so its lit details (the lantern, the moon's path) stay in view
   * instead of sinking under the title.
   */
  coverHeight: number;
  /** Where the small round preview of the scene looks. */
  thumbnailPosition: ImageContentPosition;
  weather: 'rain' | 'tide' | 'mist';
  lights: SceneLight[];
  /** The moon's path on the water, where the tide glints (in painting pixels). */
  glintPath?: { x: number; top: number; bottom: number; spread: number };
  /** Stones in the water, where rings open as the waves come in (in painting pixels). */
  ripples?: { x: number; y: number; r: number }[];
};

/**
 * Each ambience is a place: the painting sets it, and the motion on top of it is the
 * sound made visible. The scenes always use the night paintings, whatever the theme,
 * because this screen is the last one someone sees before sleep.
 */
export const SLEEP_AMBIENCE_SCENES: Record<SleepSoundId, SleepAmbienceScene> = {
  rain: {
    // A forest path above a lake; a lantern hangs on a post by the trail.
    source: DREAMER_ARTWORK.ritual,
    width: 1536,
    height: 1024,
    alignX: 1,
    alignY: 0.5,
    coverHeight: 0.64,
    thumbnailPosition: { right: 0, top: '35%' },
    weather: 'rain',
    lights: [
      { x: 1418, y: 706, r: 120, period: 2600, min: 0.5, max: 0.9 },
      { x: 1340, y: 192, r: 150, period: 9000, min: 0.18, max: 0.32 },
    ],
  },
  ocean: {
    // A moonlit shore: the crescent sits right, its reflection runs down the water.
    source: DREAMER_ARTWORK.sleep,
    width: 1536,
    height: 1024,
    alignX: 1,
    alignY: 0.5,
    coverHeight: 0.64,
    thumbnailPosition: { right: 0, top: '30%' },
    weather: 'tide',
    lights: [{ x: 1356, y: 190, r: 130, period: 8000, min: 0.25, max: 0.5 }],
    glintPath: { x: 1342, top: 600, bottom: 830, spread: 70 },
    ripples: [
      { x: 1262, y: 806, r: 110 },
      { x: 1085, y: 930, r: 170 },
      { x: 885, y: 968, r: 120 },
    ],
  },
  'brown-noise': {
    // Clouds and mist over a lake under a large crescent; a house glows on the cliff.
    source: DREAMER_ARTWORK.reverie,
    width: 887,
    height: 1774,
    alignX: 0.5,
    alignY: 0.35,
    coverHeight: 1,
    thumbnailPosition: { left: '50%', top: '12%' },
    weather: 'mist',
    lights: [
      { x: 548, y: 274, r: 260, period: 10000, min: 0.16, max: 0.3 },
      { x: 150, y: 466, r: 46, period: 3400, min: 0.35, max: 0.8 },
    ],
  },
};

/** Where a painting lands when it covers its share of a `width` x `screenHeight` screen. */
export function getSceneFrame(scene: SleepAmbienceScene, width: number, screenHeight: number) {
  const height = screenHeight * scene.coverHeight;
  const scale = Math.max(width / scene.width, height / scene.height);
  const drawnWidth = scene.width * scale;
  const drawnHeight = scene.height * scale;
  return {
    scale,
    width: drawnWidth,
    height: drawnHeight,
    left: (width - drawnWidth) * scene.alignX,
    top: (height - drawnHeight) * scene.alignY,
  };
}

/** A small deterministic generator, so drops and glints keep their places between renders. */
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
