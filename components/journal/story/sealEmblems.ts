import type { ImageSourcePropType } from 'react-native';

import { getNoctaliaPalette } from '@/constants/noctaliaPalette';
import type { DreamTheme } from '@/lib/types';

/*
 * What a dream's seal is struck with, without the seal's motion: the Journal's cards show
 * the seal still and need only these.
 */

/** Each theme's emblem, an ink mask the seal tints. */
export const SEAL_EMBLEMS: Record<DreamTheme, ImageSourcePropType> = {
  mystical: require('@/assets/images/dream-seal-emblem-mystical.webp'),
  calm: require('@/assets/images/dream-seal-emblem-calm.webp'),
  surreal: require('@/assets/images/dream-seal-emblem-surreal.webp'),
  noir: require('@/assets/images/dream-seal-emblem-noir.webp'),
  luminous: require('@/assets/images/dream-seal-emblem-luminous.webp'),
  nostalgic: require('@/assets/images/dream-seal-emblem-nostalgic.webp'),
};
/** The emblem is pressed in the warm light of the journal's lamp, in both themes. */
export const SEAL_GOLD = getNoctaliaPalette('dark').accent;
