/* @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { PendingRecordingIntent } from '@/lib/onboardingState';
import type { DreamAnalysis } from '@/lib/types';
import { requestAnalysisReturnRoute } from '@/lib/paywallRoute';
import { TID } from '@/lib/testIDs';

let mockPendingRecordingIntent: Partial<PendingRecordingIntent> | null = null;
const mockTransitionOnboarding = jest.fn(async () => undefined);
let mockMedia: any = null;
let mockQuotaUsage: any = { analysis: { used: 0, limit: 3, remaining: 3 } };
let mockQuotaStatus: { isUpgraded?: boolean } | null = null;
let mockCanAnalyzeNow = true;
let mockQuotaLoading = false;
const mockCanAnalyze = jest.fn(async () => true);
let mockTier: 'guest' | 'free' | 'plus' = 'free';
let mockUser: { id: string } | null = { id: 'user-1' };
const mockUpdateDream = jest.fn();
const mockRetryDreamSync = jest.fn(async (): Promise<void> => undefined);
let mockCompositeLoads = true;
const mockRetryMedia = jest.fn();
const mockShareComposite = jest.fn();
jest.mock('@/components/ui/MarkdownText', () => ({ MarkdownText: ({ children }: { children: string }) => <span>{children}</span> }));

jest.mock('@/hooks/useDreamMedia', () => ({ useDreamMedia: (dream: any) => mockMedia ?? ({ imageUrl: dream?.imageUrl ?? '', thumbnailUrl: dream?.thumbnailUrl, loading: false, error: false, retry: mockRetryMedia }) }));

const mockToggleFavorite = jest.fn();
const mockAnalyzeDream = jest.fn();
const mockDeleteDream = jest.fn();
const mockSetParams = jest.fn();
let mockSearchParams: { id: string; remoteId?: string; clientRequestId?: string; saved?: string | string[]; recall?: string | string[]; analyzeAfterPurchase?: string; analysisOwnerId?: string } = { id: '42', saved: '1' };
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
    Text: createElement('span'),
    TextInput: createElement('input'),
    View: createElement('div'),
  };
});

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    canGoBack: () => false,
    push: jest.fn(),
    replace: jest.fn(),
    setParams: mockSetParams,
  },
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
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

jest.mock('@/components/inspiration/GlassCard', () => ({
  FlatGlassCard: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/journal/DreamShareImage', () => ({
  DreamShareImage: ({ resolvedMedia, onMediaReady }: any) => {
    require('react').useEffect(() => { if (resolvedMedia?.imageUrl) onMediaReady(resolvedMedia.imageUrl, mockCompositeLoads); }, [resolvedMedia?.imageUrl, onMediaReady]);
    return null;
  },
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
  AnalysisNoticeSheet: ({ visible, notice }: any) => visible ? <div role="alert">{notice.message}</div> : null,
  DeleteConfirmSheet: () => null,
  ImageErrorSheet: () => null,
  QuotaLimitSheet: ({ visible }: any) => visible ? <div data-testid="quota-limit" /> : null,
  ReanalyzeSheet: () => null,
  ReferenceImageSheet: () => null,
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

jest.mock('@/components/reminders/ReminderOptInCard', () => ({
  ReminderOptInCard: () => null,
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: () => null,
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock('@/context/DreamsContext', () => ({
  useDreams: () => ({
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
    mode: 'dark',
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
    shareImageRef: { current: null },
    shareComposite: mockShareComposite,
    isGenerating: false,
  }),
}));

jest.mock('@/hooks/useLocaleFormatting', () => ({
  useLocaleFormatting: () => ({
    formatDreamDate: () => '3 sept.',
    formatDreamTime: () => '07:12',
  }),
}));

jest.mock('@/hooks/useQuota', () => ({
  useQuota: () => ({
    canAnalyzeNow: mockCanAnalyzeNow,
    canAnalyze: mockCanAnalyze,
    canGenerateImageNow: true,
    tier: mockTier,
    usage: mockQuotaUsage,
    loading: mockQuotaLoading,
    quotaStatus: mockQuotaStatus,
  }),
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
  isHdIllustrationsEnabled: () => true,
  isMockModeEnabled: () => false,
  isReferenceImagesEnabled: () => false,
}));

const mockTrackProductEvent = jest.fn();
jest.mock('@/lib/analytics', () => ({
  trackProductEvent: (...args: unknown[]) => mockTrackProductEvent(...args),
}));

jest.mock('@/services/geminiService', () => ({
  categorizeDream: jest.fn(),
  generateImageWithReference: jest.fn(),
}));

const { default: JournalDetailScreen } = require('@/app/journal/[id]');

describe('journal detail saved confirmation route', () => {
  beforeEach(() => {
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
    require('react-native').Platform.OS = 'web';
    require('react-native').Share.share.mockClear();
    mockSearchParams = { id: '42', saved: '1' };
    mockDreams = [buildDream()];
  });

  afterEach(() => {
    cleanup();
  });

  it('offers analysis after save without launching it until accepted', async () => {
    render(<JournalDetailScreen />);
    expect(screen.getByTestId(TID.Sheet.SavedDreamAnalysis)).toBeTruthy();
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByText('Analyze saved dream')); });
    expect(mockAnalyzeDream).toHaveBeenCalledTimes(1);
    expect(mockAnalyzeDream).toHaveBeenCalledWith(mockDreams[0], mockDreams[0].transcript, {
      replaceExistingImage: true, lang: 'fr', analyticsSource: 'journal_detail',
    });
    expect(screen.queryByTestId(TID.Sheet.SavedDreamAnalysis)).toBeNull();
    expect(mockTransitionOnboarding).not.toHaveBeenCalled();
  });

  it('opens the offer directly for an exhausted free account, preserving the dream identity', async () => {
    mockCanAnalyzeNow = false;
    mockQuotaUsage = { analysis: { used: 3, limit: 3, remaining: 0 } };
    mockDreams = [buildDream({ remoteId: 17 })];
    render(<JournalDetailScreen />);
    expect(screen.queryByText('Analyze saved dream')).toBeNull();
    await act(async () => { fireEvent.click(screen.getByText('Discover Plus')); });
    expect(require('expo-router').router.push).toHaveBeenCalledWith({
      pathname: '/paywall',
      params: { trigger: 'analysis_cta', dreamId: '42', dreamRemoteId: '17', dreamClientRequestId: 'persisted-original-42', dreamOwnerId: 'user-1' },
    });
    expect(screen.queryByTestId('quota-limit')).toBeNull();
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    expect(mockUpdateDream).not.toHaveBeenCalled();
  });

  it('waits for quota loading before presenting an upgrade and lets the dream remain accessible', async () => {
    mockQuotaLoading = true;
    mockQuotaUsage = { analysis: { used: 3, limit: 3, remaining: 0 } };
    const view = render(<JournalDetailScreen />);
    expect(screen.queryByText('Discover Plus')).toBeNull();
    expect((screen.getByText('Analyze saved dream') as HTMLButtonElement).disabled).toBe(true);
    mockQuotaLoading = false;
    view.rerender(<JournalDetailScreen />);
    expect(screen.getByText('Discover Plus')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByText('Later')); });
    expect(screen.queryByTestId(TID.Sheet.SavedDreamAnalysis)).toBeNull();
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    expect(mockUpdateDream).not.toHaveBeenCalled();
  });

  it('offers analysis to Plus even while an old free quota is still cached', async () => {
    mockTier = 'plus';
    mockQuotaUsage = { analysis: { used: 3, limit: 3, remaining: 0 } };
    mockCanAnalyzeNow = false;
    render(<JournalDetailScreen />);
    await act(async () => { fireEvent.click(screen.getByText('Analyze saved dream')); });
    expect(mockAnalyzeDream).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Discover Plus')).toBeNull();
  });

  it.each([false, true])('preserves the guest account path (returning device: %s)', async (isUpgraded: boolean) => {
    mockTier = 'guest';
    mockUser = null;
    mockQuotaStatus = { isUpgraded };
    mockQuotaUsage = { analysis: { used: 2, limit: 2, remaining: 0 } };
    render(<JournalDetailScreen />);
    await act(async () => { fireEvent.click(screen.getByText(isUpgraded ? 'Sign in' : 'Create account')); });
    expect(require('expo-router').router.push).toHaveBeenCalledWith('/settings?section=account');
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
  });

  it('verifies unknown access instead of trusting the optimistic canAnalyzeNow default', async () => {
    mockQuotaUsage = undefined;
    mockCanAnalyze.mockRejectedValueOnce(new Error('offline'));
    render(<JournalDetailScreen />);
    await act(async () => { fireEvent.click(screen.getByText('Analyze saved dream')); });
    expect(mockCanAnalyze).toHaveBeenCalledTimes(1);
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('resumes once after purchase when Plus becomes available, preserving any existing image', async () => {
    requestAnalysisReturnRoute({ dreamId: '42', dreamClientRequestId: 'persisted-original-42', dreamOwnerId: 'user-1' }, 'user-1');
    mockSearchParams = { id: '42', analyzeAfterPurchase: '1', analysisOwnerId: 'user-1' };
    const view = render(<JournalDetailScreen />);
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    mockTier = 'plus';
    await act(async () => { view.rerender(<JournalDetailScreen />); });
    expect(mockAnalyzeDream).toHaveBeenCalledTimes(1);
    expect(mockAnalyzeDream).toHaveBeenCalledWith(mockDreams[0], mockDreams[0].transcript, {
      replaceExistingImage: false, lang: 'fr', analyticsSource: 'journal_detail',
    });
    expect(mockSetParams).toHaveBeenCalledWith({ analyzeAfterPurchase: undefined, analysisOwnerId: undefined });
    await act(async () => { view.rerender(<JournalDetailScreen />); });
    expect(mockAnalyzeDream).toHaveBeenCalledTimes(1);
  });

  it('does not launch an analysis from a stale or fabricated purchase URL', async () => {
    mockTier = 'plus';
    mockSearchParams = { id: '42', analyzeAfterPurchase: '1', analysisOwnerId: 'user-1' };
    await act(async () => { render(<JournalDetailScreen />); });
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
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
    expect(screen.getByTestId(TID.Sheet.SavedDreamAnalysis)).toBeTruthy();
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
    await act(async () => { fireEvent.click(screen.getByText('Analyze saved dream')); });
    expect(mockAnalyzeDream).toHaveBeenCalledTimes(1);
    expect(mockTransitionOnboarding).toHaveBeenCalledWith({
      type: 'SET_PENDING_PHASE',
      phase: 'analysis_requested',
      savedDreamId: 42,
    });
    expect(mockTransitionOnboarding).not.toHaveBeenCalledWith({ type: 'CLEAR_PENDING_INTENT' });
    expect(screen.queryByTestId(TID.Sheet.SavedDreamAnalysis)).toBeNull();
  });

  it('persists analysis_requested only after the allowance check succeeds', async () => {
    mockPendingRecordingIntent = { savedDreamId: 42, phase: 'analysis_confirmation' };
    mockCanAnalyzeNow = false;
    let allow!: (value: boolean) => void;
    mockCanAnalyze.mockReturnValueOnce(new Promise<boolean>(resolve => { allow = resolve; }));
    render(<JournalDetailScreen />);
    await act(async () => { fireEvent.click(screen.getByText('Analyze saved dream')); });
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
    setup,
  }: {
    label: string;
    setup: () => void;
  }) => {
    mockPendingRecordingIntent = { savedDreamId: 42, phase: 'analysis_confirmation' };
    setup();
    render(<JournalDetailScreen />);
    await act(async () => { fireEvent.click(screen.getByText('Analyze saved dream')); });
    expect(screen.getByTestId('quota-limit')).toBeTruthy();
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    expect(mockTransitionOnboarding).not.toHaveBeenCalled();
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

  it.each(['Later', 'Dismiss offer'])('keeps the saved dream untouched on %s and does not reopen on rerender', (action: string) => {
    mockPendingRecordingIntent = { savedDreamId: 42, phase: 'analysis_confirmation' };
    const view = render(<JournalDetailScreen />);
    fireEvent.click(screen.getByText(action));
    mockSearchParams = { id: '42' };
    view.rerender(<JournalDetailScreen />);
    expect(screen.queryByTestId(TID.Sheet.SavedDreamAnalysis)).toBeNull();
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    expect(mockUpdateDream).not.toHaveBeenCalled();
    expect(mockTransitionOnboarding).toHaveBeenCalledWith({ type: 'CLEAR_PENDING_INTENT' });
  });

  it.each([
    { params: { id: '42' }, dream: buildDream() },
    { params: { id: '42', saved: '1', recall: '1' }, dream: buildDream() },
    { params: { id: '42', saved: '1' }, dream: buildDream({ isAnalyzed: true, analysisStatus: 'done' }) },
    { params: { id: '42', saved: '1' }, dream: buildDream({ analysisStatus: 'pending', clientUpdatedAt: Date.now() }) },
  ])('does not interrupt a revisit, explicit recall, or existing analysis ($params)', ({ params, dream }: { params: typeof mockSearchParams; dream: DreamAnalysis }) => {
    mockSearchParams = params;
    mockDreams = [dream];
    render(<JournalDetailScreen />);
    expect(screen.queryByTestId(TID.Sheet.SavedDreamAnalysis)).toBeNull();
  });

  it('deduplicates acceptance while quota and analysis are pending', async () => {
    mockCanAnalyzeNow = false;
    let allow!: (value: boolean) => void;
    let finish!: () => void;
    mockCanAnalyze.mockReturnValueOnce(new Promise<boolean>(resolve => { allow = resolve; }));
    mockAnalyzeDream.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
    render(<JournalDetailScreen />);
    const accept = screen.getByText('Analyze saved dream');
    await act(async () => {
      fireEvent.click(accept);
      fireEvent.click(accept);
    });
    expect(mockCanAnalyze).toHaveBeenCalledTimes(1);
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    await act(async () => { allow(true); });
    expect(mockAnalyzeDream).toHaveBeenCalledTimes(1);
    expect((screen.getByTestId(TID.Button.DreamDetailPrimaryCta) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { finish(); });
  });

  it('opens the existing quota sheet without changing the saved dream', async () => {
    mockCanAnalyzeNow = false;
    mockCanAnalyze.mockResolvedValueOnce(false);
    render(<JournalDetailScreen />);
    await act(async () => { fireEvent.click(screen.getByText('Analyze saved dream')); });
    expect(screen.getByTestId('quota-limit')).toBeTruthy();
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    expect(mockUpdateDream).not.toHaveBeenCalled();
  });

  it('shows an analysis failure and leaves the saved transcript available for retry', async () => {
    mockAnalyzeDream.mockImplementationOnce(async () => { throw new Error('Network request failed'); });
    render(<JournalDetailScreen />);
    await act(async () => { fireEvent.click(screen.getByText('Analyze saved dream')); });
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

  it('reveals a newly completed analysis once, but not on a revisit or failed attempt', () => {
    mockDreams = [buildDream({ analysisStatus: 'pending' })];
    const view = render(<JournalDetailScreen />);
    expect(screen.queryByTestId('analysis.reading.modal')).toBeNull();
    mockDreams = [buildDream({ analysisStatus: 'done', isAnalyzed: true, interpretation: 'Reflection' })];
    view.rerender(<JournalDetailScreen />);
    expect(screen.getByTestId('analysis.reading.modal')).toBeTruthy();
    fireEvent.click(screen.getByText('Close reading'));
    view.rerender(<JournalDetailScreen />);
    expect(screen.queryByTestId('analysis.reading.modal')).toBeNull();
    view.unmount();
    const revisit = render(<JournalDetailScreen />);
    expect(screen.queryByTestId('analysis.reading.modal')).toBeNull();
    mockDreams = [buildDream({ analysisStatus: 'pending', isAnalyzed: true, interpretation: 'Old reflection' })];
    revisit.rerender(<JournalDetailScreen />);
    mockDreams = [buildDream({ analysisStatus: 'failed', isAnalyzed: true, interpretation: 'Old reflection' })];
    revisit.rerender(<JournalDetailScreen />);
    expect(screen.queryByTestId('analysis.reading.modal')).toBeNull();
    mockDreams = [buildDream({ analysisStatus: 'pending' })];
    revisit.rerender(<JournalDetailScreen />);
    mockDreams = [buildDream({ analysisStatus: 'done', isAnalyzed: true, interpretation: 'New reflection' })];
    revisit.rerender(<JournalDetailScreen />);
    expect(screen.getByTestId('analysis.reading.modal')).toBeTruthy();
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
    expect(screen.getByText(`“${caption}”`)).toBeTruthy();
    expect(screen.getByText('journal.detail.quote_attribution')).toBeTruthy();
    view.unmount();
    mockDreams = [buildDream({ isAnalyzed: true, analysisStatus: 'done', interpretation: 'Reflection', shareableQuote: '  ' })];
    render(<JournalDetailScreen />);
    expect(screen.queryByText(`“${caption}”`)).toBeNull();
    expect(screen.queryByText('journal.detail.quote_attribution')).toBeNull();
  });

  it('keeps a legacy excerpt without falsely attributing it to Noctalia', () => {
    mockDreams = [buildDream({ isAnalyzed: true, analysisStatus: 'done', interpretation: 'Reflection', shareableQuote: 'I flew over a quiet city' })];
    render(<JournalDetailScreen />);
    expect(screen.getByText('“I flew over a quiet city”')).toBeTruthy();
    expect(screen.queryByText('journal.detail.quote_attribution')).toBeNull();
  });

  it('keeps illustration retry available after the HD quota is exhausted', () => {
    mockTier = 'plus';
    mockDreams = [buildDream({
      isAnalyzed: true,
      analysisStatus: 'done',
      imageGenerationFailed: true,
      imageJobErrorCode: 'HD_IMAGE_QUOTA_EXCEEDED',
    })];
    render(<JournalDetailScreen />);
    expect(screen.getByRole('button', { name: 'settings.illustration.preferences' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry illustration' })).toBeTruthy();
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

  it('does not present the default draft type as a classification and makes missing theme actionable', () => {
    mockDreams = [buildDream({ theme: undefined })];
    render(<JournalDetailScreen />);
    expect(screen.getByTestId(TID.Component.MetadataCard).textContent).not.toContain('Symbolic Dream');
    fireEvent.click(screen.getByRole('button', { name: 'journal.detail.theme_placeholder' }));
    expect(screen.getByTestId(TID.Input.DreamTitle)).toBeTruthy();
  });

  it('names transcript editing actions and cancels without writing the dream', () => {
    render(<JournalDetailScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.EditTranscript));
    expect(screen.getByTestId(TID.Input.DreamTranscript).getAttribute('aria-label')).toBe('recording.placeholder.accessibility');
    expect(screen.getByTestId(TID.Button.EditTranscript).getAttribute('aria-label')).toBe('journal.detail.save_edit');
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
    expect(screen.queryByTestId(TID.Input.DreamTranscript)).toBeNull();
    expect(mockUpdateDream).not.toHaveBeenCalled();
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

  it('shows a visible saved confirmation when the mounted detail has saved=1', () => {
    render(<JournalDetailScreen />);

    expect(screen.getByTestId(TID.Text.RecordingSaveConfirmation).textContent).toBe(
      'recording.save.confirmation'
    );
    expect(mockSetParams).toHaveBeenCalledWith({ saved: undefined });
  });

  it('does not show the confirmation without saved=1', () => {
    mockSearchParams = { id: '42' };
    render(<JournalDetailScreen />);

    expect(screen.queryByTestId(TID.Text.RecordingSaveConfirmation)).toBeNull();
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

  it('keeps analysis as the unique primary CTA before the optional recall offer', () => {
    render(<JournalDetailScreen />);

    const analysis = screen.getByTestId(TID.Button.DreamDetailPrimaryCta);
    const recall = screen.getByTestId(TID.Component.DreamRecallOffer);
    expect(analysis.compareDocumentPosition(recall) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId(TID.Button.DreamRecallStart)).toBeTruthy();
  });

  it('exposes delete as a 44 dp button', () => {
    render(<JournalDetailScreen />);

    const deleteButton = screen.getByTestId(TID.Button.DreamDelete);
    expect(deleteButton.getAttribute('role')).toBe('button');
    expect(deleteButton.className).toContain('min-h-[44px]');
    expect(deleteButton.className).toContain('min-w-[44px]');
  });
});


describe('native share media readiness', () => {
  beforeEach(() => { mockCompositeLoads = true; mockShareComposite.mockClear(); mockRetryMedia.mockClear(); require('react-native').Share.share.mockClear(); });
  afterEach(() => { cleanup(); require('react-native').Platform.OS = 'web'; mockMedia = null; });
  it('keeps sharing pending through delayed signing then shares the composite', async () => {
    require('react-native').Platform.OS = 'android';
    mockDreams = [buildDream({ imageUrl: 'supabase-storage://dream-images/A/image', isAnalyzed: true, analysisStatus: 'done' })];
    mockMedia = { imageUrl: '', loading: true, error: false, retry: mockRetryMedia };
    const { rerender } = render(<JournalDetailScreen />);
    expect((screen.getByTestId(TID.Button.DreamShare) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId(TID.Button.DreamShare));
    expect(require('react-native').Share.share).not.toHaveBeenCalled();
    mockMedia = { imageUrl: 'https://signed/image', loading: false, error: false, retry: mockRetryMedia };
    rerender(<JournalDetailScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.DreamShare));
    expect(mockShareComposite).toHaveBeenCalled();
    expect(require('react-native').Share.share).not.toHaveBeenCalled();
  });
  it('retries the same resolved URL after composite image failure', () => {
    require('react-native').Platform.OS = 'android';
    mockDreams = [buildDream({ imageUrl: 'https://cdn/image', isAnalyzed: true, analysisStatus: 'done' })];
    mockMedia = { imageUrl: 'https://cdn/image', loading: false, error: false, retry: mockRetryMedia };
    mockCompositeLoads = false;
    render(<JournalDetailScreen />);
    expect((screen.getByTestId(TID.Button.DreamShare) as HTMLButtonElement).disabled).toBe(false);
    mockCompositeLoads = true;
    fireEvent.click(screen.getByTestId(TID.Button.DreamShare));
    expect(mockRetryMedia).toHaveBeenCalledTimes(1);
    expect((screen.getByTestId(TID.Button.DreamShare) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByTestId(TID.Button.DreamShare));
    expect(mockShareComposite).toHaveBeenCalledTimes(1);
    expect(require('react-native').Share.share).not.toHaveBeenCalled();
  });
  it('offers retry on media failure without silently sharing text', () => {
    require('react-native').Platform.OS = 'android';
    mockDreams = [buildDream({ imageUrl: 'supabase-storage://dream-images/A/image', isAnalyzed: true, analysisStatus: 'done' })];
    mockMedia = { imageUrl: '', loading: false, error: true, retry: mockRetryMedia };
    render(<JournalDetailScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.DreamShare));
    expect(mockRetryMedia).toHaveBeenCalled();
    expect(require('react-native').Share.share).not.toHaveBeenCalled();
  });
});


it('preserves intentional native text sharing when the dream has no media', () => {
  require('react-native').Platform.OS = 'android';
  require('react-native').Share.share.mockClear();
  mockDreams = [buildDream({ isAnalyzed: true, analysisStatus: 'done' })];
  mockMedia = { imageUrl: '', loading: false, error: false, retry: mockRetryMedia };
  try {
    render(<JournalDetailScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.DreamShare));
    expect(require('react-native').Share.share).toHaveBeenCalled();
  } finally { cleanup(); require('react-native').Platform.OS = 'web'; mockMedia = null; }
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
