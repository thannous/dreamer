import { Canvas } from '@shopify/react-native-skia';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { ImmersiveScene, type ImmersiveScenePalette } from '@/components/immersive';
import { NightTheme } from '@/constants/theme';

const palette: ImmersiveScenePalette = {
  fog: NightTheme.backgroundSecondary,
  glow: NightTheme.accent,
  light: NightTheme.accentLight,
  ground: NightTheme.background,
};

describe('ImmersiveScene', () => {
  it('creates one canvas from the measured container rather than screen dimensions', () => {
    const view = render(
      <ImmersiveScene palette={palette} testID="immersive-scene" />
    );
    const scene = view.root.findByProps({ testID: 'immersive-scene' });

    expect(view.UNSAFE_queryByType(Canvas)).toBeNull();

    fireEvent(scene, 'layout', {
      nativeEvent: { layout: { height: 640, width: 320, x: 0, y: 0 } },
    });
    expect(view.UNSAFE_getAllByType(Canvas)).toHaveLength(1);

    fireEvent(scene, 'layout', {
      nativeEvent: { layout: { height: 360, width: 744, x: 0, y: 0 } },
    });
    expect(view.UNSAFE_getAllByType(Canvas)).toHaveLength(1);
  });
});
