import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import * as ReactNative from 'react-native';
import { ScrollView } from 'react-native';

import BreatheExercise from '@/app/breathe/[pattern]';
import { BreathGauge } from '@/components/breathe/BreathGauge';
import { BreathRing } from '@/components/breathe/BreathRing';
import { WorldTrainerSignature } from '@/components/trainer/WorldTrainerSignature';
import type { BreathEngine } from '@/hooks/useBreathEngine';
import { TID } from '@/lib/testIDs';

const mockStart = jest.fn();
const mockPause = jest.fn();
const mockReset = jest.fn();
const mockToggleSound = jest.fn();
const mockTogglePlayer = jest.fn();
let mockReducedMotion = false;
let mockSoundEnabled = true;
let mockPlayerStatus = 'idle';
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

let mockScreenReader = false;

jest.mock('@/hooks/useScreenReader', () => ({
  useScreenReader: () => mockScreenReader,
}));

jest.mock('@/hooks/useWorldSoundscape', () => ({
  useWorldSoundscape: () => ({
    soundEnabled: mockSoundEnabled,
    toggleSound: mockToggleSound,
  }),
}));

jest.mock('@/context/PlayerContext', () => ({
  usePlayer: () => ({ status: mockPlayerStatus, toggle: mockTogglePlayer }),
}));

const mockSpeakBreathPhase = jest.fn(() => Promise.resolve());
const mockStopBreathVoice = jest.fn(() => Promise.resolve());

