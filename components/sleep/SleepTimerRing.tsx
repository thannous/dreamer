import React from 'react';
import Svg, { Circle } from 'react-native-svg';

/**
 * The time left, drawn as a ring that empties clockwise around the play button. It is
 * redrawn twice a second with the countdown, which is far below what an eye can see
 * move on a ring this size, so it needs no animation of its own.
 */
export function SleepTimerRing({ size, progress, track, fill }: {
  size: number;
  /** 1 when the session is whole, 0 when it has run out. */
  progress: number;
  track: string;
  fill: string;
}) {
  const stroke = 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute' }}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={track} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={fill}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={circumference * (1 - clamped)}
        // Start at twelve o'clock.
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}
