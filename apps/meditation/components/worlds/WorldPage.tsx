import React from 'react';
import type { Edge } from 'react-native-safe-area-context';

import { useWorld } from '@/context/WorldContext';

import { WorldScene } from './WorldScene';

/** Supporting pages retain the selected world's scene, palette and materials. */
export function WorldPage({
  children,
  edges = ['top', 'bottom'],
  className,
}: React.PropsWithChildren<{
  edges?: readonly Edge[];
  className?: string;
}>) {
  const { world } = useWorld();

  return (
    <WorldScene world={world} artwork="journey" edges={edges} className={className}>
      {children}
    </WorldScene>
  );
}
