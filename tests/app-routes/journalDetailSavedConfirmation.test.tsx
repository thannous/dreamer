/* @jest-environment jsdom */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { DreamAnalysis } from '@/lib/types';
import { TID } from '@/lib/testIDs';

const mockSetParams = jest.fn();
let mockSearchParams: { id: string; saved?: string | string[] } = { id: '42', saved: '1' };
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
    ActivityIndicator: createElement('div'),
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
    testID,
  }: {
    accessibilityLabel?: string;
    accessibilityRole?: string;
    children?: React.ReactNode;
    className?: string;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button
      aria-label={accessibilityLabel}
      className={className}
      data-testid={testID}
      onClick={onPress}
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
  DreamShareImage: () => null,
}));

jest.mock('@/components/journal/ImageRetry', () => ({
  ImageRetry: () => null,
}));

jest.mock('@/components/journal/JournalDetailSheets', () => ({
  AnalysisNoticeSheet: () => null,
  DeleteConfirmSheet: () => null,
  ImageErrorSheet: () => null,
  QuotaLimitSheet: () => null,
  ReanalyzeSheet: () => null,
  ReferenceImageSheet: () => null,
  ReplaceImageSheet: () => null,
}));

jest.mock('@/components/journal/DreamRecallAssistantCard', () => ({
  DreamRecallAssistantCard: ({
    offerEligible,
  }: {
    offerEligible?: boolean;
  }) =>
    offerEligible ? (
      <div data-testid="component.dreamRecall.offer">
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
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('@/context/DreamsContext', () => ({
  useDreams: () => ({
    dreams: mockDreams,
    toggleFavorite: jest.fn(),
    updateDream: jest.fn(),
    deleteDream: jest.fn(),
    retryDreamSync: jest.fn(),
    resolveDreamConflict: jest.fn(),
    generateDreamImage: jest.fn(),
    analyzeDream: jest.fn(),
  }),
}));

jest.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({ language: 'fr' }),
}));

jest.mock('@/context/OnboardingContext', () => ({
  useOnboarding: () => ({
    state: {
      pendingRecordingIntent: null,
      completionReason: null,
    },
    transition: jest.fn(),
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
    shareComposite: jest.fn(),
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
    canAnalyzeNow: true,
    canAnalyze: true,
    canGenerateImageNow: true,
    tier: 'free',
    usage: { analysis: { used: 0, limit: 3, remaining: 3 } },
    loading: false,
    quotaStatus: null,
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
  isMockModeEnabled: () => true,
  isReferenceImagesEnabled: () => false,
}));

jest.mock('@/lib/analytics', () => ({
  trackProductEvent: jest.fn(),
}));

jest.mock('@/services/geminiService', () => ({
  categorizeDream: jest.fn(),
  generateImageWithReference: jest.fn(),
}));

const { default: JournalDetailScreen } = require('@/app/journal/[id]');

describe('journal detail saved confirmation route', () => {
  beforeEach(() => {
    mockSetParams.mockReset();
    mockSearchParams = { id: '42', saved: '1' };
    mockDreams = [buildDream()];
  });

  afterEach(() => {
    cleanup();
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
