import { Canvas } from '@shopify/react-native-skia';
import React, { useCallback, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { useBreath } from '@/context/BreathContext';

import { FogField } from './FogField';
import { GroundedOrb } from './GroundedOrb';

export type ImmersiveScenePalette = {
  fog: string;
  glow: string;
  light: string;
  ground: string;
};

export type ImmersiveSceneProps = {
  palette: ImmersiveScenePalette;
  motionPaused?: boolean;
  testID?: string;
};

/**
 * One GPU canvas for every immersive primitive on the screen. Adding a new
 * effect means composing a node here, never starting another animation loop.
 */
export function ImmersiveScene({
  palette,
  motionPaused = false,
  testID,
}: ImmersiveSceneProps) {
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });
  const { progress, isStill } = useBreath();
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout;
    setSize((current) =>
      Math.abs(current.width - next.width) < 0.5 &&
      Math.abs(current.height - next.height) < 0.5
        ? current
        : { width: next.width, height: next.height }
    );
  }, []);

  const still = isStill || motionPaused;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={handleLayout}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      testID={testID}>
      {width > 0 && height > 0 ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <FogField
            width={width}
            height={height}
            color={palette.fog}
            breath={progress}
            still={still}
          />
          <GroundedOrb
            width={width}
            height={height}
            glowColor={palette.glow}
            lightColor={palette.light}
            groundColor={palette.ground}
            breath={progress}
            still={still}
          />
        </Canvas>
      ) : null}
    </View>
  );
}
