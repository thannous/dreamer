import { render, screen, waitFor } from '@testing-library/react-native-legacy';
import React from 'react';
import { Platform } from 'react-native';

import RootLayout from '@/app/_layout';
import * as SplashScreen from 'expo-splash-screen';

let mockSegments: string[] = ['(drawer)', '(tabs)'];
const mockStackOptions: { animation?: string }[] = [];

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-router', () => ({
  useSegments: () => mockSegments,
  usePathname: () => '/',
  useGlobalSearchParams: () => ({}),
  Stack: ({ screenOptions }: { screenOptions: { animation?: string } }) => {
    mockStackOptions.push(screenOptions);
    return jest.requireActual('react').createElement(jest.requireActual('react-native').View, {
      testID: 'root-stack',
    });
  },
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
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: React.PropsWithChildren) =>
    jest.requireActual('react').createElement(
      jest.requireActual('react-native').View,
      null,
      children
    ),
}));

jest.mock('@/components/player/MiniPlayer', () => ({ MiniPlayer: () => null, isCompactPlayerScreen: () => false }));

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
  usePlayerState: () => ({ session: null, status: 'idle' }),
  PlayerProvider: ({ children }: React.PropsWithChildren) => children,
}));
jest.mock('@/context/SettingsContext', () => ({
  SettingsProvider: ({ children }: React.PropsWithChildren) => children,
}));
jest.mock('@/context/SubscriptionContext', () => ({
  SubscriptionProvider: ({ children }: React.PropsWithChildren) => children,
}));
jest.mock('@/context/ThemeContext', () => ({
  ThemeScope: ({ children }: React.PropsWithChildren) => children,
  ThemeProvider: ({ children }: React.PropsWithChildren) => children,
  useTheme: () => ({
    mode: 'dark',
    colors: { background: '#03040D' },
    loaded: true,
  }),
}));
jest.mock('@/context/WorldContext', () => ({
  WorldProvider: ({ children }: React.PropsWithChildren) => children,
  useWorld: () => {
    const world = jest.requireActual('@/constants/worlds').WORLD_BY_ID.constellation;
    return { loaded: true, world, presentationWorld: world };
  },
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

  it('switches the startup redirect instantly, then keeps the platform motion', () => {
    // `app/index.tsx`, the startup route, has no segments.
    mockSegments = [];
    const view = render(<RootLayout />);
    expect(mockStackOptions.at(-1)?.animation).toBe('none');

    mockSegments = ['(drawer)', '(tabs)'];
    view.rerender(<RootLayout />);
    expect(mockStackOptions.at(-1)?.animation).toBe(Platform.OS === 'android' ? 'none' : 'fade');

    // Back on a segment-less route later, the motion stays.
    mockSegments = [];
    view.rerender(<RootLayout />);
    expect(mockStackOptions.at(-1)?.animation).toBe(Platform.OS === 'android' ? 'none' : 'fade');
  });
});
