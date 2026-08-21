import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import * as ReactNative from 'react-native';
import { ScrollView } from 'react-native';

import BreatheExercise from '@/app/breathe/[pattern]';
import { BreathGauge } from '@/components/breathe/BreathGauge';
import { BreathRing } from '@/components/breathe/BreathRing';
import type { BreathEngine } from '@/hooks/useBreathEngine';
import { TID } from '@/lib/testIDs';

const mockStart = jest.fn();
const mockPause = jest.fn();
const mockReset = jest.fn();
let mockReducedMotion = false;
let mockEngine: BreathEngine;

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ pattern: 'calm' }),
  useIsFocused: () => true,
  useRouter: () => ({
    back: jest.fn(),
    canGoBack: () => false,
    replace: jest.fn(),
  }),
}));

jest.mock('@/hooks/useBreathEngine', () => {
  const actual = jest.requireActual('@/hooks/useBreathEngine');

  return {
    ...actual,
    useBreathEngine: () => mockEngine,
  };
});

jest.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockReducedMotion,
}));

jest.mock('@/hooks/useScreenReader', () => ({
  useScreenReader: () => false,
}));

jest.mock('uniwind', () => ({
  ScopedTheme: ({ children }: React.PropsWithChildren<{ theme: string }>) => children,
  Uniwind: { setTheme: jest.fn() },
  useUniwind: () => ({ theme: 'dark' }),
  withUniwind: (Component: React.ComponentType<object>) => Component,
}));

const engineState = (overrides: Partial<BreathEngine> = {}): BreathEngine => ({
  state: {
    phase: 'inhale',
    phaseIndex: 0,
    phaseProgress: 0.25,
    phaseRemainingSec: 3,
    cycleIndex: 0,
  },
  scale: {
    value: 0.65,
    get: () => 0.65,
    set: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    modify: jest.fn(),
  },
  running: false,
  remainingSec: 180,
  finished: false,
  start: mockStart,
  pause: mockPause,
  reset: mockReset,
  ...overrides,
});

describe('immersive breathing trainer', () => {
  beforeEach(() => {
    mockReducedMotion = false;
    mockEngine = engineState();
  });

  it('preserves the exercise anchors and starts from the primary action', () => {
    render(<BreatheExercise />);

    expect(screen.getByTestId(TID.Screen.BreatheExercise)).toBeTruthy();
    expect(screen.getByTestId(TID.Text.BreathePhase)).toHaveTextContent('Breathe in');

    fireEvent.press(screen.getByTestId(TID.Button.BreatheStart));
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('keeps phase semantics and maps the same action to pause while running', () => {
    mockEngine = engineState({ running: true, remainingSec: 176 });
    render(<BreatheExercise />);

    const phase = screen.getByTestId(TID.Text.BreathePhase);
    expect(phase).toHaveTextContent('Breathe in');
    expect(phase.props.accessibilityRole).toBe('header');
    expect(phase.props.accessibilityLiveRegion).toBe('polite');

    const action = screen.getByTestId(TID.Button.BreatheStart);
    expect(action).toHaveTextContent('Pause');
    fireEvent.press(action);
    expect(mockPause).toHaveBeenCalledTimes(1);
  });

  it('replaces the animated ring with a static gauge under reduced motion', () => {
    mockReducedMotion = true;
    mockEngine = engineState({ running: true, remainingSec: 176 });
    const view = render(<BreatheExercise />);

    expect(view.UNSAFE_getByType(BreathGauge)).toBeTruthy();
    expect(view.UNSAFE_queryByType(BreathRing)).toBeNull();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('uses the compact trainer at large Dynamic Type without losing controls', () => {
    const dimensions = jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
      width: 390,
      height: 844,
      scale: 3,
      fontScale: 3,
    });

    try {
      const view = render(<BreatheExercise />);

      expect(screen.queryByText('Calming')).toBeNull();
      expect(view.UNSAFE_getByType(BreathGauge).props.compact).toBe(true);
      expect(view.UNSAFE_queryByType(BreathRing)).toBeNull();
      expect(screen.getByText('3:00')).toBeTruthy();
      expect(screen.getByLabelText('Cycle 1 of 18').props).toMatchObject({
        accessibilityRole: 'progressbar',
        accessibilityLabel: 'Cycle 1 of 18',
        accessibilityValue: { min: 1, max: 18, now: 1 },
      });
      expect(view.UNSAFE_getByType(ScrollView).props.horizontal).toBe(true);
      expect(screen.getByTestId(TID.Button.BreatheStart)).toHaveTextContent('Begin');
    } finally {
      dimensions.mockRestore();
    }
  });
});
