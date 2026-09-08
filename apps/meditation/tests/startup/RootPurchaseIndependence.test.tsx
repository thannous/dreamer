import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import RootLayout from '@/app/_layout';
import * as SplashScreen from 'expo-splash-screen';

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-router', () => ({
  Stack: () =>
    jest.requireActual('react').createElement(jest.requireActual('react-native').View, {
      testID: 'root-stack',
    }),
}));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => {}),
  hideAsync: jest.fn(async () => {}),
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-system-ui', () => ({ setBackgroundColorAsync: jest.fn(async () => {}) }));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: React.PropsWithChildren) =>
    jest.requireActual('react').createElement(
      jest.requireActual('react-native').View,
      null,
      children
    ),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: React.PropsWithChildren) =>
    jest.requireActual('react').createElement(
      jest.requireActual('react-native').View,
      null,
      children
    ),
}));

jest.mock('@/components/library/LibraryPersistenceNotice', () => ({ LibraryPersistenceNotice: () => null }));

jest.mock('@/context/BreathContext', () => ({
  BreathProvider: ({ children }: React.PropsWithChildren) => children,
}));
jest.mock('@/context/LanguageContext', () => ({
  LanguageProvider: ({ children }: React.PropsWithChildren) => children,
}));
jest.mock('@/context/LibraryContext', () => ({
  LibraryProvider: ({ children }: React.PropsWithChildren) => children,
}));
jest.mock('@/context/OnboardingContext', () => ({
  OnboardingProvider: ({ children }: React.PropsWithChildren) => children,
}));
jest.mock('@/context/PlayerContext', () => ({
  PlayerProvider: ({ children }: React.PropsWithChildren) => children,
}));
jest.mock('@/context/SettingsContext', () => ({
  SettingsProvider: ({ children }: React.PropsWithChildren) => children,
}));
jest.mock('@/context/SubscriptionContext', () => ({
  SubscriptionProvider: ({ children }: React.PropsWithChildren) => children,
}));
jest.mock('@/context/ThemeContext', () => ({
  ThemeProvider: ({ children }: React.PropsWithChildren) => children,
  useTheme: () => ({
    mode: 'dark',
    colors: { background: '#03040D' },
    loaded: true,
  }),
}));
jest.mock('@/context/WorldContext', () => ({
  WorldProvider: ({ children }: React.PropsWithChildren) => children,
  useWorld: () => ({ loaded: true }),
}));
jest.mock('@/context/WorldPurchaseContext', () => ({
  WorldPurchaseProvider: ({ children }: React.PropsWithChildren) => children,
  useWorldPurchases: () => {
    throw new Error('Root startup must not read commercial readiness');
  },
}));

describe('root startup', () => {
  it('hides the splash without waiting for world purchases', async () => {
    render(<RootLayout />);

    expect(screen.getByTestId('root-stack')).toBeTruthy();
    await waitFor(() => expect(SplashScreen.hideAsync).toHaveBeenCalled());
  });
});
