/* @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { DreamAnalysis } from '@/lib/types';
import { TID } from '@/lib/testIDs';

const mockAddDream = jest.fn();
const mockAnalyzeDream = jest.fn();
const mockAnalysisSetStep = jest.fn();
const mockApplyDreamCategorization = jest.fn();
const mockCategorizeDream = jest.fn();
const mockForceStopRecording = jest.fn();
const mockGetInputModePreference = jest.fn();
const mockGetSavedTranscript = jest.fn(async (): Promise<string> => '');
const mockSaveTranscript = jest.fn(async (_value: string): Promise<void> => undefined);
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => false);
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSaveInputModePreference = jest.fn();
const mockStartRecording = jest.fn();
const mockStopRecording = jest.fn();
const mockTrackProductEvent = jest.fn().mockResolvedValue(undefined);

let mockCurrentUser: { id: string } | null = { id: 'user-1' };
let mockDreams: DreamAnalysis[] = [];
let mockPendingRecordingIntent: {
  entryId: string;
  savedDreamId: number;
  phase: string;
} | null = null;
let mockTransitionOnboarding = jest.fn().mockResolvedValue(undefined);
let mockPlatformOS: 'android' | 'web' = 'web';
let mockRecordingPermissionState: 'unknown' | 'granted' | 'denied' = 'unknown';
let mockReferenceImagesEnabled = false;
let mockViewportWidth = 390;
let mockOnPartialTranscript: ((text: string) => void) | undefined;

const buildDream = (transcript: string, id = 42): DreamAnalysis => ({
  id,
  transcript,
  title: 'Dream',
  interpretation: '',
  shareableQuote: '',
  imageUrl: '',
  dreamType: 'Symbolic Dream',
  theme: 'calm',
  isAnalyzed: false,
  analysisStatus: 'none',
  chatHistory: [],
});

jest.doMock('expo-router', () => ({
  router: {
    back: mockBack,
    canGoBack: mockCanGoBack,
    push: mockPush,
    replace: mockReplace,
    setParams: jest.fn(),
  },
  useFocusEffect: () => {},
  useLocalSearchParams: () => ({}),
}));

jest.doMock('react-native', () => {
  const React = require('react');
  const createElement = (tag: string) => {
    const MockNativeElement = React.forwardRef(
      (
        {
          children,
          onLayout: _onLayout,
          pointerEvents: _pointerEvents,
          style: _style,
          testID,
          ...props
        }: {
          children?: React.ReactNode;
          onLayout?: unknown;
          pointerEvents?: unknown;
          style?: unknown;
          testID?: string;
          [key: string]: any;
        },
        ref: React.ForwardedRef<HTMLElement>
      ) => React.createElement(tag, { ...props, 'data-testid': testID, ref }, children)
    );
    MockNativeElement.displayName = `MockNative${tag}`;
    return MockNativeElement;
  };
  const MockScrollView = React.forwardRef(
    (
      {
        children,
        contentContainerStyle: _contentContainerStyle,
        keyboardShouldPersistTaps: _keyboardShouldPersistTaps,
        style: _style,
        testID,
        ...props
      }: {
        children?: React.ReactNode;
        contentContainerStyle?: unknown;
        keyboardShouldPersistTaps?: unknown;
        style?: unknown;
        testID?: string;
        [key: string]: any;
      },
      ref: React.ForwardedRef<{ scrollToEnd: () => void }>
    ) => {
      React.useImperativeHandle(ref, () => ({ scrollToEnd: jest.fn() }));
      return (
        <div {...props} data-testid={testID}>
          {children}
        </div>
      );
    }
  );
  MockScrollView.displayName = 'MockScrollView';

  const MockPressable = React.forwardRef(
    (
      {
        children,
        onPress,
        testID,
        accessibilityLabel,
        ...props
      }: {
        children?: React.ReactNode;
        onPress?: () => void;
        testID?: string;
        accessibilityLabel?: string;
        [key: string]: unknown;
      },
      ref: React.ForwardedRef<HTMLButtonElement>
    ) =>
      React.createElement(
        'button',
        {
          ...props,
          'aria-label': accessibilityLabel,
          'data-testid': testID,
          onClick: onPress,
          ref,
          type: 'button',
        },
        children
      )
  );
  MockPressable.displayName = 'MockPressable';

  return {
    __esModule: true,
    Alert: { alert: jest.fn() },
    AppState: {
      addEventListener: () => ({ remove: jest.fn() }),
    },
    Keyboard: {
      addListener: () => ({ remove: jest.fn() }),
      dismiss: jest.fn(),
    },
    KeyboardAvoidingView: createElement('div'),
    Pressable: MockPressable,
    Platform: {
      get OS() {
        return mockPlatformOS;
      },
      select: (values: Record<string, any>) =>
        values?.[mockPlatformOS] ?? values?.default,
    },
    ScrollView: MockScrollView,
    StyleSheet: {
      absoluteFill: {},
      create: <T extends Record<string, any>>(styles: T) => styles,
      hairlineWidth: 1,
    },
    TextInput: createElement('textarea'),
    View: createElement('div'),
    useWindowDimensions: () => ({
      width: mockViewportWidth,
      height: 844,
      scale: 1,
      fontScale: 1,
    }),
  };
});

jest.doMock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.doMock('expo-linear-gradient', () => ({
  LinearGradient: () => <div data-testid="recording-gradient" />,
}));

jest.doMock('@/components/analysis/AnalysisProgress', () => ({
  AnalysisProgress: () => <div data-testid="analysis-progress" />,
}));

jest.doMock('@/components/analysis/AnalysisRevealOverlay', () => ({
  ANALYSIS_REVEAL_HOLD_MS: 0,
  AnalysisRevealOverlay: ({ visible }: { visible: boolean }) =>
    visible ? <div data-testid="analysis-reveal-overlay" /> : null,
}));

jest.doMock('@/components/dev/MockNavigationRail', () => ({
  MockNavigationRail: () => null,
}));

jest.doMock('@/components/journal/SubjectProposition', () => ({
  SubjectProposition: ({ subjectType }: { subjectType: 'person' | 'animal' }) => (
    <div data-testid="subject-proposition" data-subject-type={subjectType} />
  ),
}));

jest.doMock('@/components/navigation/NoctaliaBottomNav', () => ({
  NoctaliaBottomNav: () => <div data-testid="recording-bottom-nav" />,
}));

jest.doMock('@/components/recording/AtmosphereBackground', () => ({
  AtmosphereBackground: () => null,
}));

jest.doMock('@/components/recording/OfflineModelDownloadSheet', () => ({
  OfflineModelDownloadSheet: () => null,
}));

jest.doMock('@/components/recording/RecordingOnboardingSpotlightOverlay', () => ({
  RecordingOnboardingSpotlightOverlay: () => null,
}));

jest.doMock('@/components/recording/RecordingOnboardingTour', () => ({
  RecordingOnboardingTour: () => null,
}));

jest.doMock('@/components/recording/RecordingInputModeSelect', () => ({
  RecordingInputModeSelect: ({
    onChange,
    value,
  }: {
    onChange: (value: 'text' | 'voice') => void;
    value: 'text' | 'voice';
  }) => (
    <div data-testid="recording-mode" data-value={value}>
      <button data-testid="recording-mode-text" onClick={() => onChange('text')}>
        Text
      </button>
      <button data-testid="recording-mode-voice" onClick={() => onChange('voice')}>
        Voice
      </button>
    </div>
  ),
}));

jest.doMock('@/components/recording/RecordingTextInput', () => {
  const React = require('react');
  const RecordingTextInput = React.forwardRef(
    (
      {
        layout,
        onChange,
        onSwitchToVoice,
        value,
      }: {
        layout: string;
        onChange: (value: string) => void;
        onSwitchToVoice: () => void;
        value: string;
      },
      _ref: React.ForwardedRef<unknown>
    ) => (
      <div data-layout={layout} data-testid="recording-composer">
        <textarea
          data-testid={TID.Input.DreamTranscript}
          onChange={(event) => onChange(event.currentTarget.value)}
          value={value}
        />
        <button data-testid="recording-voice-control" onClick={onSwitchToVoice}>
          Voice
        </button>
      </div>
    )
  );
  RecordingTextInput.displayName = 'MockRecordingTextInput';
  return { RecordingTextInput };
});

jest.doMock('@/components/recording/RecordingFooter', () => ({
  RecordingFooter: ({
    isSaveDisabled,
    onSave,
  }: {
    isSaveDisabled: boolean;
    onSave: () => void;
  }) => (
    <button data-testid="recording-save" disabled={isSaveDisabled} onClick={onSave}>
      Save
    </button>
  ),
}));

jest.doMock('@/components/recording/RecordingSheets', () => ({
  AnalyzePromptSheet: () => null,
  FirstDreamSheet: ({
    onAnalyze,
    onJournal,
    visible,
  }: {
    onAnalyze: () => void;
    onJournal: () => void;
    visible: boolean;
  }) =>
    visible ? (
      <div data-testid="first-dream-sheet">
        <button data-testid="first-dream-analyze" onClick={onAnalyze}>
          Analyze
        </button>
        <button data-testid="first-dream-journal" onClick={onJournal}>
          Journal
        </button>
      </div>
    ) : null,
  MicPermissionRationaleSheet: ({
    onAllow,
    onUseText,
    visible,
  }: {
    onAllow: () => void;
    onUseText: () => void;
    visible: boolean;
  }) =>
    visible ? (
      <div data-testid="mic-rationale">
        <button data-testid="mic-rationale-allow" onClick={onAllow}>
          Allow
        </button>
        <button data-testid="mic-rationale-text" onClick={onUseText}>
          Use text
        </button>
      </div>
    ) : null,
  PostSaveOfferSheet: () => null,
  QuotaLimitSheet: () => null,
  ReferenceImageSheet: () => null,
}));

jest.doMock('@/components/recording/RememberedDreamProfileChips', () => ({
  RememberedDreamProfileChips: () => null,
}));

jest.doMock('@/components/Toast', () => ({
  Toast: ({ message, testID }: { message: string; testID?: string }) => (
    <div data-testid={testID}>{message}</div>
  ),
}));

jest.doMock('@/components/ui/StandardBottomSheet', () => ({
  StandardBottomSheet: () => null,
}));

jest.doMock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

jest.doMock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockCurrentUser }),
}));

jest.doMock('@/context/DreamsContext', () => ({
  useDreams: () => ({
    addDream: mockAddDream,
    analyzeDream: mockAnalyzeDream,
    applyDreamCategorization: mockApplyDreamCategorization,
    dreams: mockDreams,
    reloadDreams: jest.fn(),
    updateDream: jest.fn(),
  }),
}));

jest.doMock('@/context/LanguageContext', () => ({
  useLanguage: () => ({ language: 'fr' }),
}));

jest.doMock('@/context/OnboardingContext', () => ({
  useOnboarding: () => ({
    scope: 'guest',
    state: {
      status: 'in_progress',
      step: 'intro',
      selectedPath: null,
      completionReason: null,
      pendingRecordingIntent: mockPendingRecordingIntent,
      completedAt: null,
    },
    transition: mockTransitionOnboarding,
  }),
}));

jest.doMock('@/context/ThemeContext', () => ({
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
  }),
}));

jest.doMock('@/hooks/useAnalysisProgress', () => ({
  AnalysisStep: {
    IDLE: 'idle',
    ANALYZING: 'analyzing',
    GENERATING_IMAGE: 'generating_image',
    FINALIZING: 'finalizing',
    COMPLETE: 'complete',
    ERROR: 'error',
  },
  useAnalysisProgress: () => ({
    error: null,
    message: '',
    progress: 0,
    reset: jest.fn(),
    setError: jest.fn(),
    setStep: mockAnalysisSetStep,
    step: 'idle',
  }),
}));

jest.doMock('@/hooks/useQuota', () => ({
  useQuota: () => ({
    canAnalyzeNow: true,
    error: null,
    loading: false,
    quotaStatus: null,
    tier: 'free',
    usage: { analysis: { used: 0, limit: 3, remaining: 3 } },
  }),
}));

jest.doMock('@/hooks/useRecordingSession', () => ({
  useRecordingSession: ({
    onPartialTranscript,
  }: {
    onPartialTranscript?: (text: string) => void;
  }) => {
    mockOnPartialTranscript = onPartialTranscript;
    return {
      forceStopRecording: mockForceStopRecording,
      isRecording: false,
      isRecordingRef: { current: false },
      recordingPermissionState: mockRecordingPermissionState,
      startRecording: mockStartRecording,
      stopRecording: mockStopRecording,
    };
  },
}));

jest.doMock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.doMock('@/lib/accessibility', () => ({
  blurActiveElement: jest.fn(),
}));

jest.doMock('@/lib/auth', () => ({
  signOut: jest.fn(),
}));

jest.doMock('@/lib/activationAnalytics', () => ({
  buildFirstValueProperties: () => ({}),
}));

jest.doMock('@/lib/analysisRequest', () => ({
  isResumableAnalysisRequest: () => false,
}));

jest.doMock('@/lib/analytics', () => ({
  getRecordingDurationBucket: () => 'none',
  getTranscriptLengthBucket: () => 'short',
  getTranscriptLengthBucketFromLength: () => 'short',
  trackProductEvent: mockTrackProductEvent,
}));

jest.doMock('@/lib/dreamUtils', () => ({
  buildDraftDream: (transcript: string) => buildDream(transcript, 1),
  buildRememberedDream: (transcript: string) => buildDream(transcript, 1),
}));

jest.doMock('@/lib/env', () => ({
  isMockModeEnabled: () => false,
  isReferenceImagesEnabled: () => mockReferenceImagesEnabled,
}));

jest.doMock('@/lib/locale', () => ({
  getTranscriptionLocale: () => 'fr-FR',
}));

jest.doMock('@/lib/logger', () => ({
  createScopedLogger: () => ({
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

jest.doMock('@/lib/onboardingState', () => ({
  parseRecordingRouteParams: () => ({
    entryId: null,
    intent: null,
    mode: null,
    postSave: null,
    replayGuide: false,
    source: null,
  }),
  resolvePendingAnalysisRestart: () => 'none',
  resolveRecordingEntryIntent: () => null,
}));

jest.doMock('@/lib/paywallRoute', () => ({
  buildPaywallHref: () => '/paywall',
}));

jest.doMock('@/lib/recordingActivation', () => ({
  resolveRememberedCaptureSource: () => 'journal',
}));

jest.doMock('@/lib/recordingDraftProgress', () => ({
  isTranscriptSaveable: (transcript: string) => transcript.trim().length > 0,
  getRecordingDraftProgress: (transcript: string) => ({
    state: transcript.trim() ? 'ready' : 'empty',
  }),
}));

jest.doMock('@/lib/recordingActivationInsight', () => ({
  getRecordingActivationInsight: () => null,
}));

jest.doMock('@/lib/transcriptMerge', () => ({
  combineTranscript: ({ addition, base }: { addition: string; base: string }) => ({
    text: [base, addition].filter(Boolean).join(' '),
    truncated: false,
  }),
}));

jest.doMock('@/services/geminiService', () => ({
  categorizeDream: mockCategorizeDream,
  generateImageWithReference: jest.fn(),
}));

jest.doMock('@/services/nativeSpeechRecognition', () => ({
  registerOfflineModelPromptHandler: () => jest.fn(),
  resolveDeviceSpeechCapability: jest.fn().mockResolvedValue({
    tier: 'on_device',
    reason: 'locale_installed',
    requiresOnDeviceRecognition: true,
    localAlternatives: [],
  }),
}));

jest.doMock('@/services/storageService', () => ({
  getRecordingInputModePreference: mockGetInputModePreference,
  getRecordingVoiceHintCompleted: jest.fn().mockResolvedValue(true),
  getSavedTranscript: mockGetSavedTranscript,
  saveRecordingInputModePreference: mockSaveInputModePreference,
  saveRecordingVoiceHintCompleted: jest.fn().mockResolvedValue(undefined),
  saveTranscript: mockSaveTranscript,
}));

const { default: RecordingScreen } = require('@/app/recording');

describe('Recording screen', () => {
  beforeEach(() => {
    mockCurrentUser = { id: 'user-1' };
    mockDreams = [];
    mockPendingRecordingIntent = null;
    mockTransitionOnboarding = jest.fn().mockResolvedValue(undefined);
    mockPlatformOS = 'web';
    mockRecordingPermissionState = 'unknown';
    mockReferenceImagesEnabled = false;
    mockViewportWidth = 390;
    mockOnPartialTranscript = undefined;
    mockGetSavedTranscript.mockReset();
    mockSaveTranscript.mockReset();
    mockGetSavedTranscript.mockResolvedValue('');
    mockSaveTranscript.mockResolvedValue(undefined);
    mockAddDream.mockImplementation(async (dream: DreamAnalysis) => ({ ...dream, id: 42 }));
    mockAnalyzeDream.mockImplementation(async (id: number, transcript: string) => ({
      ...buildDream(transcript, id),
      isAnalyzed: true,
      analysisStatus: 'done',
    }));
    mockApplyDreamCategorization.mockResolvedValue(null);
    mockCategorizeDream.mockResolvedValue({
      dreamType: 'Symbolic Dream',
      theme: 'calm',
      title: 'Dream',
    });
    mockForceStopRecording.mockResolvedValue(undefined);
    mockGetInputModePreference.mockResolvedValue('text');
    mockSaveInputModePreference.mockResolvedValue(undefined);
    mockStartRecording.mockResolvedValue({ success: true });
    mockStopRecording.mockResolvedValue({ transcript: '' });
    mockCanGoBack.mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('starts voice capture only after the first permission rationale is accepted', async () => {
    render(<RecordingScreen />);

    fireEvent.click(screen.getByTestId('recording-voice-control'));

    expect(await screen.findByTestId('mic-rationale')).toBeTruthy();
    expect(mockStartRecording).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('mic-rationale-allow'));

    await waitFor(() => {
      expect(mockStartRecording).toHaveBeenCalledTimes(1);
      expect(mockStartRecording).toHaveBeenCalledWith('');
    });
  });

  it('keeps capture navigation available on a wide Android window', () => {
    mockPlatformOS = 'android';
    mockViewportWidth = 1280;

    render(<RecordingScreen />);

    expect(screen.getByTestId('recording-bottom-nav')).toBeTruthy();
    expect(screen.queryByTestId(TID.Button.RecordingHome)).toBeNull();
  });

  it('keeps capture navigation hidden on desktop Web', () => {
    mockPlatformOS = 'web';
    mockViewportWidth = 1280;

    render(<RecordingScreen />);

    expect(screen.queryByTestId('recording-bottom-nav')).toBeNull();
    expect(screen.getByTestId(TID.Button.RecordingHome)).toBeTruthy();
  });

  it('returns to tabs from desktop capture when the stack cannot go back', () => {
    mockPlatformOS = 'web';
    mockViewportWidth = 1280;
    mockCanGoBack.mockReturnValue(false);

    render(<RecordingScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.RecordingHome));

    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  it('pops capture on desktop Web when the stack can go back', () => {
    mockPlatformOS = 'web';
    mockViewportWidth = 1280;
    mockCanGoBack.mockReturnValue(true);

    render(<RecordingScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.RecordingHome));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('keeps a voice failure visible until the user explicitly switches to text', async () => {
    mockGetInputModePreference.mockResolvedValue('voice');
    mockStartRecording.mockResolvedValue({ success: false, error: 'permission_denied' });
    render(<RecordingScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('recording-mode').getAttribute('data-value')).toBe('voice');
    });

    fireEvent.click(screen.getByTestId('recording-voice-control'));
    fireEvent.click(await screen.findByTestId('mic-rationale-allow'));

    expect(await screen.findByTestId(TID.Text.RecordingFallbackNotice)).toBeTruthy();
    expect(screen.getByTestId('recording-composer').getAttribute('data-layout')).toBe('voiceFirst');

    fireEvent.click(screen.getByTestId('recording-mode-text'));

    await waitFor(() => {
      expect(screen.getByTestId('recording-composer').getAttribute('data-layout')).toBe('textFirst');
      expect(mockSaveInputModePreference).toHaveBeenCalledWith('text', 'guest');
    });
  });

  it('keeps the save button visible and disabled for empty or whitespace drafts', () => {
    render(<RecordingScreen />);

    const saveButton = screen.getByTestId('recording-save') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);

    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), {
      target: { value: '   ' },
    });

    expect(screen.getByTestId('recording-save')).toBeTruthy();
    expect((screen.getByTestId('recording-save') as HTMLButtonElement).disabled).toBe(true);
    expect(mockAddDream).not.toHaveBeenCalled();
  });

  it.each([601, 1200] as const)(
    'keeps a typed transcript of %s characters intact when saving',
    async (length: 601 | 1200) => {
      const longTranscript = 'a'.repeat(length);
      render(<RecordingScreen />);

      fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), {
        target: { value: longTranscript },
      });

      const saveButton = screen.getByTestId('recording-save') as HTMLButtonElement;
      expect(saveButton.disabled).toBe(false);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockAddDream).toHaveBeenCalledWith(
          expect.objectContaining({ transcript: longTranscript })
        );
      });
    }
  );

  it.each(['maman', 'Porte rouge', 'loup blanc'] as const)(
    'keeps the save button visible and enabled for the short fragment %s',
    async (fragment: 'maman' | 'Porte rouge' | 'loup blanc') => {
      render(<RecordingScreen />);

      expect(screen.getByTestId('recording-save')).toBeTruthy();

      fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), {
        target: { value: fragment },
      });

      const saveButton = screen.getByTestId('recording-save') as HTMLButtonElement;
      expect(saveButton.disabled).toBe(false);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockAddDream).toHaveBeenCalledWith(
          expect.objectContaining({ transcript: fragment })
        );
      });
    }
  );

  it('saves a dream without launching analysis or illustration', async () => {
    let resolveCategorize: ((value: { title: string; theme: string; dreamType: string }) => void) | undefined;
    mockCategorizeDream.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCategorize = resolve;
        })
    );
    render(<RecordingScreen />);

    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), {
      target: { value: 'A blue room under the rain' },
    });
    fireEvent.click(await screen.findByTestId('recording-save'));

    await waitFor(() => {
      expect(mockAddDream).toHaveBeenCalledWith(
        expect.objectContaining({ transcript: 'A blue room under the rain' })
      );
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/journal/[id]',
        params: { id: '42', saved: '1' },
      });
      expect(screen.queryByTestId(TID.Text.RecordingSaveConfirmation)).toBeNull();
    });

    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.queryByTestId('first-dream-sheet')).toBeNull();
    expect(mockCategorizeDream).toHaveBeenCalledWith('A blue room under the rain', 'fr');
    resolveCategorize?.({ title: 'Rain Room', theme: 'calm', dreamType: 'Symbolic Dream' });
  });

  it('opens the saved dream immediately after a successful save', async () => {
    render(<RecordingScreen />);

    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), {
      target: { value: 'A blue room under the rain' },
    });
    fireEvent.click(await screen.findByTestId('recording-save'));

    await waitFor(() => {
      expect(mockAddDream).toHaveBeenCalledWith(
        expect.objectContaining({ transcript: 'A blue room under the rain' })
      );
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/journal/[id]',
        params: { id: '42', saved: '1' },
      });
    });

    expect(screen.queryByTestId('first-dream-sheet')).toBeNull();
    expect(screen.queryByTestId('btn.guestLimit.cta')).toBeNull();
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
  });

  it('does not open reference photos or analysis after saving an animal dream', async () => {
    mockReferenceImagesEnabled = true;
    mockAddDream.mockImplementation(async (dream: DreamAnalysis) => ({
      ...dream,
      id: 42,
      hasAnimal: true,
      hasPerson: false,
    }));
    render(<RecordingScreen />);

    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), {
      target: { value: 'A fox waits beside a frozen lake' },
    });
    fireEvent.click(await screen.findByTestId('recording-save'));

    await waitFor(() => {
      expect(mockAddDream).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/journal/[id]',
        params: { id: '42', saved: '1' },
      });
    });

    expect(screen.queryByTestId('subject-proposition')).toBeNull();
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
  });

  it('restores a saved draft into the editor after remount', async () => {
    let stored = 'a remembered dream';
    mockGetSavedTranscript.mockImplementation(async () => stored);
    mockSaveTranscript.mockImplementation(async (value: string) => {
      stored = value;
    });

    const { unmount } = render(<RecordingScreen />);
    await waitFor(() => {
      expect(
        (screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value
      ).toBe('a remembered dream');
    });
    unmount();

    render(<RecordingScreen />);
    await waitFor(() => {
      expect(
        (screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value
      ).toBe('a remembered dream');
    });
    expect(mockSaveTranscript).not.toHaveBeenCalledWith('');
  });

  it.each([601, 10_000] as const)(
    'autosaves a typed transcript of %s characters intact',
    async (length: 601 | 10_000) => {
      const longTranscript = 'a'.repeat(length);
      render(<RecordingScreen />);

      fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), {
        target: { value: longTranscript },
      });

      await waitFor(() => {
        expect(mockSaveTranscript).toHaveBeenCalledWith(longTranscript);
        expect(mockSaveTranscript.mock.calls.at(-1)?.[0]).toHaveLength(length);
      });
    }
  );

  it('autosaves a voice-updated transcript', async () => {
    render(<RecordingScreen />);

    await waitFor(() => {
      expect(mockOnPartialTranscript).toEqual(expect.any(Function));
    });

    act(() => {
      mockOnPartialTranscript?.('dictated scene beside the lake');
    });

    await waitFor(() => {
      expect(mockSaveTranscript).toHaveBeenCalledWith('dictated scene beside the lake');
      expect(
        (screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value
      ).toBe('dictated scene beside the lake');
    });
  });

  it('keeps the durable draft when addDream fails', async () => {
    mockAddDream.mockRejectedValue(new Error('journal write failed'));
    render(<RecordingScreen />);

    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), {
      target: { value: 'keep this draft' },
    });

    await waitFor(() => {
      expect(mockSaveTranscript).toHaveBeenCalledWith('keep this draft');
    });

    fireEvent.click(await screen.findByTestId('recording-save'));

    await waitFor(() => {
      expect(mockAddDream).toHaveBeenCalled();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    expect(mockSaveTranscript).not.toHaveBeenCalledWith('');
    expect(
      (screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value
    ).toBe('keep this draft');
  });

  it('clears the durable draft exactly once after addDream succeeds', async () => {
    render(<RecordingScreen />);

    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), {
      target: { value: 'persist then clear' },
    });

    await waitFor(() => {
      expect(mockSaveTranscript).toHaveBeenCalledWith('persist then clear');
    });

    fireEvent.click(await screen.findByTestId('recording-save'));

    await waitFor(() => {
      expect(mockAddDream).toHaveBeenCalledWith(
        expect.objectContaining({ transcript: 'persist then clear' })
      );
      expect(mockSaveTranscript).toHaveBeenCalledWith('');
    });

    const callsAfterClear = mockSaveTranscript.mock.calls.length;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    expect(mockSaveTranscript.mock.calls.length).toBe(callsAfterClear);
    expect(mockSaveTranscript.mock.calls.filter((call: [string]) => call[0] === '').length).toBe(1);
    expect(mockSaveTranscript.mock.calls.at(-1)?.[0]).toBe('');
  });

  it('saves guest dreams without a journal recording limit or GuestLimitSheet', async () => {
    mockCurrentUser = null;
    mockDreams = [
      buildDream('already saved 1', 1),
      buildDream('already saved 2', 2),
      buildDream('already saved 3', 3),
    ];
    render(<RecordingScreen />);

    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), {
      target: { value: 'fourth guest dream' },
    });

    fireEvent.click(await screen.findByTestId('recording-save'));

    await waitFor(() => {
      expect(mockAddDream).toHaveBeenCalledWith(
        expect.objectContaining({ transcript: 'fourth guest dream' })
      );
    });

    expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/journal/[id]',
        params: { id: '42', saved: '1' },
      });
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
    expect(screen.queryByTestId('first-dream-sheet')).toBeNull();
    expect(screen.queryByTestId('btn.guestLimit.cta')).toBeNull();
    expect(screen.queryByTestId('btn.guestLimit.backToText')).toBeNull();
    expect(screen.queryByText(/limit reached|limite atteinte|límite alcanzado/i)).toBeNull();
  });

  it('resumes a pending saved dream on the journal detail screen', async () => {
    mockPendingRecordingIntent = {
      entryId: 'pending-entry',
      savedDreamId: 42,
      phase: 'analysis_confirmation',
    };
    mockDreams = [buildDream('already saved pending dream', 42)];
    const { rerender } = render(<RecordingScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/journal/[id]',
        params: { id: '42' },
      });
    });
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockTransitionOnboarding).not.toHaveBeenCalledWith({ type: 'CLEAR_PENDING_INTENT' });

    mockDreams = [buildDream('already saved pending dream', 42)];
    mockPendingRecordingIntent = {
      entryId: 'pending-entry',
      savedDreamId: 42,
      phase: 'analysis_confirmation',
    };
    rerender(<RecordingScreen />);

    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockTransitionOnboarding).not.toHaveBeenCalledWith({ type: 'CLEAR_PENDING_INTENT' });
    expect(screen.queryByTestId('first-dream-sheet')).toBeNull();
  });

  it('lets typing win over a late restored draft', async () => {
    let resolveGet: ((value: string) => void) | undefined;
    mockGetSavedTranscript.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveGet = resolve;
        })
    );

    render(<RecordingScreen />);

    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), {
      target: { value: 'typed while loading' },
    });

    await act(async () => {
      resolveGet?.('saved draft from disk');
      await Promise.resolve();
    });

    expect(
      (screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value
    ).toBe('typed while loading');

    await waitFor(() => {
      expect(mockSaveTranscript).toHaveBeenCalledWith('typed while loading');
    });
    expect(mockSaveTranscript).not.toHaveBeenCalledWith('saved draft from disk');
  });

  it('does not erase stored content during the initial empty render', async () => {
    let resolveGet: ((value: string) => void) | undefined;
    mockGetSavedTranscript.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveGet = resolve;
        })
    );

    render(<RecordingScreen />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(mockSaveTranscript).not.toHaveBeenCalled();
    expect(
      (screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value
    ).toBe('');

    await act(async () => {
      resolveGet?.('stored dream');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        (screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value
      ).toBe('stored dream');
    });
    expect(mockSaveTranscript).not.toHaveBeenCalled();
  });

  it('keeps a single shared draft when switching Write -> Tell -> Write', async () => {
    render(<RecordingScreen />);

    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), {
      target: { value: 'A blue room under the rain' },
    });

    fireEvent.click(screen.getByTestId('recording-mode-voice'));
    await waitFor(() => {
      expect(screen.getByTestId('recording-composer').getAttribute('data-layout')).toBe('voiceFirst');
    });
    expect(
      (screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value
    ).toBe('A blue room under the rain');

    fireEvent.click(screen.getByTestId('recording-mode-text'));
    await waitFor(() => {
      expect(screen.getByTestId('recording-composer').getAttribute('data-layout')).toBe('textFirst');
    });
    expect(
      (screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value
    ).toBe('A blue room under the rain');
    expect(screen.getAllByTestId(TID.Input.DreamTranscript)).toHaveLength(1);
  });

  it('does not render the retired hamburger capture tour', () => {
    render(<RecordingScreen />);

    expect(screen.queryByTestId(TID.Component.RecordingOnboardingTour)).toBeNull();
  });
});
