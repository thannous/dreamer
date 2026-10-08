import { render } from '@testing-library/react-native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

import OnboardingLayout from '@/app/(onboarding)/_layout';
import WelcomeScreen from '@/app/welcome';

let mockIsFocused = true;

jest.mock('expo-router', () => {
  const { View } = jest.requireActual('react-native');
  return {
    Stack: () => <View />,
    useIsFocused: () => mockIsFocused,
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  };
});

jest.mock('uniwind', () => ({
  ScopedTheme: ({ children }: React.PropsWithChildren) => children,
  Uniwind: { setTheme: jest.fn() },
  useUniwind: () => ({ theme: 'dark' }),
  withUniwind: (Component: React.ComponentType<object>) => Component,
}));

// Welcome and the onboarding group are night scenes that stay mounted under
// the app. They must set light icons while shown, and give the status bar back
// to the root theme once another screen is focused.
describe.each([
  ['welcome', WelcomeScreen],
  ['onboarding group', OnboardingLayout],
])('%s status bar', (_name, Screen) => {
  afterEach(() => {
    mockIsFocused = true;
  });

  it('sets light icons while focused', () => {
    const view = render(<Screen />);
    expect(view.UNSAFE_getByType(StatusBar).props.style).toBe('light');
  });

  it('renders no status bar once unfocused', () => {
    mockIsFocused = false;
    const view = render(<Screen />);
    expect(view.UNSAFE_queryByType(StatusBar)).toBeNull();
  });
});
