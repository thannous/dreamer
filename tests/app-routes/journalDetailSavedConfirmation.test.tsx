/* @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render as renderTree, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { PendingRecordingIntent } from '@/lib/onboardingState';
import type { DreamAnalysis } from '@/lib/types';
import { requestAnalysisReturnRoute } from '@/lib/paywallRoute';
import { trackInitialDreamCategorization } from '@/lib/initialDreamCategorization';
import { TID } from '@/lib/testIDs';

// Static hook fixtures need an actual context notification across a memo boundary.
const mockMarkPerformance = jest.fn();
jest.mock('@/lib/storeReview', () => ({
  canOpenStoreReviewPage: () => false,
  markStoreReviewPaywallSeen: jest.fn(),
  openStoreReviewPage: jest.fn(),
  recordStoreReviewAnalysisRead: jest.fn(async () => undefined),
  requestStoreReviewIfDue: jest.fn(async () => false),
}));
jest.mock('@/lib/performanceTrace', () => ({
  markPerformance: (...args: unknown[]) => mockMarkPerformance(...args),
  performanceTraceId: () => 1,
  markPerformanceAfterFrames: () => () => undefined,
}));
const mockRenderContext = React.createContext({});
const render = (ui: React.ReactElement) => renderTree(ui, { wrapper: ({ children }) => (
  <mockRenderContext.Provider value={{}}>{children}</mockRenderContext.Provider>
) });

let mockPendingRecordingIntent: Partial<PendingRecordingIntent> | null = null;
const mockTransitionOnboarding = jest.fn(async () => undefined);
let mockMedia: any = null;
let mockQuotaUsage: any = { analysis: { used: 0, limit: 3, remaining: 3 } };
let mockQuotaStatus: { isUpgraded?: boolean; canAnalyze?: boolean; guestBootstrapStatus?: string } | null = null;
let mockCanAnalyzeNow = true;
let mockQuotaLoading = false;
const mockCanAnalyze = jest.fn(async () => true);
let mockTier: 'guest' | 'free' | 'plus' = 'free';
let mockUser: { id: string } | null = { id: 'user-1' };
const mockUpdateDream = jest.fn();
const mockRetryDreamSync = jest.fn(async (): Promise<void> => undefined);
let mockCompositeLoads: boolean | null = true;
const mockCompositeEvents: {
  source: string;
  load: () => void;
  display: () => void;
  report: (source: string, ready: boolean) => void;
}[] = [];
const mockAnnounceForAccessibility = jest.fn();
let mockThemeMode: 'light' | 'dark' = 'dark';
const mockRetryMedia = jest.fn();
const mockShareComposite = jest.fn();
const mockShareImageRef: { current: HTMLDivElement | null } = { current: null };
const mockHasAiConsent = jest.fn(async () => true);
const mockRequestAiConsent = jest.fn(async () => true);
jest.mock('@/lib/aiConsent', () => ({
  hasAiConsent: (...args: unknown[]) => mockHasAiConsent(...args),
  requestAiConsent: (...args: unknown[]) => mockRequestAiConsent(...args),
}));

jest.mock('@/components/ui/MarkdownText', () => ({ MarkdownText: ({ children }: { children: string }) => <span>{children}</span> }));

jest.mock('@/hooks/useDreamMedia', () => ({ useDreamMedia: (dream: any) => mockMedia ?? ({ imageUrl: dream?.imageUrl ?? '', thumbnailUrl: dream?.thumbnailUrl, loading: false, error: false, retry: mockRetryMedia }) }));

const mockToggleFavorite = jest.fn();
const mockAnalyzeDream = jest.fn();
const mockDeleteDream = jest.fn();
const mockSetParams = jest.fn();
let mockSearchParams: { id: string; remoteId?: string; clientRequestId?: string; saved?: string | string[]; recall?: string | string[]; autoAnalyze?: string; analyzeAfterPurchase?: string; analysisOwnerId?: string; share?: string } = { id: '42', saved: '1' };
const mockCategorizeDream = jest.fn();
const mockApplyDreamCategorization = jest.fn(async (_dream: unknown, _result: unknown) => undefined);
let mockDreams: DreamAnalysis[] = [];

const buildDream = (overrides: Partial<DreamAnalysis> = {}): DreamAnalysis => ({
  id: 42,
  transcript: 'I flew over a quiet city with a blue door.',
  title: 'Blue Door',
  interpretation: '',
  shareableQuote: '',
  imageUrl: '',
  dreamType: 'Symbolic Dream',
  theme: 'calm',
  isAnalyzed: false,
  analysisStatus: 'none',
  chatHistory: [],
  clientRequestId: 'persisted-original-42',
  ...overrides,
});

jest.mock('react-native', () => {
  const React = require('react');
  const toDomProps = (props: Record<string, any>) => {
    const {
      testID,
      onPress,
      accessibilityRole,
      accessibilityLabel,
      accessibilityState: _accessibilityState,
      accessibilityHint: _accessibilityHint,
      hitSlop: _hitSlop,
      pointerEvents: _pointerEvents,
      onLayout: _onLayout,
      contentContainerStyle: _contentContainerStyle,
      keyboardShouldPersistTaps: _keyboardShouldPersistTaps,
      scrollEventThrottle: _scrollEventThrottle,
      onScrollBeginDrag: _onScrollBeginDrag,
      onScrollEndDrag: _onScrollEndDrag,
      onMomentumScrollBegin: _onMomentumScrollBegin,
      onMomentumScrollEnd: _onMomentumScrollEnd,
      showsHorizontalScrollIndicator: _showsHorizontalScrollIndicator,
      showsVerticalScrollIndicator: _showsVerticalScrollIndicator,
      horizontal: _horizontal,
      numberOfLines: _numberOfLines,
      onChangeText,
      style,
      className,
      ...rest
    } = props;
    return {
      ...rest,
      ...(className ? { className } : {}),
      ...(style ? { style } : {}),
      ...(testID ? { 'data-testid': testID } : {}),
      ...(onPress ? { onClick: onPress } : {}),
      ...(onChangeText ? { onChange: (event: { target: { value: string } }) => onChangeText(event.target.value) } : {}),
      ...(accessibilityRole ? { role: accessibilityRole } : {}),
      ...(accessibilityLabel ? { 'aria-label': accessibilityLabel } : {}),
    };
  };
  const createElement = (tag: string) => {
    const MockNativeElement = React.forwardRef(
      (
        { children, ...props }: { children?: React.ReactNode; [key: string]: any },
        ref: React.ForwardedRef<HTMLElement>
      ) => React.createElement(tag, { ...toDomProps(props), ref }, children)
    );
    MockNativeElement.displayName = `MockNative${tag}`;
    return MockNativeElement;
  };

  return {
    __esModule: true,
    AccessibilityInfo: { announceForAccessibility: mockAnnounceForAccessibility },
    ActivityIndicator: () => <div role="progressbar" />,
    Alert: { alert: jest.fn() },
    Keyboard: {
      addListener: () => ({ remove: jest.fn() }),
      dismiss: jest.fn(),
    },
    KeyboardAvoidingView: createElement('div'),
    Modal: ({ visible, children }: { visible?: boolean; children?: React.ReactNode }) =>
      visible ? <div>{children}</div> : null,
    Platform: {
      OS: 'web',
      select: (values: Record<string, any>) => values?.web ?? values?.default,
    },
    Pressable: createElement('button'),
    ScrollView: createElement('div'),
    Share: { share: jest.fn() },
    StyleSheet: {
      absoluteFill: {},
      create: <T extends Record<string, any>>(styles: T) => styles,
      hairlineWidth: 1,
    },
    Image: createElement('img'),
    Text: createElement('span'),
    TextInput: createElement('input'),
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }),
    View: createElement('div'),
  };
});

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    canGoBack: () => false,
    push: jest.fn(),
    replace: jest.fn(),
    dismissTo: jest.fn(),
    setParams: mockSetParams,
  },
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(async () => undefined),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

jest.mock('expo-image', () => ({
  Image: () => null,
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// This route fixture replaces React Native entirely; keep Expo's asset-native
// initialization outside the saved-dream interaction being exercised here.
jest.mock('expo-asset', () => ({ Asset: {
  fromModule: (source: unknown) => ({ uri: typeof source === 'string' ? source : 'file:///bundled-test-artwork.webp' }),
} }));

jest.mock('@/components/analysis/AnalysisReadingModal', () => ({
  AnalysisReadingModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="analysis.reading.modal"><button onClick={onClose}>Close reading</button></div>
  ),
}));

jest.mock('@/components/Toast', () => ({
  Toast: ({ message, testID }: { message: string; testID?: string }) => (
    <div data-testid={testID}>{message}</div>
  ),
}));

jest.mock('@/components/motion', () => ({
  PressableScale: ({
    accessibilityLabel,
    accessibilityRole,
    children,
    className,
    onPress,
    disabled,
    testID,
  }: {
    accessibilityLabel?: string;
    accessibilityRole?: string;
    children?: React.ReactNode;
    className?: string;
    onPress?: () => void;
    disabled?: boolean;
    testID?: string;
  }) => (
    <button
      aria-label={accessibilityLabel}
      className={className}
      data-testid={testID}
      onClick={onPress}
      disabled={disabled}
      role={accessibilityRole}
      type="button"
    >
      {children}
    </button>
  ),
  Reveal: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/inspiration/AtmosphericBackground', () => ({
  AtmosphericBackground: () => null,
}));

// The page's paper grain is decorative art; these journeys only need the page.
jest.mock('@/components/journal/JournalPaper', () => ({ JournalPaper: () => null }));
// The prepared analysis has its own tests; this page's saved moment never shows it.
jest.mock('@/components/journal/AnalysisPreviewCard', () => ({ AnalysisPreviewCard: () => null }));
// Leafing through the journal is a gesture around the page; these journeys only need the page.
jest.mock('@/components/journal/JournalPageTurner', () => ({
  JournalPageTurner: ({ children, newer, older, onTurn }: {
    children: React.ReactNode; newer: DreamAnalysis | null; older: DreamAnalysis | null;
    onTurn: (dream: DreamAnalysis) => void;
  }) => <>{children}
    {newer ? <button data-testid="test.page.newer" onClick={() => onTurn(newer)}>Newer</button> : null}
    {older ? <button data-testid="test.page.older" onClick={() => onTurn(older)}>Older</button> : null}
  </>,
  // A phone's single page: the reading's page is the whole screen.
  JournalSpreadLeaf: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useJournalPageTurnLock: () => {},
  useJournalPageLaidOut: () => () => {},
  useJournalPageTurnedTo: () => false,
}));

jest.mock('@/components/inspiration/GlassCard', () => ({
  FlatGlassCard: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/journal/DreamShareImage', () => ({
  DreamShareImage: require('react').forwardRef(function MockDreamShareImage(
    { resolvedMedia, onMediaReady, options }: any,
    ref: React.ForwardedRef<HTMLDivElement>
  ) {
    require('react').useEffect(() => {
      // A card without a picture is ready as soon as it is drawn.
      if (!resolvedMedia?.imageUrl) { onMediaReady('', false); return; }
      const source = resolvedMedia.imageUrl;
      mockCompositeEvents.push({
        source,
        load: () => undefined,
        display: () => onMediaReady(source, true),
        report: onMediaReady,
      });
      if (mockCompositeLoads !== null) onMediaReady(resolvedMedia.imageUrl, mockCompositeLoads);
    }, [resolvedMedia?.imageUrl, onMediaReady]);
    return <div ref={ref} data-testid="share-composite" data-text={options?.text} data-painting={String(options?.painting)} />;
  }),
}));

// The composer as the screen drives it: what it offers and what the dreamer picks.
jest.mock('@/components/journal/DreamShareSheet', () => ({
  DreamShareSheet: ({ visible, onShare, onClose, painting, paintingPending, capturing }: any) => visible ? (
    <div data-testid="sheet.dreamShare" data-painting={painting} data-painting-pending={String(paintingPending)}
      data-capturing={String(capturing)}>
      <button data-testid="btn.dream.shareCard" onClick={() => onShare({ painting: true, title: true, date: true, text: 'quote' })}>Share the card</button>
      <button onClick={() => onShare({ painting: false, title: true, date: false, text: 'story' })}>Share my story without the illustration</button>
      <button onClick={onClose}>Close the composer</button>
    </div>
  ) : null,
}));

jest.mock('@/components/journal/ImageRetry', () => ({
  ImageRetry: ({ onRetry }: { onRetry: () => void }) => <button onClick={onRetry}>Retry illustration</button>,
}));

jest.mock('@/components/journal/JournalDetailSheets', () => ({
  SavedDreamAnalysisSheet: ({ visible, onClose, onPrimary, action }: any) => visible ? (
    <div data-testid="sheet.savedDreamAnalysis">
      <button disabled={action === 'checking'} onClick={onPrimary}>{action === 'upgrade' ? 'Discover Plus' : action === 'signup' ? 'Create account' : action === 'login' ? 'Sign in' : 'Analyze saved dream'}</button>
      <button onClick={onClose}>Later</button>
      <button onClick={onClose}>Dismiss offer</button>
    </div>
  ) : null,
  AnalysisNoticeSheet: ({ visible, notice, onRetry }: any) => visible ? <div role="alert">{notice.message}{notice.retryable && <button onClick={onRetry}>Notice retry</button>}</div> : null,
  DeleteConfirmSheet: ({ visible, onConfirm }: any) => visible ? <button onClick={onConfirm}>Confirm delete</button> : null,
  ImageErrorSheet: () => null,
  QuotaLimitSheet: ({ visible }: any) => visible ? <div data-testid="quota-limit" /> : null,
  ReanalyzeSheet: ({ visible }: { visible: boolean }) => visible ? <div>journal.detail.reanalyze_prompt.title</div> : null,
  ReplaceImageSheet: () => null,
}));

jest.mock('@/components/journal/DreamRecallAssistantCard', () => ({
  DreamRecallAssistantCard: ({
    dreamId,
    offerEligible,
    startRequested,
  }: {
    dreamId?: string;
    offerEligible?: boolean;
    startRequested?: boolean;
  }) =>
    offerEligible ? (
      <div data-testid="component.dreamRecall.offer" data-dream-id={dreamId} data-start-requested={String(Boolean(startRequested))}>
        <button data-testid="btn.dreamRecall.start" type="button">
          Continuer
        </button>
      </div>
    ) : null,
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: () => null,
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock('@/context/DreamsContext', () => ({
  useDreamsData: () => ({
    dreams: mockDreams,
    toggleFavorite: mockToggleFavorite,
    updateDream: mockUpdateDream,
    deleteDream: mockDeleteDream,
    retryDreamSync: mockRetryDreamSync,
    resolveDreamConflict: jest.fn(),
    generateDreamImage: jest.fn(),
    analyzeDream: mockAnalyzeDream,
  }),
  useDreamsActions: () => ({
    applyDreamCategorization: mockApplyDreamCategorization,
    dreams: mockDreams,
    toggleFavorite: mockToggleFavorite,
    updateDream: mockUpdateDream,
    deleteDream: mockDeleteDream,
    retryDreamSync: mockRetryDreamSync,
    resolveDreamConflict: jest.fn(),
    generateDreamImage: jest.fn(),
    analyzeDream: mockAnalyzeDream,
  }),
}));

jest.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({ language: 'fr' }),
}));

jest.mock('@/context/OnboardingContext', () => ({
  useOnboarding: () => ({
    state: {
      pendingRecordingIntent: mockPendingRecordingIntent,
      completionReason: null,
    },
    transition: mockTransitionOnboarding,
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    mode: mockThemeMode,
    colors: {
      accent: '#6f62b5',
      accentText: '#55479c',
      accentDark: '#55479c',
      accentLight: '#988de0',
      backgroundCard: '#221b3b',
      backgroundSecondary: '#2f274f',
      backgroundDark: '#0b0a12',
      divider: '#3a3357',
      overlay: 'rgba(0,0,0,.4)',
      textPrimary: '#fff',
      textSecondary: '#c7c2d7',
      textTertiary: '#9a93b4',
      textOnAccentSurface: '#fff',
      navbarBg: '#0b0a12',
      navbarBorder: '#3a3357',
      navbarTextActive: '#fff',
      navbarTextInactive: '#9a93b4',
    },
    shadows: { xl: {}, lg: {}, md: {}, sm: {} },
  }),
}));

jest.mock('@/hooks/useClearWebFocus', () => ({
  useClearWebFocus: () => {},
}));

jest.mock('@/hooks/useDreamShareComposite', () => ({
  useDreamShareComposite: () => ({
    shareImageRef: mockShareImageRef,
    shareComposite: mockShareComposite,
    isGenerating: false,
  }),
}));

jest.mock('@/hooks/useLocaleFormatting', () => ({
  useLocaleFormatting: () => ({
    formatDreamDate: () => '3 sept.',
    formatDreamTime: () => '07:12',
    formatDreamStamp: () => '3 septembre 2026 · 07:12',
    formatNumber: (value: number) => value.toLocaleString('en-US'),
  }),
}));

jest.mock('@/hooks/useQuota', () => ({
  useQuota: () => {
    require('react').useContext(mockRenderContext);
    return ({
    canAnalyzeNow: mockCanAnalyzeNow,
    canAnalyze: mockCanAnalyze,
    canGenerateImageNow: true,
    tier: mockTier,
    usage: mockQuotaUsage,
    loading: mockQuotaLoading,
    quotaStatus: mockQuotaStatus ? { tier: mockTier, usage: mockQuotaUsage, canAnalyze: (mockQuotaUsage?.analysis.remaining ?? 1) > 0, ...mockQuotaStatus }
      : mockCanAnalyzeNow && mockQuotaUsage ? { tier: mockTier, usage: mockQuotaUsage, canAnalyze: true } : null,
  }); },
}));

jest.mock('@/hooks/useScrollIdle', () => ({
  useScrollIdle: () => ({
    isScrolling: false,
    onScrollBeginDrag: () => {},
    onScrollEndDrag: () => {},
    onMomentumScrollBegin: () => {},
    onMomentumScrollEnd: () => {},
  }),
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/lib/env', () => ({
  isMockModeEnabled: () => false,
}));

const mockTrackProductEvent = jest.fn();
jest.mock('@/lib/analytics', () => ({
  trackProductEvent: (...args: unknown[]) => mockTrackProductEvent(...args),
}));

jest.mock('@/services/geminiService', () => ({
  categorizeDream: (...args: unknown[]) => mockCategorizeDream(...args),
}));

const mockOpenContactMail = jest.fn(async (_options: { subject?: string; body?: string }) => undefined);
jest.mock('@/lib/contact', () => ({
  CONTACT_EMAIL: 'contact@noctalia.app',
  openContactMail: (options: { subject?: string; body?: string }) => mockOpenContactMail(options),
}));

const { default: JournalDetailScreen } = require('@/app/journal/[id]');

describe('journal detail saved confirmation route', () => {
  beforeEach(() => {
    mockAnnounceForAccessibility.mockClear();
    mockThemeMode = 'dark';
    mockCategorizeDream.mockReset();
    mockHasAiConsent.mockReset();
    mockHasAiConsent.mockResolvedValue(true);
    mockRequestAiConsent.mockReset();
    mockRequestAiConsent.mockResolvedValue(true);
    mockApplyDreamCategorization.mockClear();
    mockSetParams.mockReset();
    mockAnalyzeDream.mockReset();
    mockTrackProductEvent.mockReset();
    mockCanAnalyzeNow = true;
    mockQuotaLoading = false;
    require('expo-router').router.push.mockClear();
    mockCanAnalyze.mockReset().mockResolvedValue(true);
    mockUser = { id: 'user-1' };
    mockQuotaStatus = null;
    mockPendingRecordingIntent = null;
    mockTransitionOnboarding.mockClear();
    mockMedia = null;
    mockQuotaUsage = { analysis: { used: 0, limit: 3, remaining: 3 } };
    mockTier = 'free';
    mockUpdateDream.mockClear();
    mockRetryDreamSync.mockReset();
    mockRetryMedia.mockReset();
    mockShareComposite.mockReset();
    mockShareImageRef.current = null;
    mockCompositeEvents.length = 0;
    mockCompositeLoads = true;
    require('react-native').Platform.OS = 'web';
    require('react-native').Share.share.mockClear();
    mockSearchParams = { id: '42', saved: '1' };
    mockDreams = [buildDream()];
  });

  afterEach(() => {
    cleanup();
  });

  it('starts one analysis and image for a newly saved guest dream with both credits', async () => {
    mockUser = null;
    mockTier = 'guest';
    mockQuotaUsage = {
      analysis: { used: 0, limit: 2, remaining: 2 },
      image: { used: 0, limit: 2, remaining: 2 },
    };
    mockSearchParams = { id: '42', saved: '1', autoAnalyze: '1' };
    mockPendingRecordingIntent = { savedDreamId: 42, phase: 'analysis_confirmation' };
    const view = render(<JournalDetailScreen />);
    await waitFor(() => expect(mockAnalyzeDream).toHaveBeenCalledWith(mockDreams[0], mockDreams[0].transcript, {
      replaceExistingImage: true, lang: 'fr', analyticsSource: 'journal_detail',
    }));
    expect(mockTransitionOnboarding).toHaveBeenCalledWith({
      type: 'SET_PENDING_PHASE', phase: 'analysis_requested', savedDreamId: 42,
    });
    view.rerender(<JournalDetailScreen />);
    expect(mockAnalyzeDream).toHaveBeenCalledTimes(1);
  });

  it('waits for guest quota recovery before starting the saved dream demo', async () => {
    mockUser = null;
    mockTier = 'guest';
    mockQuotaUsage = {
      analysis: { used: 0, limit: 2, remaining: 2 },
      image: { used: 0, limit: 2, remaining: 2 },
    };
    mockQuotaStatus = { canAnalyze: false, guestBootstrapStatus: 'degraded' };
    mockSearchParams = { id: '42', saved: '1', autoAnalyze: '1' };
    const view = render(<JournalDetailScreen />);
    expect(mockAnalyzeDream).not.toHaveBeenCalled();

    mockQuotaStatus = { canAnalyze: true, guestBootstrapStatus: 'ready' };
    view.rerender(<JournalDetailScreen />);
    await waitFor(() => expect(mockAnalyzeDream).toHaveBeenCalledTimes(1));
    expect(mockAnalyzeDream).toHaveBeenCalledWith(mockDreams[0], mockDreams[0].transcript, {
      replaceExistingImage: true, lang: 'fr', analyticsSource: 'journal_detail',
    });
  });

  it.each([
    { label: 'signed in', setup: () => { mockUser = { id: 'user-1' }; mockTier = 'free'; } },
    { label: 'a guest without illustration credits', setup: () => { mockQuotaUsage.image = { used: 2, limit: 2, remaining: 0 }; } },
  ])('analyses on arrival, without illustration, when the reader said yes in the journal: $label', async ({ setup }: { setup: () => void }) => {
    mockUser = null;
    mockTier = 'guest';
    mockQuotaUsage = {
      analysis: { used: 1, limit: 2, remaining: 1 },
      image: { used: 0, limit: 2, remaining: 2 },
    };
    mockSearchParams = { id: '42', saved: '1', autoAnalyze: '1' };
    setup();
    await act(async () => { render(<JournalDetailScreen />); });
    await waitFor(() => expect(mockAnalyzeDream).toHaveBeenCalledTimes(1));
    expect(mockAnalyzeDream).toHaveBeenCalledWith(mockDreams[0], mockDreams[0].transcript, {
      replaceExistingImage: false, lang: 'fr', analyticsSource: 'journal_detail',
    });
  });

  it.each([
    { label: 'analysis credits exhausted', setup: () => { mockQuotaStatus = { canAnalyze: false }; } },
    { label: 'already pending', setup: () => { mockDreams = [buildDream({ analysisStatus: 'pending' })]; } },
    { label: 'recall requested', setup: () => { mockSearchParams.recall = '1'; } },
  ])('does not start the analysis asked for in the journal when $label', async ({ setup }: { setup: () => void }) => {
    mockUser = null;
    mockTier = 'guest';
    mockQuotaUsage = {
      analysis: { used: 0, limit: 2, remaining: 2 },
      image: { used: 0, limit: 2, remaining: 2 },
    };
    mockSearchParams = { id: '42', saved: '1', autoAnalyze: '1' };
    setup();
    await act(async () => { render(<JournalDetailScreen />); });
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
  });

  it('offers analysis after save without launching it until accepted', async () => {
    render(<JournalDetailScreen />);
    expect(screen.queryByTestId(TID.Sheet.SavedDreamAnalysis)).toBeNull();
    expect(screen.getByTestId('btn.savedDream.returnToJournal')).toBeTruthy();
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.DreamDetailPrimaryCta)); });
    expect(mockAnalyzeDream).toHaveBeenCalledTimes(1);
    expect(mockAnalyzeDream).toHaveBeenCalledWith(mockDreams[0], mockDreams[0].transcript, {
      replaceExistingImage: false, lang: 'fr', analyticsSource: 'journal_detail',
    });
    expect(screen.queryByTestId(TID.Sheet.SavedDreamAnalysis)).toBeNull();
    expect(mockTransitionOnboarding).not.toHaveBeenCalled();
  });

  // Web E2E cannot observe this: the browser's confirm() blocks the page while it is open.
  it('shows no analysis in progress while AI consent is still being asked', async () => {
    let answer: (granted: boolean) => void = () => {};
    mockRequestAiConsent.mockImplementationOnce(() => new Promise<boolean>((resolve) => { answer = resolve; }));
    render(<JournalDetailScreen />);
    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.DreamDetailPrimaryCta)); });
    expect(mockRequestAiConsent).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('loading.analyzing')).toBeNull();
    await act(async () => { answer(false); });
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    expect(screen.queryByText('loading.analyzing')).toBeNull();
    expect(screen.getByTestId(TID.Button.DreamDetailPrimaryCta)).toBeTruthy();
  });

  it('keeps the analysis offer in place while allowances load', () => {
    mockQuotaLoading = true;
    mockQuotaUsage = undefined;
    const view = render(<JournalDetailScreen />);
    // The saved moment may omit the default message, so absence must stay absence too.
    const actionMessage = () => screen.queryByTestId(TID.Text.DreamDetailActionMessage)?.textContent ?? null;
    const primaryCta = () => screen.getByTestId(TID.Button.DreamDetailPrimaryCta).textContent;
    const loadingMessage = actionMessage();
    const loadingCta = primaryCta();
    expect(loadingCta).not.toContain('journal.detail.check_analysis');
    mockQuotaLoading = false;
    mockQuotaUsage = { analysis: { used: 1, limit: 3, remaining: 2 } };
    view.rerender(<JournalDetailScreen />);
    expect(actionMessage()).toBe(loadingMessage);
    expect(primaryCta()).toBe(loadingCta);
  });

  it('does not start a second categorization for a saved guest dream', () => {
    mockUser = null;
    mockTier = 'guest';
    mockDreams = [buildDream({ hasPerson: undefined, hasAnimal: undefined })];
    render(<JournalDetailScreen />);
    expect(mockCategorizeDream).not.toHaveBeenCalled();
  });

  it('waits for the first categorization before offering metadata recovery', async () => {
    const transcript = 'A blue door above the sea.';
    mockDreams = [buildDream({ transcript, title: transcript, theme: undefined })];
    let finish!: () => void;
    const pendingResult = new Promise<void>((resolve) => { finish = resolve; });
    const initial = trackInitialDreamCategorization('client:persisted-original-42',
      () => pendingResult);
    render(<JournalDetailScreen />);
    expect(screen.getByText('journal.detail.metadata.loading')).toBeTruthy();
    expect(screen.queryByTestId('dream-metadata-retry')).toBeNull();
    expect(mockCategorizeDream).not.toHaveBeenCalled();

    await act(async () => { finish(); await initial; });
    // Offered while editing the page, not on the page as read, which keeps its lines.
    expect(screen.queryByTestId('dream-metadata-retry')).toBeNull();
    fireEvent.click(screen.getByTestId(TID.Button.EditDream));
    expect(screen.getByTestId('dream-metadata-retry')).toBeTruthy();
  });

  it('recovers generated metadata on request without spending an analysis or opening quota sheets', async () => {
    mockUser = null;
    mockTier = 'guest';
    mockQuotaStatus = { canAnalyze: false };
    mockQuotaUsage = { analysis: { used: 2, limit: 2, remaining: 0 } };
    const transcript = 'A blue door above the sea.';
    mockDreams = [buildDream({ transcript, title: transcript, theme: undefined })];
    const metadata = { title: 'The blue doorway', theme: 'calm', dreamType: 'Symbolic Dream', hasPerson: false, hasAnimal: false };
    mockCategorizeDream.mockImplementationOnce(async () => metadata);
    mockApplyDreamCategorization.mockImplementationOnce(async (named: any) => ({ ...named, ...metadata }));
    render(<JournalDetailScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.EditDream));

    await act(async () => { fireEvent.click(screen.getByTestId('dream-metadata-retry')); });

    expect(mockCategorizeDream).toHaveBeenCalledWith(transcript, 'fr');
    expect(mockApplyDreamCategorization).toHaveBeenCalledWith(mockDreams[0], metadata);
    // The fields being edited take the new name, so saving keeps it.
    expect((screen.getByTestId(TID.Input.DreamTitle) as HTMLInputElement).value).toBe('The blue doorway');
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    expect(screen.queryByTestId('quota-limit')).toBeNull();
    expect(require('expo-router').router.push).not.toHaveBeenCalled();
  });

  it('keeps a failed metadata retry recoverable without changing the saved story', async () => {
    const transcript = 'A blue door above the sea.';
    mockDreams = [buildDream({ transcript, title: transcript, theme: undefined })];
    mockCategorizeDream.mockImplementationOnce(async () => { throw new Error('offline'); });
    render(<JournalDetailScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.EditDream));

    await act(async () => { fireEvent.click(screen.getByTestId('dream-metadata-retry')); });

    expect(screen.getByRole('alert').textContent).toBe('journal.detail.metadata.error');
    expect(mockApplyDreamCategorization).not.toHaveBeenCalled();
    expect(mockUpdateDream).not.toHaveBeenCalled();
    expect((screen.getByTestId('dream-metadata-retry') as HTMLButtonElement).disabled).toBe(false);
  });

  it('does not replace a title edited while metadata recovery is pending', async () => {
    const transcript = 'A blue door above the sea.';
    mockDreams = [buildDream({ transcript, title: transcript, theme: undefined })];
    let finish!: (value: unknown) => void;
    mockCategorizeDream.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const view = render(<JournalDetailScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.EditDream));
    fireEvent.click(screen.getByTestId('dream-metadata-retry'));
    mockDreams = [buildDream({ transcript, title: 'My chosen title', theme: undefined })];
    view.rerender(<JournalDetailScreen />);

    await act(async () => { finish({ title: 'Generated title', theme: 'calm', dreamType: 'Symbolic Dream' }); });

    expect(mockApplyDreamCategorization).not.toHaveBeenCalled();
    expect((screen.getByTestId(TID.Input.DreamTitle) as HTMLInputElement).value).not.toBe('Generated title');
  });

  
  it('keeps a title typed in the editor while its name is being found', async () => {
    const transcript = 'A blue door above the sea.';
    mockDreams = [buildDream({ transcript, title: transcript, theme: undefined })];
    const metadata = { title: 'Generated title', theme: 'calm', dreamType: 'Symbolic Dream', hasPerson: false, hasAnimal: false };
    let finish!: (value: unknown) => void;
    mockCategorizeDream.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    mockApplyDreamCategorization.mockImplementationOnce(async (named: any) => ({ ...named, ...metadata }));
    render(<JournalDetailScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.EditDream));
    await act(async () => { fireEvent.click(screen.getByTestId('dream-metadata-retry')); });
    fireEvent.change(screen.getByTestId(TID.Input.DreamTitle), { target: { value: 'My own name' } });

    await act(async () => { finish(metadata); });

    expect(mockApplyDreamCategorization).toHaveBeenCalled();
    expect((screen.getByTestId(TID.Input.DreamTitle) as HTMLInputElement).value).toBe('My own name');
  });

  it('does not recover metadata when the user declines AI consent', async () => {
    mockRequestAiConsent.mockResolvedValue(false);
    const transcript = 'A blue door above the sea.';
    mockDreams = [buildDream({ transcript, title: transcript, theme: undefined })];
    render(<JournalDetailScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.EditDream));
    await act(async () => { fireEvent.click(screen.getByTestId('dream-metadata-retry')); });
    expect(mockRequestAiConsent).toHaveBeenCalled();
    expect(mockCategorizeDream).not.toHaveBeenCalled();
    expect(mockApplyDreamCategorization).not.toHaveBeenCalled();
  });

  it('never redirects from the detail when an exhausted quota becomes known', async () => {
    mockQuotaLoading = true;
    mockQuotaUsage = undefined;
    const view = render(<JournalDetailScreen />);
    expect(screen.queryByTestId(TID.Sheet.SavedDreamAnalysis)).toBeNull();
    mockQuotaLoading = false;
    mockCanAnalyzeNow = false;
    mockQuotaUsage = { analysis: { used: 3, limit: 3, remaining: 0 } };
    mockQuotaStatus = { canAnalyze: false };
    view.rerender(<JournalDetailScreen />);
    expect(require('expo-router').router.push).not.toHaveBeenCalled();
    expect(screen.getByTestId(TID.Button.DreamDetailPrimaryCta)).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.DreamDetailPrimaryCta)); });
    expect(require('expo-router').router.push).toHaveBeenCalledTimes(1);
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    expect(mockUpdateDream).not.toHaveBeenCalled();
  });

  it('does not advertise analysis or sell an upgrade for degraded guest access with remaining credits', async () => {
    mockTier = 'guest';
    mockUser = null;
    mockCanAnalyzeNow = false;
    mockQuotaStatus = { canAnalyze: false, guestBootstrapStatus: 'degraded' };
    mockCanAnalyze.mockResolvedValue(false);
    render(<JournalDetailScreen />);
    expect(screen.queryByText('Create account')).toBeNull();
    expect(screen.queryByText('Discover Plus')).toBeNull();
    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.DreamDetailPrimaryCta)); });
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByTestId('quota-limit')).toBeNull();
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
  });

  it('offers Plus when permission is denied and the remaining metric is negative', () => {
    mockQuotaStatus = { canAnalyze: false };
    mockCanAnalyzeNow = false;
    mockQuotaUsage = { analysis: { used: 4, limit: 3, remaining: -1 } };
    render(<JournalDetailScreen />);
    expect(screen.getByTestId(TID.Button.DreamDetailPrimaryCta)).toBeTruthy();
  });

  it('offers analysis to Plus even while an old free quota is still cached', async () => {
    mockTier = 'plus';
    mockQuotaUsage = { analysis: { used: 3, limit: 3, remaining: 0 } };
    mockCanAnalyzeNow = false;
    render(<JournalDetailScreen />);
    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.DreamDetailPrimaryCta)); });
    expect(mockAnalyzeDream).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Discover Plus')).toBeNull();
  });

  it.each(['guest', 'free'] as const)('resumes a failed %s analysis without another quota or account route', async (tier: 'guest' | 'free') => {
    mockTier = tier;
    mockUser = tier === 'guest' ? null : { id: 'user-1' };
    mockQuotaStatus = { canAnalyze: false };
    mockQuotaUsage = { analysis: { used: 2, limit: 2, remaining: 0 } };
    mockCanAnalyzeNow = false;
    mockCanAnalyze.mockResolvedValue(false);
    mockDreams = [buildDream({
      analysisStatus: 'failed',
      analysisRequestId: '11111111-1111-4111-8111-111111111111',
    })];

    render(<JournalDetailScreen />);
    const action = screen.getByTestId(TID.Button.DreamDetailPrimaryCta);
    expect(action.textContent).toContain('journal.detail.analyze_button.retry');
    await act(async () => { fireEvent.click(action); });

    expect(mockAnalyzeDream).toHaveBeenCalledWith(mockDreams[0], mockDreams[0].transcript, {
      replaceExistingImage: false, lang: 'fr', analyticsSource: 'journal_detail',
    });
    expect(mockCanAnalyze).not.toHaveBeenCalled();
    expect(require('expo-router').router.push).not.toHaveBeenCalled();
  });

  it.each([false, true])('preserves the guest account path (returning device: %s)', async (isUpgraded: boolean) => {
    mockTier = 'guest';
    mockUser = null;
    mockQuotaStatus = { isUpgraded };
    mockQuotaUsage = { analysis: { used: 2, limit: 2, remaining: 0 } };
    render(<JournalDetailScreen />);
    expect(screen.queryByTestId(TID.Sheet.SavedDreamAnalysis)).toBeNull();
    expect(require('expo-router').router.push).not.toHaveBeenCalled();
    const action = screen.getByTestId(TID.Button.DreamDetailPrimaryCta);
    expect(action.textContent).toContain(isUpgraded ? 'journal.detail.quota_limit.cta_login' : 'journal.detail.quota_limit.cta_guest');
    await act(async () => { fireEvent.click(action); });
    expect(require('expo-router').router.push).toHaveBeenCalledWith(isUpgraded
      ? '/settings?section=account&auth=signin' : '/settings?section=account&auth=signup');
    expect(require('expo-router').router.push).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('quota-limit')).toBeNull();
    expect(mockCanAnalyze).not.toHaveBeenCalled();
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
  });

  it('preserves the saved guest choice when exhausted access arrives without opening another sheet', () => {
    mockTier = 'guest';
    mockUser = null;
    mockQuotaLoading = true;
    mockPendingRecordingIntent = { savedDreamId: 42, phase: 'analysis_confirmation' };
    const view = render(<JournalDetailScreen />);
    expect(mockTransitionOnboarding).not.toHaveBeenCalled();
    mockQuotaLoading = false;
    mockQuotaStatus = { canAnalyze: false };
    mockQuotaUsage = { analysis: { used: 2, limit: 2, remaining: 0 } };
    view.rerender(<JournalDetailScreen />);
    expect(mockTransitionOnboarding).not.toHaveBeenCalled();
    expect(screen.queryByTestId(TID.Sheet.SavedDreamAnalysis)).toBeNull();
    expect(screen.queryByTestId('quota-limit')).toBeNull();
    expect(require('expo-router').router.push).not.toHaveBeenCalled();
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    expect(mockUpdateDream).not.toHaveBeenCalled();
  });

  it('verifies unknown access instead of trusting the optimistic canAnalyzeNow default', async () => {
    mockQuotaUsage = undefined;
    mockCanAnalyze.mockRejectedValueOnce(new Error('offline'));
    render(<JournalDetailScreen />);
    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.DreamDetailPrimaryCta)); });
    expect(mockCanAnalyze).toHaveBeenCalledTimes(1);
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it.each(['', '   ', 'https://example.com/existing.webp'])('resumes once with the correct illustration policy for %j', async (imageUrl: string) => {
    mockDreams = [buildDream({ imageUrl })];
    requestAnalysisReturnRoute({ dreamId: '42', dreamClientRequestId: 'persisted-original-42', dreamOwnerId: 'user-1' }, 'user-1');
    mockSearchParams = { id: '42', analyzeAfterPurchase: '1', analysisOwnerId: 'user-1' };
    const view = render(<JournalDetailScreen />);
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    mockTier = 'plus';
    await act(async () => { view.rerender(<JournalDetailScreen />); });
    expect(mockAnalyzeDream).toHaveBeenCalledTimes(1);
    expect(mockAnalyzeDream).toHaveBeenCalledWith(mockDreams[0], mockDreams[0].transcript, {
      replaceExistingImage: !imageUrl.trim(), lang: 'fr', analyticsSource: 'journal_detail',
    });
    expect(mockSetParams).toHaveBeenCalledWith({ analyzeAfterPurchase: undefined, analysisOwnerId: undefined });
    await act(async () => { view.rerender(<JournalDetailScreen />); });
    expect(mockAnalyzeDream).toHaveBeenCalledTimes(1);
  });

  it('shows analysis in progress on the detail while the purchased analysis is running', async () => {
    mockTier = 'plus';
    requestAnalysisReturnRoute({ dreamId: '42', dreamClientRequestId: 'persisted-original-42', dreamOwnerId: 'user-1' }, 'user-1');
    mockSearchParams = { id: '42', analyzeAfterPurchase: '1', analysisOwnerId: 'user-1' };
    let finish!: () => void;
    mockAnalyzeDream.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
    await act(async () => { render(<JournalDetailScreen />); });
    expect(mockAnalyzeDream).toHaveBeenCalledTimes(1);
    expect(screen.getByText('loading.analyzing')).toBeTruthy();
    expect(screen.queryByTestId(TID.Text.DreamDetailActionMessage)).toBeNull();
    expect(screen.queryByTestId(TID.Button.DreamDetailPrimaryCta)).toBeNull();
    expect(screen.queryByTestId(TID.Text.DreamDetailQuotaHint)).toBeNull();
    expect(screen.queryByText('Analyze saved dream')).toBeNull();
    await act(async () => { finish(); });
  });

  it.each(['free', 'plus'] as const)('routes a stale %s reading to its eligible action', async (tier: 'free' | 'plus') => {
    mockTier = tier;
    mockSearchParams = { id: '42' };
    mockDreams = [buildDream({ isAnalyzed: true, analysisStatus: 'done',
      interpretation: 'Previous reading', analyzedAt: 1_700_000_000_000, analysisTranscriptHash: 'v1:00000000' })];
    await act(async () => { render(<JournalDetailScreen />); });
    const action = screen.getByTestId(TID.Button.AnalysisStaleCta);
    expect(action.textContent).toContain(tier === 'plus' ? 'journal.detail.stale.cta' : 'journal.detail.analyze_with_plus');
    if (tier === 'free') expect(screen.getByText('error.reanalysis_requires_plus')).toBeTruthy();
    await act(async () => { fireEvent.click(action); });
    const { router } = require('expo-router');
    if (tier === 'free') {
      expect(router.push).toHaveBeenCalledWith({ pathname: '/paywall', params: { trigger: 'analysis_limit' } });
      expect(screen.queryByText('journal.detail.reanalyze_prompt.title')).toBeNull();
    } else {
      expect(screen.getByText('journal.detail.reanalyze_prompt.title')).toBeTruthy();
      expect(router.push).not.toHaveBeenCalled();
    }
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
  });

  it('closes the outdated-analysis banner for good and keeps the update action', async () => {
    const staleDream = buildDream({
      isAnalyzed: true,
      analysisStatus: 'done',
      interpretation: 'A quiet city.',
      analyzedAt: 1_700_000_000_000,
      analysisTranscriptHash: 'v1:00000000',
    });
    mockDreams = [staleDream];
    mockSearchParams = { id: '42' };
    await act(async () => { render(<JournalDetailScreen />); });
    expect(await screen.findByTestId(TID.Component.AnalysisStaleBanner)).toBeTruthy();

    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.AnalysisStaleDismiss)); });
    expect(screen.queryByTestId(TID.Component.AnalysisStaleBanner)).toBeNull();
    expect(screen.getByTestId(TID.Button.AnalysisStaleCta)).toBeTruthy();

    cleanup();
    await act(async () => { render(<JournalDetailScreen />); });
    await waitFor(() => expect(screen.getByTestId(TID.Button.AnalysisStaleCta)).toBeTruthy());
    expect(screen.queryByTestId(TID.Component.AnalysisStaleBanner)).toBeNull();
  });

  it('does not launch an analysis from a stale or fabricated purchase URL', async () => {
    mockTier = 'free';
    mockSearchParams = { id: '42', analyzeAfterPurchase: '1', analysisOwnerId: 'user-1' };
    await act(async () => { render(<JournalDetailScreen />); });
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    expect(mockSetParams).toHaveBeenCalledWith({ analyzeAfterPurchase: undefined, analysisOwnerId: undefined });
    expect(screen.queryByText('loading.analyzing')).toBeNull();
    expect((screen.getByTestId(TID.Button.EditDream) as HTMLButtonElement).disabled).toBe(false);
  });

  it('offers a report of generated content only once the dream has some', async () => {
    mockDreams = [buildDream({ remoteId: 9042 })];
    const view = render(<JournalDetailScreen />);
    expect(screen.queryByTestId(TID.Button.DreamReport)).toBeNull();

    mockDreams = [buildDream({ remoteId: 9042, isAnalyzed: true, analysisStatus: 'done', interpretation: 'A reading.', analyzedAt: 1_700_000_000_000 })];
    view.rerender(<JournalDetailScreen />);
    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.DreamReport)); });

    expect(mockOpenContactMail).toHaveBeenCalledTimes(1);
    expect(mockOpenContactMail.mock.calls[0][0]).toMatchObject({
      subject: 'journal.detail.report.subject',
      body: 'journal.detail.report.body',
    });
  });

  it('locks edits and deletion while valid purchased access is propagating', async () => {
    requestAnalysisReturnRoute({ dreamId: '42', dreamClientRequestId: 'persisted-original-42', dreamOwnerId: 'user-1' }, 'user-1');
    mockSearchParams = { id: '42', analyzeAfterPurchase: '1', analysisOwnerId: 'user-1' };
    render(<JournalDetailScreen />);

    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    expect((screen.getByTestId(TID.Button.EditDream) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId(TID.Button.DreamDelete) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(['another-account', 'done', 'pending'])('does not resume an analysis for %s', async (state: string) => {
    mockTier = 'plus';
    mockSearchParams = { id: '42', analyzeAfterPurchase: '1', analysisOwnerId: state === 'another-account' ? 'other' : 'user-1' };
    requestAnalysisReturnRoute({ dreamId: '42', dreamClientRequestId: 'persisted-original-42', dreamOwnerId: 'user-1' }, 'user-1');
    if (state === 'done') mockDreams = [buildDream({ isAnalyzed: true, analysisStatus: 'done' })];
    if (state === 'pending') mockDreams = [buildDream({ analysisStatus: 'pending' })];
    await act(async () => { render(<JournalDetailScreen />); });
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
  });

  it('restores the saved-analysis offer from a persisted confirmation without saved=1', () => {
    mockSearchParams = { id: '42' };
    mockPendingRecordingIntent = { savedDreamId: 42, phase: 'analysis_confirmation' };
    render(<JournalDetailScreen />);
    expect(screen.queryByTestId(TID.Sheet.SavedDreamAnalysis)).toBeNull();
    expect(screen.getByTestId('btn.savedDream.returnToJournal')).toBeTruthy();
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    expect(mockTransitionOnboarding).not.toHaveBeenCalled();
  });

  it.each([
    { phase: 'analysis_requested' as const, savedDreamId: 42 },
    { phase: 'analysis_confirmation' as const, savedDreamId: 41 },
  ])('does not restore the offer from $phase for dream $savedDreamId', ({
    phase,
    savedDreamId,
  }: {
    phase: 'analysis_confirmation' | 'analysis_requested';
    savedDreamId: number;
  }) => {
    mockSearchParams = { id: '42' };
    mockPendingRecordingIntent = { savedDreamId, phase };
    render(<JournalDetailScreen />);
    expect(screen.queryByTestId(TID.Sheet.SavedDreamAnalysis)).toBeNull();
  });

  it('advances a matching confirmation to analysis_requested on accept', async () => {
    mockPendingRecordingIntent = { savedDreamId: 42, phase: 'analysis_confirmation' };
    render(<JournalDetailScreen />);
    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.DreamDetailPrimaryCta)); });
    expect(mockAnalyzeDream).toHaveBeenCalledTimes(1);
    expect(mockTransitionOnboarding).toHaveBeenCalledWith({
      type: 'SET_PENDING_PHASE',
      phase: 'analysis_requested',
      savedDreamId: 42,
    });
    expect(mockTransitionOnboarding).not.toHaveBeenCalledWith({ type: 'CLEAR_PENDING_INTENT' });
    expect(screen.queryByTestId(TID.Sheet.SavedDreamAnalysis)).toBeNull();
  });

  it('waits for the durable analysis intent before starting analysis', async () => {
    mockPendingRecordingIntent = { savedDreamId: 42, phase: 'analysis_confirmation' };
    let finish!: () => void;
    mockTransitionOnboarding.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<JournalDetailScreen />);
    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.DreamDetailPrimaryCta)); });
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    await act(async () => { finish(); });
    expect(mockAnalyzeDream).toHaveBeenCalledTimes(1);
  });

  it('does not analyze when the durable intent cannot be written', async () => {
    mockPendingRecordingIntent = { savedDreamId: 42, phase: 'analysis_confirmation' };
    mockTransitionOnboarding.mockRejectedValueOnce(new Error('storage unavailable'));
    render(<JournalDetailScreen />);
    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.DreamDetailPrimaryCta)); });
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    expect(mockTransitionOnboarding).not.toHaveBeenCalledWith({ type: 'CLEAR_PENDING_INTENT' });
  });

  it('persists analysis_requested only after the allowance check succeeds', async () => {
    mockPendingRecordingIntent = { savedDreamId: 42, phase: 'analysis_confirmation' };
    mockCanAnalyzeNow = false;
    let allow!: (value: boolean) => void;
    mockCanAnalyze.mockReturnValueOnce(new Promise<boolean>(resolve => { allow = resolve; }));
    render(<JournalDetailScreen />);
    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.DreamDetailPrimaryCta)); });
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    expect(mockTransitionOnboarding).not.toHaveBeenCalled();
    await act(async () => { allow(true); });
    expect(mockAnalyzeDream).toHaveBeenCalledTimes(1);
    expect(mockTransitionOnboarding).toHaveBeenCalledWith({
      type: 'SET_PENDING_PHASE',
      phase: 'analysis_requested',
      savedDreamId: 42,
    });
  });

  it.each([
    {
      label: 'quota',
      setup: () => {
        mockCanAnalyzeNow = false;
        mockCanAnalyze.mockResolvedValueOnce(false);
      },
    },
    {
      label: 'auth',
      setup: () => {
        mockUser = null;
        mockQuotaStatus = { isUpgraded: true };
        mockCanAnalyzeNow = false;
        mockCanAnalyze.mockResolvedValueOnce(false);
      },
    },
  ])('does not persist analysis_requested when accept is rejected by $label', async ({
    setup, label,
  }: {
    label: string;
    setup: () => void;
  }) => {
    mockPendingRecordingIntent = { savedDreamId: 42, phase: 'analysis_confirmation' };
    setup();
    render(<JournalDetailScreen />);
    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.DreamDetailPrimaryCta)); });
    if (label === 'auth') expect(require('expo-router').router.push).toHaveBeenCalledWith('/settings?section=account&auth=signin');
    else expect(require('expo-router').router.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/paywall' }));
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    expect(mockTransitionOnboarding).not.toHaveBeenCalledWith({ type: 'CLEAR_PENDING_INTENT' });
  });

  it('clears the pending intent once the onboarding analysis result is visible', () => {
    mockSearchParams = { id: '42' };
    mockPendingRecordingIntent = { savedDreamId: 42, phase: 'analysis_requested' };
    mockDreams = [buildDream({ analysisStatus: 'pending' })];
    const view = render(<JournalDetailScreen />);
    expect(mockTransitionOnboarding).not.toHaveBeenCalled();
    mockDreams = [buildDream({
      analysisStatus: 'done',
      isAnalyzed: true,
      analyzedAt: Date.now(),
      interpretation: 'Reflection',
    })];
    view.rerender(<JournalDetailScreen />);
    expect(mockTransitionOnboarding).toHaveBeenCalledWith({ type: 'CLEAR_PENDING_INTENT' });
    expect(mockTrackProductEvent).toHaveBeenCalledWith(
      'analysis_result_viewed',
      { source: 'recording_flow' }
    );
  });

  it('returns to the journal without changing the saved dream or opening an offer', async () => {
    mockPendingRecordingIntent = { savedDreamId: 42, phase: 'analysis_confirmation' };
    render(<JournalDetailScreen />);
    await act(async () => { fireEvent.click(screen.getByTestId('btn.savedDream.returnToJournal')); });
    expect(mockTransitionOnboarding).toHaveBeenCalledWith({ type: 'CLEAR_PENDING_INTENT' });
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    expect(mockUpdateDream).not.toHaveBeenCalled();
    expect(screen.queryByTestId(TID.Sheet.SavedDreamAnalysis)).toBeNull();
  });

  it('deduplicates acceptance while quota and analysis are pending', async () => {
    mockCanAnalyzeNow = false;
    let allow!: (value: boolean) => void;
    let finish!: () => void;
    mockCanAnalyze.mockReturnValueOnce(new Promise<boolean>(resolve => { allow = resolve; }));
    mockAnalyzeDream.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
    render(<JournalDetailScreen />);
    const accept = screen.getByTestId(TID.Button.DreamDetailPrimaryCta);
    await act(async () => {
      fireEvent.click(accept);
      fireEvent.click(accept);
    });
    expect(mockCanAnalyze).toHaveBeenCalledTimes(1);
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    await act(async () => { allow(true); });
    expect(mockAnalyzeDream).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId(TID.Button.DreamDetailPrimaryCta)).toBeNull();
    expect(screen.getByText('loading.analyzing')).toBeTruthy();
    await act(async () => { finish(); });
  });

  it('opens the offer directly when a recheck finds the quota exhausted', async () => {
    mockCanAnalyzeNow = false;
    mockCanAnalyze.mockResolvedValueOnce(false);
    render(<JournalDetailScreen />);
    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.DreamDetailPrimaryCta)); });
    expect(screen.queryByTestId('quota-limit')).toBeNull();
    expect(require('expo-router').router.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/paywall' }));
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    expect(mockUpdateDream).not.toHaveBeenCalled();
  });

  it('resumes the same pending request from Retry after an ambiguous transport failure', async () => {
    const requestId = 'aabbccdd-0000-4000-8000-000000000001';
    mockAnalyzeDream.mockImplementationOnce(async () => {
      mockDreams = [{ ...mockDreams[0], analysisStatus: 'pending', analysisRequestId: requestId,
        clientUpdatedAt: Date.now() }];
      throw new Error('Network request failed');
    });
    const view = render(<JournalDetailScreen />);
    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.DreamDetailPrimaryCta)); });
    view.rerender(<JournalDetailScreen />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(mockAnalyzeDream).toHaveBeenCalledTimes(1);
    await act(async () => { fireEvent.click(screen.getByText('Notice retry')); });
    expect(mockAnalyzeDream).toHaveBeenCalledTimes(2);
    expect(mockAnalyzeDream.mock.calls[1][0].analysisRequestId).toBe(requestId);
  });

  it('shows an analysis failure and leaves the saved transcript available for retry', async () => {
    mockAnalyzeDream.mockImplementationOnce(async () => { throw new Error('Network request failed'); });
    render(<JournalDetailScreen />);
    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.DreamDetailPrimaryCta)); });
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(mockDreams[0].transcript).toBe('I flew over a quiet city with a blue door.');
    expect((screen.getByTestId(TID.Button.DreamDetailPrimaryCta) as HTMLButtonElement).disabled).toBe(false);
    expect(mockUpdateDream).not.toHaveBeenCalled();
  });

  it('shows pending sync without a perpetual spinner and exposes a failed manual retry', async () => {
    mockDreams = [buildDream({ syncState: 'pending' })];
    let rejectRetry!: (error: Error) => void;
    mockRetryDreamSync.mockReturnValueOnce(new Promise<void>((_resolve, reject) => { rejectRetry = reject; }));
    render(<JournalDetailScreen />);
    expect(screen.getByText('journal.detail.sync.pending_title')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
    await act(async () => { fireEvent.click(screen.getByText('journal.detail.sync.retry')); });
    expect(mockRetryDreamSync).toHaveBeenCalledWith(mockDreams[0]);
    expect(screen.getByRole('progressbar')).toBeTruthy();
    await act(async () => { rejectRetry(new Error('offline')); });
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('journal.detail.sync.retry_error');
  });

  it('explains the anti-abuse sync refusals instead of showing their codes', () => {
    mockDreams = [buildDream({ syncState: 'failed', lastSyncError: 'DAILY_DREAM_LIMIT' })];
    const view = render(<JournalDetailScreen />);
    expect(screen.getByText('journal.detail.sync.daily_limit_message')).toBeTruthy();
    expect(screen.queryByText('DAILY_DREAM_LIMIT')).toBeNull();
    view.unmount();

    mockDreams = [buildDream({ syncState: 'failed', lastSyncError: 'DREAM_TRANSCRIPT_TOO_LONG' })];
    render(<JournalDetailScreen />);
    expect(screen.getByText('journal.detail.sync.too_long_message')).toBeTruthy();
    expect(screen.queryByText('DREAM_TRANSCRIPT_TOO_LONG')).toBeNull();
  });

  it('offers share between the seal and the reading, only once the reading is complete', () => {
    mockDreams = [buildDream()];
    const view = render(<JournalDetailScreen />);
    expect(screen.queryByTestId(TID.Button.DreamShareSeal)).toBeNull();

    mockDreams = [buildDream({ analysisStatus: 'done', isAnalyzed: true, interpretation: 'Reflection' })];
    view.rerender(<JournalDetailScreen />);
    const share = screen.getByTestId(TID.Button.DreamShareSeal);
    const reading = screen.getByTestId(TID.Component.DreamDetailReadingZone);
    expect(share.compareDocumentPosition(reading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((share as HTMLButtonElement).disabled).toBe(
      (screen.getByTestId(TID.Button.DreamShare) as HTMLButtonElement).disabled);
  });

  it('keeps a completed analysis inline on revisit and handles a failed retry', () => {
    mockDreams = [buildDream({ analysisStatus: 'pending' })];
    const view = render(<JournalDetailScreen />);
    expect(screen.queryByTestId('analysis.reading.modal')).toBeNull();
    mockDreams = [buildDream({ analysisStatus: 'done', isAnalyzed: true, interpretation: 'Reflection' })];
    view.rerender(<JournalDetailScreen />);
    expect(screen.getByTestId(TID.Component.DreamDetailReadingZone).textContent).toContain('Reflection');
    expect(screen.queryByTestId('analysis.reading.modal')).toBeNull();
    view.unmount();
    const revisit = render(<JournalDetailScreen />);
    expect(screen.getByTestId(TID.Component.DreamDetailReadingZone).textContent).toContain('Reflection');
    mockDreams = [buildDream({ analysisStatus: 'failed', isAnalyzed: true, interpretation: 'Old reflection' })];
    revisit.rerender(<JournalDetailScreen />);
    expect(screen.queryByTestId(TID.Component.DreamDetailReadingZone)).toBeNull();
    expect(screen.queryByTestId('analysis.reading.modal')).toBeNull();
  });

  it('places the completed reading before optional recall', () => {
    mockDreams = [buildDream({ analysisStatus: 'done', isAnalyzed: true, interpretation: 'Reflection' })];
    render(<JournalDetailScreen />);
    const reading = screen.getByTestId(TID.Component.DreamDetailReadingZone);
    const recall = screen.getByTestId(TID.Component.DreamRecallOffer);
    expect(reading.compareDocumentPosition(recall) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('attributes an original poetic quote and omits the section when absent', () => {
    const caption = 'On a red bird above a forest.';
    mockDreams = [buildDream({ isAnalyzed: true, analysisStatus: 'done', interpretation: 'Reflection', shareableQuote: caption, promptVersion: 'analysis-2026-09-17.poetic1' })];
    const view = render(<JournalDetailScreen />);
    expect(screen.getByText(caption, { exact: false })).toBeTruthy();
    expect(screen.getByText('journal.detail.quote_attribution')).toBeTruthy();
    view.unmount();
    mockDreams = [buildDream({ isAnalyzed: true, analysisStatus: 'done', interpretation: 'Reflection', shareableQuote: '  ' })];
    render(<JournalDetailScreen />);
    expect(screen.queryByText(caption, { exact: false })).toBeNull();
    expect(screen.queryByText('journal.detail.quote_attribution')).toBeNull();
  });

  it('keeps a legacy excerpt without falsely attributing it to Noctalia', () => {
    mockDreams = [buildDream({ isAnalyzed: true, analysisStatus: 'done', interpretation: 'Reflection', shareableQuote: 'I flew over a quiet city' })];
    render(<JournalDetailScreen />);
    expect(screen.getByTestId(TID.Component.DreamDetailReadingZone).textContent).toContain('I flew over a quiet city');
    expect(screen.queryByText('journal.detail.quote_attribution')).toBeNull();
  });

  it.each(['light', 'dark'] as const)('keeps the illustrated title/date and image/edit actions in %s mode', async (theme: 'light' | 'dark') => {
    mockThemeMode = theme;
    const title = 'The lake beneath a golden moon, beyond the mountains and the quiet sleeping village';
    mockDreams = [buildDream({ title, imageUrl: 'https://example.com/dream.webp' })];
    render(<JournalDetailScreen />);

    expect(screen.getAllByText(title)).toHaveLength(1);
    const date = screen.getByText('3 sept. · 07:12');
    expect(screen.getByText(title).compareDocumentPosition(date) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.JournalIllustrationExpand)); });
    expect(screen.getByTestId(TID.Modal.JournalIllustrationFullscreen)).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.JournalIllustrationClose)); });
    expect(screen.queryByTestId(TID.Modal.JournalIllustrationFullscreen)).toBeNull();
    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.EditDream)); });
    expect((screen.getByTestId(TID.Input.DreamTitle) as HTMLInputElement).value).toBe(title);
    expect(mockUpdateDream).not.toHaveBeenCalled();
  });

  it.each([false, true])('keeps the narrative and complete analysis in reading order with image=%s', (withImage: boolean) => {
    mockSearchParams = { id: '42' };
    mockDreams = [buildDream({
      isAnalyzed: true,
      analysisStatus: 'done',
      interpretation: 'A quiet reflection',
      imageGenerationFailed: !withImage,
      symbols: [{ name: 'Lake', meaning: 'Stillness' }],
      imageUrl: withImage ? 'https://example.com/dream.webp' : undefined,
    })];
    render(<JournalDetailScreen />);
    const narrative = screen.getByTestId(TID.Component.TranscriptCard);
    const reading = screen.getByTestId(TID.Component.DreamDetailReadingZone);
    const illustration = screen.getByTestId(TID.Component.JournalIllustration);
    const before = (first: Element, second: Element) => {
      expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    };
    // The reading follows its seal, under the name, and comes before the story it reads.
    before(reading, narrative);
    expect(reading.contains(screen.getByText('Lake'))).toBe(true);
    if (withImage) before(illustration, reading);
    else {
      before(narrative, illustration);
    }
  });

  it('keeps illustration retry available after a Plus illustration fails', () => {
    mockTier = 'plus';
    mockDreams = [buildDream({
      isAnalyzed: true,
      analysisStatus: 'done',
      imageGenerationFailed: true,
      imageJobErrorCode: 'IMAGE_JOB_SUBMISSION_FAILED',
    })];
    render(<JournalDetailScreen />);
    expect(screen.getByRole('button', { name: 'Retry illustration' })).toBeTruthy();
  });

  // The seal offers only a first illustration: a failed one keeps its own card and step (PR #367 review).
  it('keeps a single upgrade step on the failure card when a free illustration failed', () => {
    mockTier = 'free';
    mockUser = { id: 'user-1' };
    mockSearchParams = { id: '42' };
    mockDreams = [buildDream({
      isAnalyzed: true,
      analysisStatus: 'done',
      interpretation: 'A quiet reflection',
      imageGenerationFailed: true,
    })];
    render(<JournalDetailScreen />);
    const upgrades = screen.getAllByTestId(TID.Button.ImageUpgrade);
    expect(upgrades).toHaveLength(1);
    expect(screen.getByTestId(TID.Component.SavedDreamMoment).contains(upgrades[0])).toBe(false);
  });

  it.each(['analysis_confirmation', 'analysis_requested'] as const)('only dismisses optional onboarding analysis on return: %s', (phase: 'analysis_confirmation' | 'analysis_requested') => {
    mockPendingRecordingIntent = { savedDreamId: 42, phase };
    render(<JournalDetailScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.NavigateJournal));
    expect(mockTransitionOnboarding).toHaveBeenCalledTimes(phase === 'analysis_confirmation' ? 1 : 0);
    if (phase === 'analysis_confirmation') {
      expect(mockTransitionOnboarding).toHaveBeenCalledWith({ type: 'CLEAR_PENDING_INTENT' });
    }
  });

  it('does not present the default draft type as a classification and offers a missing theme while editing', () => {
    mockDreams = [buildDream({ theme: undefined })];
    render(<JournalDetailScreen />);
    expect(screen.getByTestId(TID.Component.MetadataCard).textContent).not.toContain('Symbolic Dream');
    expect(screen.queryByRole('button', { name: 'journal.detail.theme_placeholder' })).toBeNull();
    fireEvent.click(screen.getByTestId(TID.Button.EditDream));
    expect(screen.getByTestId('chip.theme.calm')).toBeTruthy();
  });

  it('edits the name and the story from one control and cancels without writing the dream', () => {
    render(<JournalDetailScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.EditDream));
    expect(screen.getByTestId(TID.Input.DreamTitle)).toBeTruthy();
    expect(screen.getByTestId(TID.Input.DreamTranscript).getAttribute('aria-label')).toBe('recording.placeholder.accessibility');
    fireEvent.click(screen.getByTestId(TID.Button.CancelDreamEdit));
    expect(screen.queryByTestId(TID.Input.DreamTranscript)).toBeNull();
    expect(mockUpdateDream).not.toHaveBeenCalled();
  });

  it('saves the name and the story together in one write', async () => {
    render(<JournalDetailScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.EditDream));
    fireEvent.change(screen.getByTestId(TID.Input.DreamTitle), { target: { value: 'A new name' } });
    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), { target: { value: 'A new story' } });
    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.SaveDreamEdit)); });
    expect(mockUpdateDream).toHaveBeenCalledTimes(1);
    expect(mockUpdateDream).toHaveBeenCalledWith(expect.objectContaining({ title: 'A new name', transcript: 'A new story' }));
    expect(screen.queryByTestId(TID.Component.DreamEditor)).toBeNull();
  });

  it('stops the story at the maximum length, and lets an older longer story shrink without growing', () => {
    const view = render(<JournalDetailScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.EditDream));
    expect(screen.getByTestId(TID.Input.DreamTranscript).getAttribute('maxlength')).toBe('20000');
    expect(screen.queryByTestId('dream-length-counter')).toBeNull();
    view.unmount();

    mockDreams = [buildDream({ transcript: 'r'.repeat(25000) })];
    render(<JournalDetailScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.EditDream));
    expect(screen.getByTestId(TID.Input.DreamTranscript).getAttribute('maxlength')).toBe('25000');
    expect(screen.getByTestId('dream-length-counter')).toBeTruthy();
  });

  it('keeps a story the server would refuse in the editor and says to shorten it', async () => {
    const { Alert } = jest.requireMock('react-native') as { Alert: { alert: jest.Mock } };
    Alert.alert.mockClear();
    // Not synced yet: the server has no longer story to allow.
    mockDreams = [buildDream({ transcript: 'r'.repeat(25000) })];
    const view = render(<JournalDetailScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.EditDream));
    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), { target: { value: 'r'.repeat(24000) } });
    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.SaveDreamEdit)); });
    expect(Alert.alert).toHaveBeenCalledWith('recording.alert.too_long.title', 'recording.alert.too_long.message');
    expect(mockUpdateDream).not.toHaveBeenCalled();
    expect(screen.getByTestId(TID.Input.DreamTranscript)).toBeTruthy();
    view.unmount();

    // Stored before the limit: it may shrink and keep a length over the maximum.
    Alert.alert.mockClear();
    mockDreams = [buildDream({ remoteId: 7, transcript: 'r'.repeat(25000) })];
    render(<JournalDetailScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.EditDream));
    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), { target: { value: 'r'.repeat(24000) } });
    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.SaveDreamEdit)); });
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockUpdateDream).toHaveBeenCalledWith(expect.objectContaining({ transcript: 'r'.repeat(24000) }));
  });

  it('sets the edit link beside delete and takes it away while editing', async () => {
    render(<JournalDetailScreen />);
    const edit = screen.getByTestId(TID.Button.EditDream);
    expect(edit.parentElement).toBe(screen.getByTestId(TID.Button.DreamDelete).parentElement);

    await act(async () => { fireEvent.click(edit); });
    expect(screen.queryByTestId(TID.Button.EditDream)).toBeNull();
    expect(screen.getByTestId(TID.Button.DreamDelete)).toBeTruthy();
  });

  it('makes unknown analysis access explicit before the click', () => {
    mockQuotaUsage = undefined;
    render(<JournalDetailScreen />);
    expect(screen.getByTestId(TID.Button.DreamDetailPrimaryCta).textContent).toContain('journal.detail.check_analysis');
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
  });

  it('shows exhausted credits without claiming the dream is lost', () => {
    mockQuotaUsage = { analysis: { used: 3, limit: 3, remaining: 0 } };
    render(<JournalDetailScreen />);
    expect(screen.getByTestId(TID.Text.DreamDetailQuotaHint).textContent).toBe('journal.detail.quota_hint.empty');
    expect(screen.getByTestId(TID.Button.DreamDetailPrimaryCta).textContent).toContain('journal.detail.analysis_options');
  });

  it('announces the save when the mounted detail has saved=1, the seal itself showing it', () => {
    render(<JournalDetailScreen />);

    expect(mockAnnounceForAccessibility).toHaveBeenCalledWith('recording.save.confirmation');
    expect(screen.queryByTestId(TID.Text.RecordingSaveConfirmation)).toBeNull();
    expect(mockSetParams).toHaveBeenCalledWith({ saved: undefined });
  });

  it('does not show the confirmation without saved=1', () => {
    mockSearchParams = { id: '42' };
    render(<JournalDetailScreen />);

    expect(screen.queryByTestId(TID.Text.RecordingSaveConfirmation)).toBeNull();
  });

  it('keeps the recall offer once saved=1 is cleared from the route', () => {
    const view = render(<JournalDetailScreen />);
    expect(screen.getByTestId(TID.Component.DreamRecallOffer)).toBeTruthy();

    mockSearchParams = { id: '42' };
    view.rerender(<JournalDetailScreen />);
    expect(screen.getByTestId(TID.Component.DreamRecallOffer)).toBeTruthy();
  });

  it('prioritizes the requested recall assistant once while preserving the saved dream', () => {
    mockSearchParams = { id: '42', saved: '1', recall: '1' };
    render(<JournalDetailScreen />);
    const recall = screen.getByTestId(TID.Component.DreamRecallOffer);
    expect(recall.getAttribute('data-start-requested')).toBe('true');
    expect(screen.getAllByTestId(TID.Component.DreamRecallOffer)).toHaveLength(1);
    const transcript = screen.getByTestId(TID.Component.TranscriptCard);
    expect(recall.compareDocumentPosition(transcript) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps analysis as the unique primary CTA alongside the optional recall offer', () => {
    render(<JournalDetailScreen />);

    const analysis = screen.getByTestId(TID.Button.DreamDetailPrimaryCta);
    const recall = screen.getByTestId(TID.Component.DreamRecallOffer);
    expect(screen.getAllByTestId(TID.Button.DreamDetailPrimaryCta)).toHaveLength(1);
    expect(analysis).toBeTruthy();
    expect(recall).toBeTruthy();
    expect(screen.getByTestId(TID.Button.DreamRecallStart)).toBeTruthy();
  });

  // A few frames between the store dropping the dream and router.replace landing: no
  // journey sees them reliably, and the page under the turner remounts in between.
  it('never shows the not-found page while its own dream is being deleted', async () => {
    mockSearchParams = { id: '42' };
    const replace = require('expo-router').router.replace;
    replace.mockClear();
    let settleDelete!: () => void;
    mockDeleteDream.mockImplementationOnce(() => new Promise<void>((resolve) => { settleDelete = resolve; }));
    const view = render(<JournalDetailScreen />);

    fireEvent.click(screen.getByTestId(TID.Button.DreamDelete));
    fireEvent.click(screen.getByText('Confirm delete'));
    mockDreams = [];
    view.rerender(<JournalDetailScreen />);
    expect(screen.queryByText('journal.detail.not_found.title')).toBeNull();

    await act(async () => { settleDelete(); });
    expect(replace).toHaveBeenCalledWith('/(tabs)/journal');
    expect(screen.queryByText('journal.detail.not_found.title')).toBeNull();
  });

  it('does not leave a blank page when a deletion fails after its dream has left', async () => {
    mockSearchParams = { id: '42' };
    const alert = require('react-native').Alert.alert;
    alert.mockClear();
    let failDelete!: (error: Error) => void;
    mockDeleteDream.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { failDelete = reject; }));
    const view = render(<JournalDetailScreen />);

    fireEvent.click(screen.getByTestId(TID.Button.DreamDelete));
    fireEvent.click(screen.getByText('Confirm delete'));
    mockDreams = [];
    view.rerender(<JournalDetailScreen />);
    await act(async () => { failDelete(new Error('write failed')); });

    expect(alert).toHaveBeenCalledWith('common.error_title', 'common.unknown_error');
    expect(screen.getByText('journal.detail.not_found.title')).toBeTruthy();
  });

  it('still shows the not-found page for a dream that is not there', () => {
    mockDreams = [];
    render(<JournalDetailScreen />);

    expect(screen.getByText('journal.detail.not_found.title')).toBeTruthy();
  });

  it('exposes delete as a 44 dp button', () => {
    render(<JournalDetailScreen />);

    const deleteButton = screen.getByTestId(TID.Button.DreamDelete);
    expect(deleteButton.getAttribute('role')).toBe('button');
    expect(deleteButton.className).toContain('min-h-[44px]');
    expect(deleteButton.className).toContain('min-w-[44px]');
  });
});


describe('native share card', () => {
  const shareCardButton = () => screen.getByTestId(TID.Button.DreamShareCard);
  beforeEach(() => { mockCompositeLoads = true; mockCompositeEvents.length = 0; mockShareComposite.mockClear(); mockRetryMedia.mockClear(); require('react-native').Share.share.mockClear(); require('react-native').Alert.alert.mockClear(); });
  afterEach(() => { cleanup(); require('react-native').Platform.OS = 'web'; mockMedia = null; });
  it('opens the composer at once, then mounts the card only on share and captures after its image shows', async () => {
    require('react-native').Platform.OS = 'android';
    mockDreams = [buildDream({ imageUrl: 'supabase-storage://dream-images/A/image', isAnalyzed: true, analysisStatus: 'done' })];
    mockMedia = { imageUrl: '', loading: true, error: false, retry: mockRetryMedia };
    mockCompositeLoads = null;
    const { rerender } = render(<JournalDetailScreen />);
    expect((screen.getByTestId(TID.Button.DreamShare) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByTestId(TID.Button.DreamShare));
    expect(screen.getByTestId(TID.Sheet.DreamShare).getAttribute('data-painting-pending')).toBe('true');
    // The illustration is still being signed: a card asking for it waits.
    fireEvent.click(shareCardButton());
    expect(screen.queryByTestId('share-composite')).toBeNull();
    mockMedia = { imageUrl: 'https://signed/image', loading: false, error: false, retry: mockRetryMedia };
    rerender(<JournalDetailScreen />);
    expect(screen.getByTestId(TID.Sheet.DreamShare).getAttribute('data-painting')).toBe('https://signed/image');
    expect(screen.queryByTestId('share-composite')).toBeNull();
    fireEvent.click(shareCardButton());
    expect(screen.getByTestId('share-composite').getAttribute('data-text')).toBe('quote');
    expect(mockShareImageRef.current).not.toBeNull();
    await act(async () => { mockCompositeEvents[0].load(); });
    expect(mockShareComposite).not.toHaveBeenCalled();
    await act(async () => { mockCompositeEvents[0].display(); });
    expect(mockShareComposite).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('share-composite')).toBeNull();
    expect(screen.queryByTestId(TID.Sheet.DreamShare)).toBeNull();
    expect(require('react-native').Share.share).not.toHaveBeenCalled();
  });
  it('shares the chosen card without the illustration at once, even while it is still being signed', async () => {
    require('react-native').Platform.OS = 'android';
    mockDreams = [buildDream({ imageUrl: 'supabase-storage://dream-images/A/image', isAnalyzed: true, analysisStatus: 'done' })];
    mockMedia = { imageUrl: '', loading: true, error: false, retry: mockRetryMedia };
    render(<JournalDetailScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.DreamShare));
    await act(async () => { fireEvent.click(screen.getByText('Share my story without the illustration')); });
    expect(mockCompositeEvents).toHaveLength(0);
    expect(mockShareComposite).toHaveBeenCalledTimes(1);
    expect(require('react-native').Alert.alert).not.toHaveBeenCalled();
    expect(screen.queryByTestId(TID.Sheet.DreamShare)).toBeNull();
  });
  it('cancels the share when the dreamer leaves while the card is still being drawn', async () => {
    require('react-native').Platform.OS = 'android';
    mockDreams = [buildDream({ imageUrl: 'https://cdn/image', isAnalyzed: true, analysisStatus: 'done' })];
    mockMedia = { imageUrl: 'https://cdn/image', loading: false, error: false, retry: mockRetryMedia };
    mockCompositeLoads = null;
    render(<JournalDetailScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.DreamShare));
    fireEvent.click(shareCardButton());
    expect(screen.getByTestId('share-composite')).toBeTruthy();
    expect(screen.getByTestId(TID.Sheet.DreamShare).getAttribute('data-capturing')).toBe('false');
    await act(async () => { fireEvent.click(screen.getByText('Close the composer')); });
    expect(screen.queryByTestId(TID.Sheet.DreamShare)).toBeNull();
    expect(screen.queryByTestId('share-composite')).toBeNull();
    await act(async () => { mockCompositeEvents[0].report('https://cdn/image', true); });
    expect(mockShareComposite).not.toHaveBeenCalled();
    expect(require('react-native').Alert.alert).not.toHaveBeenCalled();
    expect((screen.getByTestId(TID.Button.DreamShare) as HTMLButtonElement).disabled).toBe(false);
  });
  it('closes the composer without sharing anything', () => {
    require('react-native').Platform.OS = 'android';
    mockDreams = [buildDream({ imageUrl: 'https://cdn/image', isAnalyzed: true, analysisStatus: 'done' })];
    mockMedia = { imageUrl: 'https://cdn/image', loading: false, error: false, retry: mockRetryMedia };
    render(<JournalDetailScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.DreamShare));
    fireEvent.click(screen.getByText('Close the composer'));
    expect(screen.queryByTestId(TID.Sheet.DreamShare)).toBeNull();
    expect(screen.queryByTestId('share-composite')).toBeNull();
    expect(mockShareComposite).not.toHaveBeenCalled();
  });
  // An illustration that cannot be shown no longer blocks sharing: the card goes without it
  // (a dream whose painting failed to load could never be shared before).
  it('shares the card without the illustration it could not show, and ignores old callbacks', async () => {
    require('react-native').Platform.OS = 'android';
    mockDreams = [buildDream({ imageUrl: 'https://cdn/image', isAnalyzed: true, analysisStatus: 'done' })];
    mockMedia = { imageUrl: 'https://cdn/image', loading: false, error: false, retry: mockRetryMedia };
    mockCompositeLoads = false;
    render(<JournalDetailScreen />);
    expect(screen.queryByTestId('share-composite')).toBeNull();
    fireEvent.click(screen.getByTestId(TID.Button.DreamShare));
    await act(async () => { fireEvent.click(shareCardButton()); });
    expect(mockShareComposite).toHaveBeenCalledTimes(1);
    expect(require('react-native').Alert.alert).not.toHaveBeenCalled();
    expect(screen.queryByTestId('share-composite')).toBeNull();
    expect((screen.getByTestId(TID.Button.DreamShare) as HTMLButtonElement).disabled).toBe(false);
    mockCompositeLoads = null;
    fireEvent.click(screen.getByTestId(TID.Button.DreamShare));
    fireEvent.click(shareCardButton());
    expect(mockCompositeEvents).toHaveLength(2);
    await act(async () => { mockCompositeEvents[0].report('https://cdn/image', true); });
    expect(mockShareComposite).toHaveBeenCalledTimes(1);
    await act(async () => { mockCompositeEvents[1].report('https://cdn/image', true); });
    expect(mockShareComposite).toHaveBeenCalledTimes(2);
    expect(require('react-native').Share.share).not.toHaveBeenCalled();
  });
  it('ignores an image callback after the resolved source changes', async () => {
    require('react-native').Platform.OS = 'android';
    mockDreams = [buildDream({ imageUrl: 'https://cdn/image', isAnalyzed: true, analysisStatus: 'done' })];
    mockMedia = { imageUrl: 'https://signed/old', loading: false, error: false, retry: mockRetryMedia };
    mockCompositeLoads = null;
    const { rerender } = render(<JournalDetailScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.DreamShare));
    fireEvent.click(shareCardButton());
    expect(mockCompositeEvents[0].source).toBe('https://signed/old');
    await act(async () => {
      mockMedia = { imageUrl: 'https://signed/new', loading: false, error: false, retry: mockRetryMedia };
      rerender(<JournalDetailScreen />);
    });
    await act(async () => { mockCompositeEvents[0].report('https://signed/old', true); });
    expect(mockShareComposite).not.toHaveBeenCalled();
    expect(require('react-native').Alert.alert).not.toHaveBeenCalled();
    expect(screen.queryByTestId('share-composite')).toBeNull();
    fireEvent.click(shareCardButton());
    expect(mockCompositeEvents[1].source).toBe('https://signed/new');
    await act(async () => { mockCompositeEvents[1].report('https://signed/new', true); });
    expect(mockShareComposite).toHaveBeenCalledTimes(1);
  });
  it('shares the card without an illustration that cannot be had, never silently as text', async () => {
    require('react-native').Platform.OS = 'android';
    mockDreams = [buildDream({ imageUrl: 'supabase-storage://dream-images/A/image', isAnalyzed: true, analysisStatus: 'done' })];
    mockMedia = { imageUrl: '', loading: false, error: true, retry: mockRetryMedia };
    render(<JournalDetailScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.DreamShare));
    await act(async () => { fireEvent.click(shareCardButton()); });
    expect(mockShareComposite).toHaveBeenCalledTimes(1);
    expect(require('react-native').Alert.alert).not.toHaveBeenCalled();
    expect(require('react-native').Share.share).not.toHaveBeenCalled();
  });
  it('shares a card, not text, for a dream that was never illustrated', async () => {
    require('react-native').Platform.OS = 'android';
    mockDreams = [buildDream({ isAnalyzed: true, analysisStatus: 'done' })];
    mockMedia = { imageUrl: '', loading: false, error: false, retry: mockRetryMedia };
    render(<JournalDetailScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.DreamShare));
    expect(screen.getByTestId(TID.Sheet.DreamShare).getAttribute('data-painting')).toBe('');
    await act(async () => { fireEvent.click(shareCardButton()); });
    expect(mockShareComposite).toHaveBeenCalledTimes(1);
    expect(require('react-native').Share.share).not.toHaveBeenCalled();
  });
  it('opens the composer from a journal card share request', () => {
    require('react-native').Platform.OS = 'android';
    mockSetParams.mockClear();
    mockDreams = [buildDream({ isAnalyzed: true, analysisStatus: 'done' })];
    mockSearchParams = { id: '42', share: '1' };
    try {
      render(<JournalDetailScreen />);
      expect(screen.getByTestId(TID.Sheet.DreamShare)).toBeTruthy();
      expect(mockSetParams).toHaveBeenCalledWith({ share: undefined });
      expect(mockShareComposite).not.toHaveBeenCalled();
    } finally { mockSearchParams = { id: '42', saved: '1' }; }
  });
  it('neither opens the composer nor mounts the card for web sharing', () => {
    require('react-native').Platform.OS = 'web';
    mockDreams = [buildDream({ imageUrl: 'https://cdn/image', isAnalyzed: true, analysisStatus: 'done' })];
    mockMedia = { imageUrl: 'https://cdn/image', loading: false, error: false, retry: mockRetryMedia };
    render(<JournalDetailScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.DreamShare));
    expect(screen.queryByTestId(TID.Sheet.DreamShare)).toBeNull();
    expect(screen.queryByTestId('share-composite')).toBeNull();
  });
});


describe('stable dream route identity', () => {
  afterEach(() => { cleanup(); mockSearchParams = { id: '42' }; });
  it.each([17, 2501])('opens and favorites remote dream %i among identical timestamps', (remoteId: number) => {
    mockMedia = null;
    mockQuotaUsage = { analysis: { used: 0, limit: 3, remaining: 3 } };
    mockUpdateDream.mockClear();
    mockRetryDreamSync.mockReset();
    mockToggleFavorite.mockClear();
    mockDreams = [buildDream({ remoteId: 17, clientRequestId: 'request-17', title: 'Seventeen' }), buildDream({ remoteId: 2501, clientRequestId: 'request-2501', title: 'Last dream' })];
    mockSearchParams = { id: '42', remoteId: String(remoteId) };
    render(<JournalDetailScreen />);
    const selected = mockDreams.find(dream => dream.remoteId === remoteId)!;
    expect(screen.getAllByText(selected.title).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId(TID.Button.DreamFavorite));
    expect(mockToggleFavorite).toHaveBeenCalledWith(selected);
  });
  // A real capture cannot reliably produce timestamp collisions; isolate the route
  // boundary so equal-date sync records cannot navigate back to the same dream.
  it('turns to the other equal-date record and never offers itself as a neighbour', () => {
    mockSetParams.mockClear();
    mockDreams = [buildDream({ remoteId: 17, clientRequestId: 'request-17' }),
      buildDream({ remoteId: 2501, clientRequestId: 'request-2501' })];
    mockSearchParams = { id: '42', remoteId: '2501' };
    render(<JournalDetailScreen />);
    const turns = screen.queryAllByTestId(/^test\.page\.(newer|older)$/);
    expect(turns).toHaveLength(1);
    fireEvent.click(turns[0]);
    expect(mockSetParams).toHaveBeenCalledWith(expect.objectContaining({
      id: '42', remoteId: '17', clientRequestId: 'request-17',
    }));
  });
  it('does not pick the first dream for an ambiguous legacy date-only route', () => {
    mockDreams = [buildDream({ remoteId: 17 }), buildDream({ remoteId: 2501 })];
    mockSearchParams = { id: '42' };
    render(<JournalDetailScreen />);
    expect(screen.queryByTestId(TID.Button.DreamFavorite)).toBeNull();
  });
});


it('keeps the recall draft key when another page adds or removes an equal-date dream', () => {
  mockMedia = null;
  const selected = buildDream({ remoteId: 17, clientRequestId: 'request-17' });
  mockDreams = [selected];
  mockSearchParams = { id: '42', remoteId: '17', saved: '1' };
  const { rerender, unmount } = render(<JournalDetailScreen />);
  const key = () => screen.getByTestId(TID.Component.DreamRecallOffer).getAttribute('data-dream-id');
  expect(key()).toBe('user-1:client:request-17');
  mockDreams = [selected, buildDream({ remoteId: 2501, clientRequestId: 'request-2501' })];
  rerender(<JournalDetailScreen />);
  expect(key()).toBe('user-1:client:request-17');
  mockDreams = [selected];
  rerender(<JournalDetailScreen />);
  expect(key()).toBe('user-1:client:request-17');
  unmount();
  mockSearchParams = { id: '42' };
});

it('renders a sparse unclassified reflection without empty insight sections', () => {
  mockDreams = [buildDream({
    interpretation: 'Votre récit décrit une porte.',
    dreamType: 'Unknown',
    isAnalyzed: true,
    analysisStatus: 'done',
    symbols: [],
    emotions: [],
    reflectionQuestions: [],
  })];
  render(<JournalDetailScreen />);
  expect(screen.getByText('Votre récit décrit une porte.')).toBeTruthy();
  expect(screen.queryByText('journal.detail.symbols_header')).toBeNull();
  expect(screen.queryByText('journal.detail.emotions_header')).toBeNull();
});

// An invisible preview's performance marker has no visual E2E assertion; retain
// this isolated counterexample so latency evidence describes only live content.
it('does not report a decorative analysis as committed but reports the live reading', () => {
  const { DecorativeCopy } = require('@/components/journal/DecorativeCopy');
  const { DreamAnalysisContent } = require('@/components/journal/DreamAnalysisContent');
  const dream = buildDream({ analysisRequestId: 'reading-42', isAnalyzed: true,
    analysisStatus: 'done', interpretation: 'A quiet city.' });
  mockMarkPerformance.mockClear();
  const view = render(<DecorativeCopy><DreamAnalysisContent dream={dream} pending={false} /></DecorativeCopy>);
  expect(mockMarkPerformance).not.toHaveBeenCalledWith('analysis.text_committed', expect.anything());
  view.rerender(<DreamAnalysisContent dream={dream} pending={false} />);
  expect(mockMarkPerformance).toHaveBeenCalledWith('analysis.text_committed', { trace: 1, reveal_delay_ms: 0 });
  cleanup();
});
