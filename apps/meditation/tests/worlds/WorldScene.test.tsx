import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text as RNText } from 'react-native';
import Animated from 'react-native-reanimated';

import { GrainOverlay } from '@/components/atmosphere/GrainOverlay';
import { WorldScene } from '@/components/worlds/WorldScene';
import { WORLD_BY_ID } from '@/constants/worlds';
import { BreathProvider } from '@/context/BreathContext';

let mockIsFocused = true;

jest.mock('expo-router', () => ({
  useIsFocused: () => mockIsFocused,
}));

jest.mock('uniwind', () => {
  return {
    ScopedTheme: ({ children }: React.PropsWithChildren<{ theme: string }>) => children,
    Uniwind: { setTheme: jest.fn() },
    useUniwind: () => ({ theme: 'dark' }),
    withUniwind: (Component: React.ComponentType<object>) => Component,
  };
});

describe('WorldScene', () => {
  beforeEach(() => {
    mockIsFocused = true;
  });

  it('uses the requested artwork role and updates it when the role changes', () => {
    const world = WORLD_BY_ID.constellation;
    const view = render(
      <WorldScene world={world} artwork="journey">
        <RNText>Contenu du rituel</RNText>
      </WorldScene>
    );

    expect(view.UNSAFE_getByType(Image).props.source).toBe(world.artwork.journey);

    view.rerender(
      <WorldScene world={world} artwork="trainer">
        <RNText>Contenu du rituel</RNText>
      </WorldScene>
    );

    expect(view.UNSAFE_getByType(Image).props.source).toBe(world.artwork.trainer);
  });

  it('keeps visual atmosphere decorative while leaving route content readable', () => {
    const view = render(
      <WorldScene world={WORLD_BY_ID.dawn} artwork="completion">
        <RNText accessibilityRole="header">Rituel terminé</RNText>
      </WorldScene>
    );

    expect(screen.getByRole('header', { name: 'Rituel terminé' })).toBeTruthy();
    expect(view.UNSAFE_getByType(Image).props.accessible).toBe(false);

    const hiddenVisualLayers = view.root.findAll(
      (node) => node.props.importantForAccessibility === 'no-hide-descendants'
    );
    expect(hiddenVisualLayers.length).toBeGreaterThanOrEqual(3);
  });

  it('renders one global-breath tint layer and one grain film', () => {
    const view = render(
      <BreathProvider>
        <WorldScene world={WORLD_BY_ID.constellation} artwork="trainer">
          <RNText>Trainer</RNText>
        </WorldScene>
      </BreathProvider>
    );

    expect(view.UNSAFE_getAllByType(Animated.View)).toHaveLength(1);
    expect(view.UNSAFE_getAllByType(GrainOverlay)).toHaveLength(1);
  });

  it('owns the status bar only while focused and follows the world appearance', () => {
    const view = render(
      <WorldScene world={WORLD_BY_ID.constellation} artwork="journey">
        <RNText>Monde nocturne</RNText>
      </WorldScene>
    );

    expect(view.UNSAFE_getByType(StatusBar).props.style).toBe('light');

    view.rerender(
      <WorldScene world={WORLD_BY_ID.dawn} artwork="journey">
        <RNText>Monde lumineux</RNText>
      </WorldScene>
    );
    expect(view.UNSAFE_getByType(StatusBar).props.style).toBe('dark');

    mockIsFocused = false;
    view.rerender(
      <WorldScene world={WORLD_BY_ID.dawn} artwork="journey">
        <RNText>Monde hors focus</RNText>
      </WorldScene>
    );
    expect(view.UNSAFE_queryByType(StatusBar)).toBeNull();
  });
});
