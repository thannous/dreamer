import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';

import { sparklePath } from '@/components/journal/story/sparkle';
import { starHeight, type WeekNights } from '@/lib/weekConstellations';

const INSET = 7;

/**
 * A week drawn as stars, Monday at the left: each night with a dream a star, each other night
 * a speck of dust. Once the week has formed, its stars are joined in the order of its nights.
 * Decorative: whatever carries it says the same in words.
 */
export function WeekConstellationFigure({ week, width, height, ink, dust }: {
  week: WeekNights;
  width: number;
  height: number;
  ink: string;
  dust: string;
}) {
  const points = week.nights.map((noted, day) => ({
    noted,
    x: INSET + ((day + 0.5) / 7) * (width - 2 * INSET),
    y: INSET + starHeight(week.start, day) * (height - 2 * INSET),
  }));
  const stars = points.filter((point) => point.noted);
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={{ width, height }}>
      <Svg width={width} height={height}>
        {week.formed ? (
          <Polyline points={stars.map((point) => `${point.x},${point.y}`).join(' ')}
            fill="none" stroke={ink} strokeWidth={1} strokeOpacity={0.7} strokeLinejoin="round" />
        ) : null}
        {points.map((point, day) => (point.noted
          ? <Path key={day} d={sparklePath(point.x, point.y, week.formed ? 4.5 : 3.5)} fill={ink} />
          : <Circle key={day} cx={point.x} cy={point.y} r={1.2} fill={dust} />))}
      </Svg>
    </View>
  );
}
