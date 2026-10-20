import React from 'react';
import { Image, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { SEAL_EMBLEMS, SEAL_GOLD } from '@/components/journal/story/sealEmblems';
import { sparklePath } from '@/components/journal/story/sparkle';
import type { DreamTheme } from '@/lib/types';

const NIGHT = require('@/assets/images/onboarding-astral-background.webp');
// In the dream page's proportions: its emblem is 92 in a 148 seal.
const SEAL = 60;
const EMBLEM = 38;
const NIGHT_STYLE = { position: 'absolute', top: 0, left: 0, width: SEAL, height: SEAL } as const;
const EMBLEM_STYLE = {
  position: 'absolute', left: (SEAL - EMBLEM) / 2, top: (SEAL - EMBLEM) / 2, width: EMBLEM, height: EMBLEM,
} as const;
const RIM_STYLE = { position: 'absolute', top: 0, left: 0 } as const;

/**
 * The seal a Journal card shows for a dream without a painting: its theme's emblem in the
 * lamp's gold on the night, as the dream page strikes it. A dream without a theme yet shows
 * a star. Decorative: the card's labels name the theme.
 */
export function JournalCardSeal({ theme, testID }: { theme?: DreamTheme; testID?: string }) {
  const emblem = theme && theme in SEAL_EMBLEMS ? SEAL_EMBLEMS[theme] : null;
  const center = SEAL / 2;
  return (
    <View className="overflow-hidden rounded-full bg-ink" style={{ width: SEAL, height: SEAL }}
      accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden pointerEvents="none"
      testID={testID}>
      <Image source={NIGHT} resizeMode="cover" style={NIGHT_STYLE} />
      <View className="absolute inset-0 bg-black" style={{ opacity: 0.32 }} />
      {emblem ? <Image source={emblem} tintColor={SEAL_GOLD} resizeMode="contain" style={EMBLEM_STYLE} /> : null}
      <Svg width={SEAL} height={SEAL} style={RIM_STYLE}>
        {emblem ? null : <Path d={sparklePath(center, center, 11)} fill={SEAL_GOLD} />}
        <Circle cx={center} cy={center} r={center - 0.75} fill="none" stroke={SEAL_GOLD} strokeOpacity={0.7} strokeWidth={1.5} />
      </Svg>
    </View>
  );
}
