import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native-legacy';
import React, { useImperativeHandle } from 'react';
import { Alert, Text, type AlertButton } from 'react-native';

import AccountScreen from '@/app/settings/account';
import { LanguageProvider, useTranslation } from '@/context/LanguageContext';
import { LibraryProvider, useLibrary } from '@/context/LibraryContext';
import { OnboardingProvider } from '@/context/OnboardingContext';
import { SettingsProvider, useSettings } from '@/context/SettingsContext';
import { useWorld, WorldProvider } from '@/context/WorldContext';
import { cancelAll } from '@/services/notificationService';
import { StorageKey } from '@/services/storageService';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn(), canGoBack: () => true }),
  useIsFocused: () => true,
}));

jest.mock('@/services/notificationService', () => ({
  cancelAll: jest.fn(() => Promise.resolve()),
  requestPermission: jest.fn(() => Promise.resolve(true)),
  syncReminders: jest.fn(() => Promise.resolve(1)),
}));

jest.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
}));

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

type Probe = {
  language: ReturnType<typeof useTranslation>;
  library: ReturnType<typeof useLibrary>;
  settings: ReturnType<typeof useSettings>;
  world: ReturnType<typeof useWorld>;
};
const probeRef = React.createRef<Probe>();
const probe = () => probeRef.current!;

function StateProbe() {
  const state: Probe = {
    language: useTranslation(),
    library: useLibrary(),
    settings: useSettings(),
    world: useWorld(),
  };
  useImperativeHandle(probeRef, () => state);
  const { favorites, practiceLog } = state.library;
  const { profile, reminders } = state.settings;
  return (
    <Text testID="probe">
      {[
        favorites.length,
        practiceLog.length,
        profile.displayName,
        reminders.enabled,
        state.world.worldId,
        state.language.language,
      ].join('|')}
    </Text>
  );
}

const Providers = ({ children }: React.PropsWithChildren) => (
  <LanguageProvider>
    <WorldProvider>
      <SettingsProvider>
        <OnboardingProvider>
          <LibraryProvider>{children}</LibraryProvider>
        </OnboardingProvider>
      </SettingsProvider>
    </WorldProvider>
  </LanguageProvider>
);

async function renderAccount() {
  render(
    <Providers>
      <AccountScreen />
      <StateProbe />
    </Providers>
  );
  await waitFor(() => expect(probe().library.loaded).toBe(true));
  await waitFor(() => expect(probe().settings.loaded).toBe(true));
}

async function eraseFromAccount() {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  fireEvent.press(screen.getByRole('button', { name: probe().language.t('account.reset') }));
  const buttons = alert.mock.calls[0][2] as AlertButton[];
  const erase = buttons.find(({ style }) => style === 'destructive');
  await act(async () => {
    await erase?.onPress?.();
  });
  alert.mockRestore();
}

beforeEach(() => {
  mockReplace.mockClear();
  jest.mocked(cancelAll).mockClear();
});

// "Erase my data" cleared storage, but the providers above the screen kept the
// erased practice in memory: it stayed on screen until a cold start, and the
// next favourite or practice wrote it back. The daily reminder kept firing.
test('erasing data clears what the app holds in memory and the scheduled reminder', async () => {
  await renderAccount();
  await act(async () => {
    await probe().library.toggleFavorite('sleep-descent');
    await probe().library.recordPractice({ sessionId: 'sleep-descent', seconds: 600 });
    await probe().settings.setProfile({ displayName: 'Alex' });
    await probe().settings.setReminders({ enabled: true });
    await probe().world.setWorld('forest');
    await probe().language.setLanguage('fr');
  });
  expect(screen.getByTestId('probe')).toHaveTextContent('1|1|Alex|true|forest|fr');

  await eraseFromAccount();

  expect(mockReplace).toHaveBeenCalledWith('/welcome');
  expect(cancelAll).toHaveBeenCalled();
  // Same as a fresh install: the test device speaks English.
  await waitFor(() =>
    expect(screen.getByTestId('probe')).toHaveTextContent('0|0||false|constellation|en')
  );

  // The next write must start from the erased state, not from memory.
  await act(async () => {
    await probe().library.toggleFavorite('dream-threshold');
  });
  const stored = await AsyncStorage.multiGet([StorageKey.favorites, StorageKey.profile]);
  expect(stored[0][1]).not.toContain('sleep-descent');
  expect(stored[0][1]).toContain('dream-threshold');
  expect(stored[1][1]).toBeNull();
});