jest.mock('@/lib/breathGuidance', () => ({
  speakBreathPhase: (...args: unknown[]) => mockSpeakBreathPhase(...(args as [])),
  stopBreathVoice: (...args: unknown[]) => mockStopBreathVoice(...(args as [])),
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
  started: false,
  status: 'ready',
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
    mockSoundEnabled = true;
    mockScreenReader = false;
    mockPlayerStatus = 'idle';
    mockToggleSound.mockClear();
    mockTogglePlayer.mockClear();
    mockSpeakBreathPhase.mockClear();
    mockStopBreathVoice.mockClear();
    mockEngine = engineState();
  });

  it('preserves the exercise anchors and starts from the primary action', () => {
    render(<BreatheExercise />);

    expect(screen.getByTestId(TID.Screen.BreatheExercise)).toBeTruthy();
    expect(screen.getByTestId(TID.Text.BreathePhase)).toHaveTextContent('Ready');
    expect(screen.getByTestId(TID.Text.BreathePhase).props.accessibilityLiveRegion).toBeUndefined();
    expect(screen.queryByLabelText('Cycle 1 of 18')).toBeNull();
    expect(screen.getByTestId(TID.Button.BreatheStart)).toHaveTextContent('Begin');
    expect(screen.getByTestId(TID.Button.BreatheStart).props.accessibilityHint).toBeUndefined();

    fireEvent.press(screen.getByTestId(TID.Button.BreatheStart));
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('reproduces the ready/active ambiguity before launch and keeps them distinct', () => {
    const ready = render(<BreatheExercise />);
    const readyPhase = screen.getByTestId(TID.Text.BreathePhase);

    expect(readyPhase).toHaveTextContent('Ready');
    expect(readyPhase).not.toHaveTextContent('Begin');
    expect(readyPhase).not.toHaveTextContent('Breathe in');
    expect(screen.queryByText('4')).toBeNull();
    expect(screen.getByTestId(TID.Button.BreatheStart)).toHaveTextContent('Begin');
    expect(screen.getByText('3:00')).toBeTruthy();
    ready.unmount();

    mockEngine = engineState({
      running: true,
      started: true,
      status: 'active',
      remainingSec: 176,
      state: {
        phase: 'inhale',
        phaseIndex: 0,
        phaseProgress: 0.25,
        phaseRemainingSec: 4,
        cycleIndex: 0,
      },
    });
    render(<BreatheExercise />);

    const activePhase = screen.getByTestId(TID.Text.BreathePhase);
    expect(activePhase).toHaveTextContent('Breathe in');
    expect(activePhase.props.accessibilityLiveRegion).toBeUndefined();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByLabelText('Cycle 1 of 18')).toBeTruthy();
    expect(screen.getByTestId(TID.Button.BreatheStart)).toHaveTextContent('Pause');
  });

  it('provides a distinct static mark for the selected world motion', () => {
    const view = render(
      <WorldTrainerSignature motion="orbit" size={240}>
        <ReactNative.View />
      </WorldTrainerSignature>
    );

    expect(view.UNSAFE_getByProps({ testID: 'trainer.signature.orbit' })).toBeTruthy();
  });

  it('announces an active phase once without a live region echo', () => {
    const announce = jest.spyOn(ReactNative.AccessibilityInfo, 'announceForAccessibility');
    mockScreenReader = true;
    mockEngine = engineState({
      running: true,
      started: true,
      status: 'active',
      remainingSec: 176,
    });
    render(<BreatheExercise />);

    const phase = screen.getByTestId(TID.Text.BreathePhase);
    expect(phase.props.accessibilityLiveRegion).toBeUndefined();
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Breathe in');
    announce.mockRestore();
  });

  it('keeps phase semantics and maps the same action to pause while running', () => {
    mockEngine = engineState({ running: true, started: true, status: 'active', remainingSec: 176 });
    render(<BreatheExercise />);

    const phase = screen.getByTestId(TID.Text.BreathePhase);
    expect(phase).toHaveTextContent('Breathe in');
    expect(phase.props.accessibilityRole).toBe('header');
    expect(phase.props.accessibilityLiveRegion).toBeUndefined();

    const action = screen.getByTestId(TID.Button.BreatheStart);
    expect(action).toHaveTextContent('Pause');
    expect(action.props.accessibilityHint).toBeUndefined();
    fireEvent.press(action);
    expect(mockPause).toHaveBeenCalledTimes(1);
  });

  it('exposes one native accessible sound switch without spoken guidance', () => {
    render(<BreatheExercise />);

    const sound = screen.getByTestId(TID.Button.BreatheSound);
    expect(sound.props).toMatchObject({
      accessibilityRole: 'switch',
      accessibilityState: { checked: true },
    });

    fireEvent.press(sound);
    expect(mockToggleSound).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('btn.breathe.voice').props).toMatchObject({
      accessibilityRole: 'switch',
      accessibilityState: { checked: false },
      accessibilityLabel: 'Turn spoken guidance on',
    });
    expect(screen.getByTestId('btn.breathe.voice')).toHaveTextContent('Spoken guidance');
    expect(screen.getByTestId('btn.breathe.haptic').props).toMatchObject({
      accessibilityRole: 'switch',
      accessibilityState: { checked: true },
      accessibilityLabel: 'Turn vibration off',
    });
    expect(screen.getByTestId('btn.breathe.haptic')).toHaveTextContent('Vibration');
    expect(screen.getByTestId(TID.Button.BreatheSound)).toHaveTextContent('Sound');
  });

  it('lets voice-only practice speak each phase without TalkBack or ambience', () => {
    const announce = jest.spyOn(ReactNative.AccessibilityInfo, 'announceForAccessibility');
    mockSoundEnabled = false;
    mockEngine = engineState({
      running: true,
      started: true,
      status: 'active',
      remainingSec: 176,
    });
    render(<BreatheExercise />);

    fireEvent.press(screen.getByTestId('btn.breathe.voice'));

    expect(mockSpeakBreathPhase).toHaveBeenCalledWith('Breathe in', 'en');
    expect(announce).not.toHaveBeenCalled();
    expect(screen.getByTestId(TID.Button.BreatheSound).props.accessibilityState).toMatchObject({
      checked: false,
    });
    announce.mockRestore();
  });

  it('never doubles TalkBack with optional TTS', () => {
    const announce = jest.spyOn(ReactNative.AccessibilityInfo, 'announceForAccessibility');
    mockScreenReader = true;
    mockEngine = engineState({
      running: true,
      started: true,
      status: 'active',
      remainingSec: 176,
    });
    render(<BreatheExercise />);

    fireEvent.press(screen.getByTestId('btn.breathe.voice'));

    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Breathe in');
    expect(mockSpeakBreathPhase).not.toHaveBeenCalled();
    expect(mockStopBreathVoice).toHaveBeenCalled();
    announce.mockRestore();
  });

  it('stops spoken guidance on pause and unmount', () => {
    mockEngine = engineState({
      running: true,
      started: true,
      status: 'active',
      remainingSec: 176,
    });
    const view = render(<BreatheExercise />);

    fireEvent.press(screen.getByTestId('btn.breathe.voice'));
    expect(mockSpeakBreathPhase).toHaveBeenCalledTimes(1);

    mockEngine = engineState({
      running: false,
      started: true,
      status: 'paused',
      remainingSec: 150,
    });
    view.rerender(<BreatheExercise />);
    expect(mockStopBreathVoice).toHaveBeenCalled();

    const stopsAfterPause = mockStopBreathVoice.mock.calls.length;
    view.unmount();
    expect(mockStopBreathVoice.mock.calls.length).toBeGreaterThan(stopsAfterPause);
  });

  it('keeps Ready on the title and Begin on the CTA until the exercise starts', () => {
    render(<BreatheExercise />);

    expect(screen.getByTestId(TID.Text.BreathePhase)).toHaveTextContent('Ready');
    expect(screen.getByTestId(TID.Button.BreatheStart)).toHaveTextContent('Begin');
    expect(screen.getByTestId(TID.Button.BreatheStart)).not.toHaveTextContent('Ready');
  });

  it('maps resume after a pause without looking like a fresh start', () => {
    mockEngine = engineState({
      running: false,
      started: true,
      status: 'paused',
      remainingSec: 150,
      state: {
        phase: 'exhale',
        phaseIndex: 1,
        phaseProgress: 0.4,
        phaseRemainingSec: 4,
        cycleIndex: 0,
      },
    });
    render(<BreatheExercise />);

    const phase = screen.getByTestId(TID.Text.BreathePhase);
    expect(phase).toHaveTextContent('Paused');
    expect(phase).not.toHaveTextContent('Breathe out');
    expect(phase).not.toHaveTextContent('Ready');
    expect(screen.queryByText('4')).toBeNull();
    expect(screen.queryByText('Next: inhale')).toBeNull();
    expect(screen.queryByLabelText('Cycle 1 of 18')).toBeNull();
    expect(screen.getByText('2:30')).toBeTruthy();
    expect(screen.getByTestId(TID.Button.BreatheStart)).toHaveTextContent('Resume');
    fireEvent.press(screen.getByTestId(TID.Button.BreatheStart));
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('freezes phase semantics while paused instead of looking still active', () => {
    mockEngine = engineState({
      running: false,
      started: true,
      status: 'paused',
      remainingSec: 176,
      state: {
        phase: 'inhale',
        phaseIndex: 0,
        phaseProgress: 0.25,
        phaseRemainingSec: 4,
        cycleIndex: 0,
      },
    });
    render(<BreatheExercise />);

    const phase = screen.getByTestId(TID.Text.BreathePhase);
    expect(phase).toHaveTextContent('Paused');
    expect(phase).not.toHaveTextContent('Breathe in');
    expect(screen.queryByText('4')).toBeNull();
    expect(screen.queryByText('Next: exhale')).toBeNull();
    expect(screen.queryByLabelText('Cycle 1 of 18')).toBeNull();
    expect(screen.getByText('2:56')).toBeTruthy();
    expect(screen.getByTestId(TID.Button.BreatheStart)).toHaveTextContent('Resume');
  });

  it('resets a finished exercise instead of pausing it', () => {
    mockEngine = engineState({
      running: false,
      started: true,
      status: 'finished',
      finished: true,
      remainingSec: 0,
    });
    render(<BreatheExercise />);

    expect(screen.getByTestId(TID.Text.BreathePhase)).toHaveTextContent('Breath settled');
    expect(screen.getByTestId(TID.Button.BreatheStart)).toHaveTextContent('Again');
    fireEvent.press(screen.getByTestId(TID.Button.BreatheStart));
    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('keeps essential type scale at 160% and 200% instead of clamping it', () => {
    const dimensions = jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
      width: 390,
      height: 844,
      scale: 3,
      fontScale: 1.6,
    });

    try {
      render(<BreatheExercise />);
      const phase = screen.getByTestId(TID.Text.BreathePhase);
      expect(phase.props.maxFontSizeMultiplier ?? 2).toBeGreaterThanOrEqual(2);
      expect(screen.getByTestId(TID.Button.BreatheStart)).toBeTruthy();
    } finally {
      dimensions.mockRestore();
    }
  });

  it('pauses a playing session before the trainer takes over the soundscape', () => {
    mockPlayerStatus = 'playing';
    render(<BreatheExercise />);

    fireEvent.press(screen.getByTestId(TID.Button.BreatheStart));

    expect(mockTogglePlayer).toHaveBeenCalledTimes(1);
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockTogglePlayer.mock.invocationCallOrder[0]).toBeLessThan(
      mockStart.mock.invocationCallOrder[0]
    );
  });

  it('replaces the animated ring with a static gauge under reduced motion', () => {
    mockReducedMotion = true;
    mockEngine = engineState({ running: true, started: true, status: 'active', remainingSec: 176 });
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
      expect(view.UNSAFE_queryByType(BreathGauge)).toBeNull();
      expect(view.UNSAFE_queryByType(BreathRing)).toBeNull();
      expect(screen.getByText('3:00')).toBeTruthy();
      expect(screen.queryByLabelText('Cycle 1 of 18')).toBeNull();
      const compactColumn = screen.getByTestId(TID.Screen.BreatheExercise);
      expect(compactColumn.props.horizontal).toBeFalsy();
      const compactRails = view
        .UNSAFE_getAllByType(ScrollView)
        .filter((node) => node.props.horizontal === true);
      expect(compactRails).toHaveLength(2);
      expect(screen.getByTestId(TID.Button.BreatheStart)).toHaveTextContent('Begin');
      expect(screen.getByTestId('btn.breathe.voice')).toBeTruthy();
      expect(screen.getByTestId('btn.breathe.haptic')).toBeTruthy();
      expect(
        screen.getByTestId(TID.Text.BreathePhase).props.maxFontSizeMultiplier ?? 2
      ).toBeGreaterThanOrEqual(2);
    } finally {
      dimensions.mockRestore();
    }
  });

  it('keeps Ready, timer and CTA stacked without the truncated world header at 320dp/200%', () => {
    const dimensions = jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
      width: 320,
      height: 569,
      scale: 3,
      fontScale: 2,
    });

    try {
      const view = render(<BreatheExercise />);
      const phase = screen.getByTestId(TID.Text.BreathePhase);
      const timer = screen.getByText('3:00');
      const start = screen.getByTestId(TID.Button.BreatheStart);
      const column = screen.getByTestId(TID.Screen.BreatheExercise);

      expect(phase).toHaveTextContent('Ready');
      expect(phase.props.className).toEqual(expect.stringContaining('text-h2'));
      expect(phase.props.className).not.toEqual(expect.stringContaining('text-display'));
      expect(screen.queryByText('CONSTE…')).toBeNull();
      expect(screen.queryByText('Constellation')).toBeNull();
      expect(screen.queryByText('2/3 · Practice')).toBeNull();
      expect(timer).toBeTruthy();
      expect(start).toHaveTextContent('Begin');
      expect(column.props.className).toEqual(expect.stringContaining('min-h-0'));
      expect(column.props.contentContainerClassName).toEqual(
        expect.stringContaining('justify-between')
      );
      expect(view.UNSAFE_queryByType(BreathGauge)).toBeNull();
      expect(view.UNSAFE_queryByType(BreathRing)).toBeNull();
      expect(column.props.horizontal).toBeFalsy();
      const rails = view
        .UNSAFE_getAllByType(ScrollView)
        .filter((node) => node.props.horizontal === true);
      expect(rails).toHaveLength(2);
      const collectJsonText = (node: unknown, acc: string[] = []): string[] => {
        if (node == null || typeof node === 'boolean') return acc;
        if (typeof node === 'string' || typeof node === 'number') {
          acc.push(String(node));
          return acc;
        }
        if (Array.isArray(node)) {
          node.forEach((item) => collectJsonText(item, acc));
          return acc;
        }
        if (typeof node === 'object' && 'children' in node) {
          return collectJsonText((node as { children?: unknown }).children, acc);
        }
        return acc;
      };
      const columnText = collectJsonText(view.toJSON());
      const readyIndex = columnText.indexOf('Ready');
      const timerIndex = columnText.indexOf('3:00');
      const howLongIndex = columnText.indexOf('How long?');
      const beginIndex = columnText.indexOf('Begin');
      expect(readyIndex).toBeGreaterThanOrEqual(0);
      expect(timerIndex).toBeGreaterThan(readyIndex);
      expect(howLongIndex).toBeGreaterThan(timerIndex);
      expect(beginIndex).toBeGreaterThan(howLongIndex);
      expect(screen.getByTestId('btn.breathe.voice')).toBeTruthy();
      expect(screen.getByTestId('btn.breathe.haptic')).toBeTruthy();
    } finally {
      dimensions.mockRestore();
    }
  });
});
