/* @jest-environment jsdom */
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';

let mockLucid = true;
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
  Linking: { getInitialURL: jest.fn().mockResolvedValue(null), addEventListener: () => ({ remove: jest.fn() }) },
}));
jest.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: ({ children }: React.PropsWithChildren) => <>{children}</> }));
jest.mock('react-native-edge-to-edge', () => ({ SystemBars: () => null }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-localization', () => ({ useLocales: () => [{ languageCode: 'en' }] }));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn().mockResolvedValue(undefined), hideAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('expo-notifications', () => ({ getLastNotificationResponse: () => null, clearLastNotificationResponse: jest.fn(), addNotificationResponseReceivedListener: (listener: (response: any) => void) => { mockNotificationListener = listener; return { remove: jest.fn() }; } }));
jest.mock('expo-router/react-navigation', () => ({ ThemeProvider: ({ children }: React.PropsWithChildren) => <>{children}</>, DarkTheme: {}, DefaultTheme: {} }));
jest.mock('expo-router', () => {
  const Stack = Object.assign(({ children }: React.PropsWithChildren) => <>{children}</>, {
    Screen: ({ name }: { name: string }) => <div data-testid={`route:${name}`} />,
    Protected: ({ guard, children }: React.PropsWithChildren<{ guard: boolean }>) => guard ? <>{children}</> : null,
  });
  return { Stack, router: { replace: mockReplace, push: jest.fn() }, usePathname: () => mockLucid ? '/lucid' : '/recording', useNavigationContainerRef: () => mockNavigation, useRootNavigationState: () => ({ key: 'root' }) };
});
jest.mock('@/lib/appVariant', () => ({ get isLucidTrainer() { return mockLucid; } }));
jest.mock('@/context/AuthContext', () => ({ AuthProvider: (props: React.PropsWithChildren) => mockChildren(props), useAuth: () => ({ user: mockUser, loading: false, returningGuestBlocked: false }) }));
jest.mock('@/context/OnboardingContext', () => ({ OnboardingProvider: (props: React.PropsWithChildren) => mockChildren(props), useOnboarding: () => ({ loading: false, scope: mockUser ? `user:${mockUser.id}` : 'guest', state: { status: 'completed', pendingRecordingIntent: null } }) }));
jest.mock('@/context/LanguageContext', () => ({ LanguageProvider: (props: React.PropsWithChildren) => mockChildren(props) }));
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
const RootLayout: React.ComponentType = require('@/app/_layout').default;

async function mountStartup() {
  render(<RootLayout />);
  for (let index = 0; index < 8; index += 1) {
    await act(async () => { jest.advanceTimersByTime(100); await Promise.resolve(); });
  }
}

describe('root product composition (real root and DreamsProvider)', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); });
  afterEach(() => { cleanup(); jest.useRealTimers(); });

  it.each([null, { id: 'account-with-journal' }])('keeps Lucid startup outside Journal runtime for user %j', async (user) => {
    mockLucid = true;
    mockUser = user;
    await mountStartup();
    expect(screen.getByTestId('route:lucid')).toBeTruthy();
    expect(screen.queryByTestId('route:recording')).toBeNull();
    expect(screen.queryByTestId('route:journal/[id]')).toBeNull();
    expect(screen.queryByTestId('route:(tabs)')).toBeNull();
    expect(screen.queryByTestId('analysis-host')).toBeNull();
    expect(screen.queryByTestId('reminders-host')).toBeNull();
    expect(screen.queryByTestId('speech-host')).toBeNull();
    expect(mockJournal).not.toHaveBeenCalled();
    expect(mockGuestSession).not.toHaveBeenCalled();
    expect(mockMigration).not.toHaveBeenCalled();
    expect(mockDreamMigration).not.toHaveBeenCalled();
    expect(mockMark).toHaveBeenCalledWith('startup.route_committed');
  });

  it.each(['/weekly-recap', '/journal/42', '/recording'])('ignores legacy %s before accepting a Lucid notification', async (url) => {
    mockLucid = true;
    mockUser = null;
    await mountStartup();
    mockReplace.mockClear();
    const notify = async (route: string) => {
      await act(async () => {
        mockNotificationListener?.({ notification: { request: { identifier: 'same-response', content: { data: { url: route } } } } });
        await Promise.resolve();
      });
      await act(async () => { jest.advanceTimersByTime(100); await Promise.resolve(); });
    };
    await notify(url);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(require('@/services/storageService').savePendingRecordingNotification).not.toHaveBeenCalled();
    await notify('/lucid/morning');
    expect(mockReplace).toHaveBeenCalledWith('/lucid/morning');
  });

  it.each(['/weekly-recap', '/journal/42'])('retains Journal notification routing for %s', async (url) => {
    mockLucid = false;
    mockUser = null;
    await mountStartup();
    mockReplace.mockClear();
    await act(async () => {
      mockNotificationListener?.({ notification: { request: { identifier: 'journal-response', content: { data: { url } } } } });
      await Promise.resolve();
    });
    await act(async () => { jest.advanceTimersByTime(100); await Promise.resolve(); });
    expect(mockReplace).toHaveBeenCalledWith(url);
  });

  it.each([null, { id: 'journal-account' }])('retains Journal provider, routes and hosts for user %j', async (user) => {
    mockLucid = false;
    mockUser = user;
    await mountStartup();
    expect(screen.getByTestId('route:recording')).toBeTruthy();
    expect(screen.getByTestId('route:journal/[id]')).toBeTruthy();
    expect(screen.getByTestId('analysis-host')).toBeTruthy();
    expect(screen.getByTestId('reminders-host')).toBeTruthy();
    expect(screen.getByTestId('speech-host')).toBeTruthy();
    expect(mockJournal).toHaveBeenCalled();
    expect(mockMark).toHaveBeenCalledWith('startup.route_committed');
    expect(mockGuestSession).toHaveBeenCalledTimes(1);
    expect(mockMigration).toHaveBeenCalledTimes(1);
    expect(mockDreamMigration).toHaveBeenCalledTimes(1);
  });
});
