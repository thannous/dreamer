/* @jest-environment jsdom */
import React from 'react';
import { URL as NodeURL } from 'node:url';
import { act, cleanup, render, screen } from '@testing-library/react';

let mockLucid = true;
let mockUser: { id: string } | null = null;
let mockPathname = '/recording';
let mockSearchParams: Record<string, string> = {};
let mockAuthReturn: { destination: string; createdAt: number } | null = null;
let mockOnboardingPersisting = false;
let mockOnboardingStatus = 'completed';
let mockOnboardingPath: string | null = null;
const mockCompleteAuthReturn = jest.fn().mockResolvedValue(undefined);
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
  return { Stack, router: { replace: mockReplace, push: jest.fn() }, usePathname: () => mockLucid ? '/lucid' : mockPathname, useGlobalSearchParams: () => mockSearchParams, useNavigationContainerRef: () => mockNavigation, useRootNavigationState: () => ({ key: 'root' }) };
});
jest.mock('@/hooks/useAuthReturnIntent', () => ({ useAuthReturnIntent: () => ({ intent: mockLucid ? null : mockAuthReturn, ready: true }) }));
jest.mock('@/lib/authReturnIntent', () => ({ ...jest.requireActual('@/lib/authReturnIntent'), completeAuthReturn: (...args: unknown[]) => mockCompleteAuthReturn(...args) }));
jest.mock('@/lib/appVariant', () => ({ get isLucidTrainer() { return mockLucid; } }));
jest.mock('@/context/AuthContext', () => ({ AuthProvider: (props: React.PropsWithChildren) => mockChildren(props), useAuth: () => ({ user: mockUser, loading: false, returningGuestBlocked: false }) }));
jest.mock('@/context/OnboardingContext', () => ({ OnboardingProvider: (props: React.PropsWithChildren) => mockChildren(props), useOnboarding: () => ({ loading: false, persisting: mockOnboardingPersisting, scope: mockUser ? `user:${mockUser.id}` : 'guest', state: { status: mockOnboardingStatus, selectedPath: mockOnboardingPath, pendingRecordingIntent: null } }) }));
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
  const view = render(<RootLayout />);
  for (let index = 0; index < 8; index += 1) {
    await act(async () => { jest.advanceTimersByTime(100); await Promise.resolve(); });
  }
  return view;
}

describe('root product composition (real root and DreamsProvider)', () => {
  beforeEach(() => {
    jest.useFakeTimers(); jest.clearAllMocks();
    mockPathname = '/recording'; mockSearchParams = {}; mockAuthReturn = null;
    mockOnboardingPersisting = false; mockOnboardingStatus = 'completed';
    mockOnboardingPath = null;
    Object.defineProperty(globalThis, 'URL', { configurable: true, writable: true, value: NodeURL });
    require('react-native').Linking.getInitialURL.mockResolvedValue(null);
  });
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

  it('resumes a requested dream once after login and acknowledges its full identity', async () => {
    mockLucid = false;
    mockUser = null;
    const view = await mountStartup();
    mockAuthReturn = { destination: '/journal/1700000000000?remoteId=42', createdAt: Date.now() };
    mockPathname = '/settings';
    await act(async () => { view.rerender(<RootLayout />); });
    mockReplace.mockClear();
    expect(mockCompleteAuthReturn).not.toHaveBeenCalled();
    mockUser = { id: 'owner' };
    await act(async () => { view.rerender(<RootLayout />); });
    await act(async () => { jest.advanceTimersByTime(100); });
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(mockAuthReturn.destination);
    mockPathname = '/journal/1700000000000';
    mockSearchParams = { remoteId: '43' };
    await act(async () => { view.rerender(<RootLayout />); });
    expect(mockCompleteAuthReturn).not.toHaveBeenCalled();
    mockSearchParams = { remoteId: '42' };
    await act(async () => { view.rerender(<RootLayout />); });
    expect(mockCompleteAuthReturn).toHaveBeenCalledWith(mockAuthReturn);
    mockAuthReturn = null;
    mockPathname = '/recording';
    await act(async () => { view.rerender(<RootLayout />); jest.advanceTimersByTime(100); });
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('lets an explicit exit from sign-in cancel the pending destination', async () => {
    mockLucid = false;
    mockUser = null;
    const view = await mountStartup();
    mockAuthReturn = { destination: '/dream-chat/42?mode=free', createdAt: Date.now() };
    mockPathname = '/settings';
    await act(async () => { view.rerender(<RootLayout />); });
    mockPathname = '/journal';
    await act(async () => { view.rerender(<RootLayout />); });
    expect(mockCompleteAuthReturn).toHaveBeenCalledTimes(1);
    expect(mockCompleteAuthReturn).toHaveBeenCalledWith(mockAuthReturn);
  });

  it('does not replay an already consumed cold-start link on a later login', async () => {
    mockLucid = false;
    mockUser = null;
    require('react-native').Linking.getInitialURL.mockResolvedValue('noctalia://journal/42');
    const view = await mountStartup();
    expect(mockReplace).toHaveBeenCalledWith('/journal/42');
    mockPathname = '/settings';
    mockReplace.mockClear();
    mockUser = { id: 'new-session' };
    await act(async () => { view.rerender(<RootLayout />); });
    await act(async () => { jest.advanceTimersByTime(100); });
    expect(mockReplace).not.toHaveBeenCalledWith('/journal/42');
  });

  it('waits for confirmed onboarding before resuming, including after a failed write', async () => {
    mockLucid = false;
    mockUser = { id: 'new-owner' };
    mockAuthReturn = { destination: '/journal/42', createdAt: Date.now() };
    mockOnboardingStatus = 'in_progress';
    mockPathname = '/onboarding';
    const view = await mountStartup();
    mockReplace.mockClear();
    mockOnboardingStatus = 'completed'; // optimistic state before the write
    mockOnboardingPersisting = true;
    await act(async () => { view.rerender(<RootLayout />); jest.advanceTimersByTime(100); });
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockCompleteAuthReturn).not.toHaveBeenCalled();
    mockOnboardingStatus = 'in_progress'; // failed write rolled back
    mockOnboardingPersisting = false;
    await act(async () => { view.rerender(<RootLayout />); jest.advanceTimersByTime(100); });
    expect(mockReplace).not.toHaveBeenCalledWith('/journal/42');
    mockOnboardingStatus = 'completed';
    await act(async () => { view.rerender(<RootLayout />); });
    await act(async () => { jest.advanceTimersByTime(100); });
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/journal/42');
  });

  it.each(['completed', 'skipped'])('finishes %s onboarding normally if its delegated auth return expires during persistence', async (status: string) => {
    mockLucid = false;
    mockUser = { id: 'new-owner' };
    mockAuthReturn = { destination: '/journal/42', createdAt: Date.now() };
    mockOnboardingStatus = 'in_progress';
    mockOnboardingPath = 'dictionary';
    mockPathname = '/onboarding';
    const view = await mountStartup();
    mockReplace.mockClear();
    mockOnboardingStatus = status;
    mockOnboardingPersisting = true;
    await act(async () => { view.rerender(<RootLayout />); });
    mockAuthReturn = null; // expires while the optimistic completion is saving
    await act(async () => { view.rerender(<RootLayout />); jest.advanceTimersByTime(100); });
    expect(mockReplace).not.toHaveBeenCalled();
    mockOnboardingPersisting = false;
    await act(async () => { view.rerender(<RootLayout />); });
    await act(async () => { jest.advanceTimersByTime(100); });
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(status === 'completed'
      ? { pathname: '/symbol-dictionary', params: { source: 'onboarding' } }
      : '/recording');
  });
});
