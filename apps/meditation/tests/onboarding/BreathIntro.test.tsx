import * as Haptics from 'expo-haptics';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import BreathIntroStep from '@/app/(onboarding)/breath-intro';
import WelcomeScreen from '@/app/welcome';
import { BreathProvider } from '@/context/BreathContext';
import { TID } from '@/lib/testIDs';
import * as audio from '@/services/audioService';

const mockPush = jest.fn();
let mockIsFocused = true;

jest.mock('expo-router', () => ({
  useIsFocused: () => mockIsFocused,
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
}));

jest.mock('expo-video', () => ({
  VideoView: jest.requireActual('react-native').View,
  useVideoPlayer: () => ({ play: jest.fn(), pause: jest.fn() }),
}));

jest.mock('uniwind', () => ({
  ScopedTheme: ({ children }: React.PropsWithChildren) => children,
  Uniwind: { setTheme: jest.fn() },
  useUniwind: () => ({ theme: 'dark' }),
  withUniwind: (Component: React.ComponentType<object>) => Component,
}));

jest.mock('expo-haptics', () => ({
  AndroidHaptics: { Confirm: 'confirm' },
  ImpactFeedbackStyle: { Soft: 'soft' },
  impactAsync: jest.fn(() => Promise.resolve()),
  performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/services/audioService', () => ({
  configureLocalCueSession: jest.fn(() => Promise.resolve()),
  createLocalCuePlayer: jest.fn(() => ({ id: 'breath-cue' })),
  pause: jest.fn(),
  play: jest.fn(),
  release: jest.fn(),
  seekTo: jest.fn(() => Promise.resolve()),
  setVolume: jest.fn(),
}));

jest.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
}));

describe('breath introduction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsFocused = true;
  });

  it('places the shared-breath preview between welcome and goals', () => {
    render(<WelcomeScreen />);

    fireEvent.press(screen.getByTestId(TID.Button.WelcomeStart));
    expect(mockPush).toHaveBeenLastCalledWith('/breath-intro');

    render(
      <BreathProvider>
        <BreathIntroStep />
      </BreathProvider>
    );

    expect(screen.getByTestId(TID.Screen.OnboardingBreathIntro)).toBeTruthy();
    expect(screen.getByTestId(TID.Button.BreathIntroHalo)).toBeTruthy();
    expect(screen.getByText('Continue')).toBeTruthy();

    fireEvent.press(screen.getByTestId(TID.Button.OnboardingContinue));
    expect(mockPush).toHaveBeenLastCalledWith('/goals');
  });

  it('answers one touch with sound, one haptic and an engaged single-cycle state', async () => {
    render(
      <BreathProvider>
        <BreathIntroStep />
      </BreathProvider>
    );

    const halo = screen.getByTestId(TID.Button.BreathIntroHalo);
    expect(halo.props.accessibilityState).toEqual({ selected: false, disabled: false });
    expect(screen.getByText('One breath')).toBeTruthy();
    expect(screen.getByText('Touch to begin')).toBeTruthy();

    fireEvent.press(halo);

    expect(
      jest.mocked(Haptics.performAndroidHapticsAsync).mock.calls.length +
        jest.mocked(Haptics.impactAsync).mock.calls.length
    ).toBe(1);
    expect(audio.seekTo).toHaveBeenCalledWith(expect.objectContaining({ id: 'breath-cue' }), 0);
    await waitFor(() => expect(audio.play).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId(TID.Button.BreathIntroHalo).props.accessibilityState).toEqual({
      selected: true,
      disabled: true,
    });
    expect(screen.getByText('Breathe in')).toBeTruthy();
  });

  it('shows a completion message after exactly one inhale and exhale', () => {
    jest.useFakeTimers();

    render(
      <BreathProvider>
        <BreathIntroStep />
      </BreathProvider>
    );

    fireEvent.press(screen.getByTestId(TID.Button.BreathIntroHalo));
    expect(screen.getByText('Breathe in')).toBeTruthy();

    act(() => jest.advanceTimersByTime(5_500));
    expect(screen.getByText('Breathe out')).toBeTruthy();

    act(() => jest.advanceTimersByTime(5_500));
    expect(screen.getByText('Well done')).toBeTruthy();
    expect(screen.getByText('You can now take the journey further.')).toBeTruthy();
    expect(screen.getByTestId(TID.Button.BreathIntroHalo).props.accessibilityState).toEqual({
      selected: false,
      disabled: false,
    });

    jest.useRealTimers();
  });

  it('lets sound be disabled without disabling the breath or haptic', () => {
    render(
      <BreathProvider>
        <BreathIntroStep />
      </BreathProvider>
    );

    const soundToggle = screen.getByTestId(TID.Button.BreathIntroSound);
    expect(soundToggle.props.accessibilityState).toEqual({ checked: true });

    fireEvent.press(soundToggle);
    expect(screen.getByTestId(TID.Button.BreathIntroSound).props.accessibilityState).toEqual({
      checked: false,
    });

    fireEvent.press(screen.getByTestId(TID.Button.BreathIntroHalo));

    expect(audio.play).not.toHaveBeenCalled();
    expect(
      jest.mocked(Haptics.performAndroidHapticsAsync).mock.calls.length +
        jest.mocked(Haptics.impactAsync).mock.calls.length
    ).toBe(1);
    expect(screen.getByText('Breathe in')).toBeTruthy();
  });

  it('stops and rewinds every audio cue as soon as the route loses focus', async () => {
    const view = render(
      <BreathProvider>
        <BreathIntroStep />
      </BreathProvider>
    );

    fireEvent.press(screen.getByTestId(TID.Button.BreathIntroHalo));
    await waitFor(() => expect(audio.play).toHaveBeenCalledTimes(1));

    jest.mocked(audio.pause).mockClear();
    jest.mocked(audio.seekTo).mockClear();
    mockIsFocused = false;
    view.rerender(
      <BreathProvider>
        <BreathIntroStep />
      </BreathProvider>
    );

    expect(audio.pause).toHaveBeenCalledWith(expect.objectContaining({ id: 'breath-cue' }));
    expect(audio.seekTo).toHaveBeenCalledWith(expect.objectContaining({ id: 'breath-cue' }), 0);
  });
});
