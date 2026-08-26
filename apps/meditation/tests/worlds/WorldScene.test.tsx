import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text as RNText } from 'react-native';
import Animated from 'react-native-reanimated';

import { GrainOverlay } from '@/components/atmosphere/GrainOverlay';
import { WorldScene, worldArtworkMotionStyle } from '@/components/worlds/WorldScene';
import { Duration } from '@/constants/motion';
import { NightTheme, PaperTheme } from '@/constants/theme';
import { WORLD_BY_ID, WORLD_IDS } from '@/constants/worlds';
import { BreathProvider } from '@/context/BreathContext';

let mockIsFocused = true;
let mockReducedMotion = false;

jest.mock('expo-router', () => ({
  useIsFocused: () => mockIsFocused,
}));

jest.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockReducedMotion,
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
    mockReducedMotion = false;
  });

  it('uses the requested artwork role and updates it when the role changes', () => {
    const world = WORLD_BY_ID.constellation;
    const view = render(
      <WorldScene world={world} artwork="journey">
        <RNText>Contenu du rituel</RNText>
      </WorldScene>
    );

    expect(view.UNSAFE_getByType(Image).props.source).toBe(world.artwork.journey);
    expect(view.UNSAFE_getByType(Image).props.recyclingKey).toBe('constellation-journey');

    view.rerender(
      <WorldScene world={world} artwork="trainer">
        <RNText>Contenu du rituel</RNText>
      </WorldScene>
    );

    expect(view.UNSAFE_getByType(Image).props.source).toBe(world.artwork.trainer);
    expect(view.UNSAFE_getByType(Image).props.recyclingKey).toBe('constellation-trainer');

    view.rerender(
      <WorldScene world={WORLD_BY_ID.forest} artwork="journey">
        <RNText>Contenu du rituel</RNText>
      </WorldScene>
    );

    expect(view.UNSAFE_getByType(Image).props.source).toBe(
      WORLD_BY_ID.forest.artwork.journey
    );
    expect(view.UNSAFE_getByType(Image).props.recyclingKey).toBe('forest-journey');
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

  it('renders the global-breath tint, world reveal veil and one grain film', () => {
    const view = render(
      <BreathProvider>
        <WorldScene world={WORLD_BY_ID.constellation} artwork="trainer">
          <RNText>Trainer</RNText>
        </WorldScene>
      </BreathProvider>
    );

    expect(view.UNSAFE_getAllByType(Animated.View)).toHaveLength(3);
    expect(view.UNSAFE_getAllByType(GrainOverlay)).toHaveLength(1);
  });

  it('mounts the immersive canvas only when a route explicitly opts in', () => {
    const view = render(
      <WorldScene world={WORLD_BY_ID.constellation} artwork="purchase">
        <RNText>Constellation</RNText>
      </WorldScene>
    );

    expect(view.queryByTestId('world-scene-immersive.constellation')).toBeNull();

    view.rerender(
      <WorldScene world={WORLD_BY_ID.constellation} artwork="purchase" immersive>
        <RNText>Constellation</RNText>
      </WorldScene>
    );

    expect(
      view.root.findByProps({ testID: 'world-scene-immersive.constellation' })
    ).toBeTruthy();
  });

  it('gives every world a distinct physical response to the shared breath', () => {
    const styles = Object.values(WORLD_BY_ID).map((world) =>
      JSON.stringify({
        start: worldArtworkMotionStyle(world.motion, 0),
        end: worldArtworkMotionStyle(world.motion, 1),
      })
    );

    expect(new Set(styles).size).toBe(6);
  });

  it('cross-dissolves world artwork and removes motion when reduced motion is enabled', () => {
    const view = render(
      <WorldScene world={WORLD_BY_ID.constellation} artwork="journey">
        <RNText>Monde</RNText>
      </WorldScene>
    );

    expect(view.UNSAFE_getByType(Image).props.transition).toBe(Duration.slow);
    expect(view.root.findByProps({ testID: 'world-scene-motion.orbit' })).toBeTruthy();

    mockReducedMotion = true;
    view.rerender(
      <WorldScene world={WORLD_BY_ID.dawn} artwork="journey">
        <RNText>Monde</RNText>
      </WorldScene>
    );

    expect(view.UNSAFE_getByType(Image).props.transition).toBe(0);
    expect(view.root.findByProps({ testID: 'world-scene-motion.rise' })).toBeTruthy();
  });

  it('uses each world\'s authored centre scrim instead of a hidden appearance guess', () => {
    function expectedCentre(color: string, opacity: number): string {
      const hex = color.startsWith('#') ? color.slice(1) : color;
      const red = Number.parseInt(hex.slice(0, 2), 16);
      const green = Number.parseInt(hex.slice(2, 4), 16);
      const blue = Number.parseInt(hex.slice(4, 6), 16);
      return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
    }

    const world = WORLD_BY_ID.forest;
    const view = render(
      <WorldScene world={world} artwork="journey">
        <RNText>Texte du rituel</RNText>
      </WorldScene>
    );

    const gradient = view.UNSAFE_getByType(LinearGradient);
    expect(gradient.props.colors[1]).toBe(
      expectedCentre(world.atmosphere.scrimColor, world.atmosphere.centreScrimOpacity)
    );
    expect(gradient.props.colors[1]).toBe(expectedCentre(NightTheme.background, 0.7));

    view.rerender(
      <WorldScene world={WORLD_BY_ID.cloud} artwork="journey">
        <RNText>Texte du rituel</RNText>
      </WorldScene>
    );

    expect(view.UNSAFE_getByType(LinearGradient).props.colors[1]).toBe(
      expectedCentre(PaperTheme.background, WORLD_BY_ID.cloud.atmosphere.centreScrimOpacity)
    );

    const authored = {
      ...WORLD_BY_ID.constellation,
      atmosphere: {
        ...WORLD_BY_ID.constellation.atmosphere,
        centreScrimOpacity: 0.31,
      },
    };

    view.rerender(
      <WorldScene world={authored} artwork="journey" scrimStrength={1}>
        <RNText>Texte du rituel</RNText>
      </WorldScene>
    );

    expect(view.UNSAFE_getByType(LinearGradient).props.colors[1]).toBe(
      expectedCentre(NightTheme.background, 0.31)
    );

    view.rerender(
      <WorldScene world={WORLD_BY_ID.dawn} artwork="journey" scrimStrength={0.5}>
        <RNText>Texte du rituel</RNText>
      </WorldScene>
    );

    expect(view.UNSAFE_getByType(LinearGradient).props.colors[1]).toBe(
      expectedCentre(PaperTheme.background, WORLD_BY_ID.dawn.atmosphere.centreScrimOpacity * 0.5)
    );
  });

  it('keeps every registered world on its own centre veil', () => {
    const view = render(
      <WorldScene world={WORLD_BY_ID.constellation} artwork="journey">
        <RNText>Monde</RNText>
      </WorldScene>
    );

    const stops = WORLD_IDS.map((id) => {
      const world = WORLD_BY_ID[id];
      view.rerender(
        <WorldScene world={world} artwork="journey">
          <RNText>Monde</RNText>
        </WorldScene>
      );
      return view.UNSAFE_getByType(LinearGradient).props.colors[1] as string;
    });

    expect(new Set(stops).size).toBe(WORLD_IDS.length);
    expect(stops.every((stop) => stop.startsWith('rgba('))).toBe(true);
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
