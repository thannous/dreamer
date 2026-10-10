import React from 'react';
import { DreamerBackground } from '@/components/ui/DreamerBackground';
import type { DreamerScene } from '@/constants/dreamerArtwork';

/**
 * Compatibility entry point for a painted header in either theme.
 * Decorative: hidden from assistive technology and never intercepts touches.
 */
export function NightSkyBand({ height, background, scene = 'reverie' }: {
  height: number;
  background: string;
  scene?: DreamerScene;
}) {
  return <DreamerBackground height={height} background={background} scene={scene} />;
}
