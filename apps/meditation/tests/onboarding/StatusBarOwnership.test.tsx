import { act, render } from '@testing-library/react-native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

import OnboardingLayout from '@/app/(onboarding)/_layout';
import BreathIntroStep from '@/app/(onboarding)/breath-intro';
import ExperienceStep from '@/app/(onboarding)/experience';
import GoalsStep from '@/app/(onboarding)/goals';
import IntentionStep from '@/app/(onboarding)/intention';
import ReminderStep from '@/app/(onboarding)/reminder';
import WelcomeScreen from '@/app/welcome';
import { BreathProvider } from '@/context/BreathContext';
import { OnboardingProvider } from '@/context/OnboardingContext';
import { SettingsProvider } from '@/context/SettingsContext';

let mockIsFocused = true;

jest.mock('expo-router', () => {
  const { View } = jest.requireActual('react-native');
  return {
    Stack: () => <View />,
    useIsFocused: () => mockIsFocused,
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      canGoBack: () => true,
    }),
  };
});

jest.mock('uniwind', () => ({
  ScopedTheme: ({ children }: React.PropsWithChildren) => children,
  Uniwind: { setTheme: jest.fn() },
  useUniwind: () => ({ theme: 'dark' }),
  withUniwind: (Component: React.ComponentType<object>) => Component,
}));

jest.mock('expo-video', () => ({
  VideoView: jest.requireActual('react-native').View,
  useVideoPlayer: () => ({ play: jest.fn(), pause: jest.fn() }),
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

const Providers = ({ children }: React.PropsWithChildren) => (
  <SettingsProvider>
    <OnboardingProvider>
      <BreathProvider>{children}</BreathProvider>
    </OnboardingProvider>
  </SettingsProvider>
);

// The providers read storage on mount; let that settle before asserting.
async function renderScreen(Screen: React.ComponentType) {
  const view = render(<Screen />, { wrapper: Providers });
  await act(async () => {});
  return view;
}

afterEach(() => {
  mockIsFocused = true;
});

// Welcome, experience, intention and reminder are night scenes in both device
// themes: they set light icons while shown, and give the status bar back to the
// root theme once another screen is focused, since they stay mounted under it.
describe.each([
  ['welcome', WelcomeScreen],
  ['experience', ExperienceStep],
  ['intention', IntentionStep],
  ['reminder', ReminderStep],
])('%s status bar', (_name, Screen) => {
  it('sets light icons while focused', async () => {
    const view = await renderScreen(Screen);
    expect(view.UNSAFE_getByType(StatusBar).props.style).toBe('light');
  });

  it('renders no status bar once unfocused', async () => {
    mockIsFocused = false;
    const view = await renderScreen(Screen);
    expect(view.UNSAFE_queryByType(StatusBar)).toBeNull();
  });
});

// Breath intro and goals follow the device theme, so on a light device a light
// status bar from the group would leave white icons on a light ground.
describe('theme-following onboarding steps', () => {
  it('leave the status bar to the root theme', async () => {
    expect(render(<OnboardingLayout />).UNSAFE_queryByType(StatusBar)).toBeNull();
    expect((await renderScreen(BreathIntroStep)).UNSAFE_queryByType(StatusBar)).toBeNull();
    expect((await renderScreen(GoalsStep)).UNSAFE_queryByType(StatusBar)).toBeNull();
  });
});
