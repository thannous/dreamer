import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path } from 'react-native-svg';

import { useTheme } from '@/context/ThemeContext';

export type EmptyIllustrationName = 'saved' | 'search' | 'practice' | 'offline';

type Props = {
  name: EmptyIllustrationName;
  size?: number;
};

/**
 * Illustrations for the four empty states.
 *
 * Drawn in the language the app already speaks — thin champagne lines, an
 * orbit, a little dust — rather than in a borrowed illustration style. They are
 * the same strokes as the atmosphere behind them and the crescent on the app
 * icon, so an empty screen still looks like this app rather than like a gap.
 *
 * Each one shows an absence, never a failure: an orbit with nothing on it, a
 * lens over empty sky. Nobody needs to be told off for not having practised.
 */
export function EmptyIllustration({ name, size = 132 }: Props) {
  const { colors, atmosphere } = useTheme();

  const line = {
    stroke: colors.accentText,
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    fill: 'none',
  };
  const faint = { ...line, opacity: 0.45 };
  const dust = atmosphere.star;

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 120 120">
        {/* Shared with every state: the orbit, quietly off-centre. */}
        <Ellipse cx={60} cy={62} rx={44} ry={30} {...faint} />

        {name === 'saved' ? (
          <>
            {/* An empty bookmark: the slot exists, nothing sits in it yet. */}
            <Path d="M46 34h28v46l-14-10-14 10z" {...line} />
            <Circle cx={94} cy={34} r={1.6} fill={dust} />
            <Circle cx={22} cy={82} r={1.2} fill={dust} />
          </>
        ) : null}

        {name === 'search' ? (
          <>
            <Circle cx={54} cy={54} r={22} {...line} />
            <Line x1={70} y1={70} x2={86} y2={86} {...line} />
            {/* Only dust inside the lens — the word found nothing. */}
            <Circle cx={48} cy={50} r={1.6} fill={dust} />
            <Circle cx={60} cy={58} r={1.2} fill={dust} />
            <Circle cx={53} cy={62} r={1} fill={dust} />
          </>
        ) : null}

        {name === 'practice' ? (
          <>
            {/* The calendar's own dots, all still hollow. */}
            {[26, 43, 60, 77, 94].map((cx) => (
              <Circle key={cx} cx={cx} cy={60} r={7} {...line} />
            ))}
            <Circle cx={26} cy={90} r={1.4} fill={dust} />
            <Circle cx={98} cy={32} r={1.6} fill={dust} />
          </>
        ) : null}

        {name === 'offline' ? (
          <>
            {/* The crescent of the app mark, with the orbit broken open. */}
            <Path d="M70 38a21 21 0 1 0 0 42 25 25 0 0 1 0-42z" {...line} />
            <Path d="M20 62a40 40 0 0 1 12-28" {...faint} strokeDasharray="5 7" />
            <Path d="M100 62a40 40 0 0 1-12 28" {...faint} strokeDasharray="5 7" />
            <Circle cx={96} cy={30} r={1.4} fill={dust} />
          </>
        ) : null}
      </Svg>
    </View>
  );
}
