/* @jest-environment jsdom */
import React from 'react';
import { URL as NodeURL } from 'node:url';
import { act, cleanup, render, screen } from '@testing-library/react';

let mockLucid = true;
let mockPathname = '/lucid';
let mockPreferenceLoaded = true;
let mockAuthLoading = false;
const mockInitialUrl = jest.fn().mockResolvedValue(null);
let mockUser: { id: string } | null = null;
// Real DreamsProvider calls this boundary; no Journal pipeline can mount without it.
// This isolates composition, not real network traffic or the hook's own behavior.
const mockJournal = jest.fn(() => ({ dreams: [], loaded: true, persistenceState: {}, activeAnalysis: null }));
const mockMigration = jest.fn().mockResolvedValue(undefined);
const mockDreamMigration = jest.fn().mockResolvedValue(undefined);
const mockMark = jest.fn();
let mockNotificationListener: ((response: any) => void) | undefined;
const mockReplace = jest.fn();
const mockGuestSession = jest.fn();
const mockNavigation = { isReady: () => true, addListener: () => () => undefined };
const mockChildren = ({ children }: React.PropsWithChildren) => <>{children}</>;

jest.mock('@/global.css', () => ({}));
jest.mock('react-native', () => ({
  ...jest.requireActual('../react-native-stub'),
  Platform: { OS: 'ios' },
  LogBox: { ignoreLogs: jest.fn() },
  InteractionManager: { runAfterInteractions: (fn: () => void) => { fn(); return { cancel: jest.fn() }; } },
  Linking: { getInitialURL: () => mockInitialUrl(), addEventListener: () => ({ remove: jest.fn() }) },
}));
jest.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: ({ children }: React.PropsWithChildren) => <>{children}</> }));
jest.mock('react-native-edge-to-edge', () => ({ SystemBars: () => null }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-localization', () => ({ useLocales: () => [{ languageCode: 'en' }] }));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn().mockResolvedValue(undefined), hideAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn(), getLastNotificationResponse: () => null, clearLastNotificationResponse: jest.fn(), addNotificationResponseReceivedListener: (listener: (response: any) => void) => { mockNotificationListener = listener; return { remove: jest.fn() }; } }));
jest.mock('expo-router/react-navigation', () => ({ ThemeProvider: ({ children }: React.PropsWithChildren) => <>{children}</>, DarkTheme: {}, DefaultTheme: {} }));
jest.mock('expo-router', () => {
  const Stack = Object.assign(({ children }: React.PropsWithChildren) => <>{children}</>, {
    Screen: ({ name }: { name: string }) => <div data-testid={`route:${name}`} />,
    Protected: ({ guard, children }: React.PropsWithChildren<{ guard: boolean }>) => guard ? <>{children}</> : null,
  });
  return { Stack, router: { replace: mockReplace, push: jest.fn() }, usePathname: () => mockPathname, useNavigationContainerRef: () => mockNavigation, useRootNavigationState: () => ({ key: 'root' }) };
});
jest.mock('@/lib/appVariant', () => ({ get isLucidTrainer() { return mockLucid; } }));
jest.mock('@/context/AuthContext', () => ({ AuthProvider: (props: React.PropsWithChildren) => mockChildren(props), useAuth: () => ({ user: mockUser, loading: mockAuthLoading, returningGuestBlocked: false }) }));
jest.mock('@/context/OnboardingContext', () => ({ OnboardingProvider: (props: React.PropsWithChildren) => mockChildren(props), useOnboarding: () => ({ loading: false, scope: mockUser ? `user:${mockUser.id}` : 'guest', state: { status: 'completed', pendingRecordingIntent: null } }) }));
jest.mock('@/context/LanguageContext', () => ({ LanguageProvider: (props: React.PropsWithChildren) => mockChildren(props), useLanguage: () => ({ language: 'en', loaded: mockPreferenceLoaded }) }));
jest.mock('@/context/ThemeContext', () => ({ ThemeProvider: (props: React.PropsWithChildren) => mockChildren(props), useTheme: () => ({ mode: 'dark' }) }));
jest.mock('@/context/SubscriptionContext', () => ({ SubscriptionProvider: (props: React.PropsWithChildren) => mockChildren(props) }));
jest.mock('@/hooks/useDreamJournal', () => ({ useDreamJournal: () => mockJournal() }));
jest.mock('@/hooks/useSubscriptionInitialize', () => ({ useSubscriptionInitialize: jest.fn() }));
jest.mock('@/hooks/useAppState', () => ({ useAppState: jest.fn() }));
jest.mock('@/hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => true }));
jest.mock('@/hooks/useSplashFailsafe', () => ({ useSplashFailsafe: () => false }));
jest.mock('@/components/AnimatedSplashScreen', () => ({ __esModule: true, default: () => null, getSplashMinimumVisibleMs: () => 0 }));
jest.mock('@/components/ErrorBoundary', () => ({ ErrorBoundary: (props: React.PropsWithChildren) => mockChildren(props) }));
jest.mock('@/components/analysis/AnalysisFlightIndicator', () => ({ AnalysisFlightIndicator: () => <div data-testid="analysis-host" /> }));
jest.mock('@/components/reminders/EngagementRemindersHost', () => ({ EngagementRemindersHost: () => <div data-testid="reminders-host" /> }));
jest.mock('@/components/speech/OfflineModelPromptHost', () => ({ OfflineModelPromptHost: () => <div data-testid="speech-host" /> }));
jest.mock('@/components/releases/WhatsNewModal', () => ({ WhatsNewModalHost: () => null }));
jest.mock('@/components/VercelAnalytics', () => ({ VercelAnalytics: () => null }));
jest.mock('@/components/VercelSpeedInsights', () => ({ VercelSpeedInsights: () => null }));
jest.mock('@/lib/i18n', () => ({ loadTranslations: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/analytics', () => ({ trackProductEvent: jest.fn() }));
jest.mock('@/lib/productAnalytics', () => ({ setProductAnalyticsLocale: jest.fn() }));
jest.mock('@/lib/performanceTrace', () => ({ markPerformance: (...args: unknown[]) => mockMark(...args) }));
jest.mock('@/lib/guestSession', () => ({ initGuestSession: () => mockGuestSession() }));
jest.mock('@/lib/auth', () => ({ initializeGoogleSignIn: jest.fn() }));
jest.mock('@/services/quota/GuestAnalysisCounter', () => ({ migrateExistingGuestQuota: () => mockMigration() }));
jest.mock('@/services/quota/GuestDreamCounter', () => ({ migrateExistingGuestDreamRecording: () => mockDreamMigration() }));
jest.mock('@/services/notificationService', () => ({ configureNotificationHandler: jest.fn() }));
jest.mock('@/services/storageService', () => ({
  getLanguagePreference: jest.fn().mockResolvedValue('en'),
  getPendingRecordingNotification: jest.fn().mockResolvedValue(null),
  clearPendingRecordingNotification: jest.fn().mockResolvedValue(undefined),
  savePendingRecordingNotification: jest.fn().mockResolvedValue(undefined),
}));


// Root source is checked by typecheck:app (which includes generated CSS declarations).
const RootLayout: React.ComponentType = require('@/components/lucid/LucidRootLayout').default;

async function mountStartup() {
  const view = render(<RootLayout />);
  for (let index = 0; index < 8; index += 1) {
    await act(async () => { jest.advanceTimersByTime(100); await Promise.resolve(); });
  }
  return view;
}

describe('dedicated Lucid composition', () => {
  beforeEach(() => {
    global.URL = NodeURL as unknown as typeof URL;
    jest.useFakeTimers(); jest.clearAllMocks(); mockPathname = '/lucid';
    mockAuthLoading = false; mockPreferenceLoaded = true; mockInitialUrl.mockResolvedValue(null);
  });
  afterEach(() => { cleanup(); jest.useRealTimers(); });

  it.each([null, { id: 'account-with-journal' }])('mounts only Lucid and shared auth for %j', async (user) => {
    mockUser = user;
    await mountStartup();
    expect(screen.getByTestId('route:lucid')).toBeTruthy();
    expect(screen.getByTestId('route:auth/reset-password')).toBeTruthy();
    expect(screen.getByTestId('route:auth/callback')).toBeTruthy();
    expect(screen.queryByTestId('route:recording')).toBeNull();
    expect(mockJournal).not.toHaveBeenCalled();
    expect(mockGuestSession).not.toHaveBeenCalled();
    expect(mockMigration).not.toHaveBeenCalled();
    expect(mockDreamMigration).not.toHaveBeenCalled();
    expect(mockMark).toHaveBeenCalledWith('startup.route_committed');
  });

  it('does not wait indefinitely for preference storage', async () => {
    mockPreferenceLoaded = false;
    await mountStartup();
    expect(screen.getByTestId('route:lucid')).toBeTruthy();
  });

  it('rejects Journal notification targets and deduplicates Lucid response delivery', async () => {
    await mountStartup();
    const response = (url: string, identifier: string) => ({ notification: { request: { identifier, content: { data: { url } } } } });
    await act(async () => { mockNotificationListener?.(response('/recording', 'journal')); });
    expect(mockReplace).not.toHaveBeenCalled();
    await act(async () => { mockNotificationListener?.(response('/lucid/morning', 'morning')); });
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/lucid/morning');
    await act(async () => { mockNotificationListener?.(response('/lucid/morning', 'morning')); });
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('retains notification intent until authentication and destination are ready', async () => {
    mockAuthLoading = true;
    const view = await mountStartup();
    const notifications = require('expo-notifications');
    await act(async () => { mockNotificationListener?.({ notification: { request: { identifier: 'pending', content: { data: { url: '/lucid/morning' } } } } }); });
    expect(mockReplace).not.toHaveBeenCalled();
    expect(notifications.clearLastNotificationResponse).not.toHaveBeenCalled();
    mockAuthLoading = false;
    await act(async () => { view.rerender(<RootLayout />); });
    expect(mockReplace).toHaveBeenCalledWith('/lucid/morning');
    mockPathname = '/lucid/morning';
    await act(async () => { view.rerender(<RootLayout />); });
    expect(notifications.clearLastNotificationResponse).toHaveBeenCalledTimes(1);
  });

  it('commits the protected onboarding destination', async () => {
    mockPathname = '/lucid/onboarding';
    await mountStartup();
    expect(mockMark).toHaveBeenCalledWith('startup.route_committed');
  });

  it('preserves cold auth callback parameters', async () => {
    mockPathname = '/auth/callback';
    mockInitialUrl.mockResolvedValue('noctalia-lucid://auth/callback?code=synthetic');
    await mountStartup();
    expect(mockReplace).toHaveBeenCalledWith('/auth/callback?code=synthetic');
    expect(mockReplace).not.toHaveBeenCalledWith('/lucid');
    expect(mockMark).toHaveBeenCalledWith('startup.route_committed');
  });
});
