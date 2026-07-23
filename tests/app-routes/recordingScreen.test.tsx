/* @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { DreamAnalysis } from '@/lib/types';
import { TID } from '@/lib/testIDs';

const mockAddDream = jest.fn();
const mockApplyDreamCategorization = jest.fn();
const mockCategorizeDream = jest.fn();
const mockForceStopRecording = jest.fn();
const mockGetGuestRecordedDreamCount = jest.fn();
const mockGetInputModePreference = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSaveInputModePreference = jest.fn();
const mockStartRecording = jest.fn();
const mockStopRecording = jest.fn();
const mockTrackProductEvent = jest.fn().mockResolvedValue(undefined);

let mockDreams: DreamAnalysis[] = [];
let mockRecordingPermissionState: 'unknown' | 'granted' | 'denied' = 'unknown';
let mockReferenceImagesEnabled = false;

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
    Platform: {
      OS: 'web',
      select: (values: Record<string, any>) => values?.web ?? values?.default,
    },
    ScrollView: MockScrollView,
    StyleSheet: {
      absoluteFill: {},
      create: <T extends Record<string, any>>(styles: T) => styles,
      hairlineWidth: 1,
    },
    TextInput: createElement('textarea'),
    View: createElement('div'),
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }),
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

jest.doMock('@/components/dev/MockNavigationRail', () => ({
  MockNavigationRail: () => null,
}));

jest.doMock('@/components/journal/SubjectProposition', () => ({
  SubjectProposition: ({ subjectType }: { subjectType: 'person' | 'animal' }) => (
    <div data-testid="subject-proposition" data-subject-type={subjectType} />
  ),
}));

jest.doMock('@/components/navigation/NoctaliaBottomNav', () => ({
  NoctaliaBottomNav: () => null,
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
  GuestLimitSheet: () => null,
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

jest.doMock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.doMock('@/context/DreamsContext', () => ({
  useDreams: () => ({
    addDream: mockAddDream,
    analyzeDream: jest.fn(),
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
      pendingRecordingIntent: null,
      completedAt: null,
    },
    transition: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.doMock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    mode: 'dark',
    colors: {
      accent: '#6f62b5',
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
  AnalysisStep: { IDLE: 0, ANALYZING: 1, GENERATING_IMAGE: 2, COMPLETE: 3 },
  useAnalysisProgress: () => ({
    error: null,
    message: '',
    progress: 0,
    reset: jest.fn(),
    setError: jest.fn(),
    setStep: jest.fn(),
    step: 0,
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
  useRecordingSession: () => ({
    forceStopRecording: mockForceStopRecording,
    isRecording: false,
    isRecordingRef: { current: false },
    recordingPermissionState: mockRecordingPermissionState,
    startRecording: mockStartRecording,
    stopRecording: mockStopRecording,
  }),
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

jest.doMock('@/lib/guestLimits', () => ({
  isGuestDreamLimitReached: () => false,
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
}));

jest.doMock('@/services/quota/GuestDreamCounter', () => ({
  getGuestRecordedDreamCount: mockGetGuestRecordedDreamCount,
}));

jest.doMock('@/services/storageService', () => ({
  getRecordingInputModePreference: mockGetInputModePreference,
  getRecordingVoiceHintCompleted: jest.fn().mockResolvedValue(true),
  saveRecordingInputModePreference: mockSaveInputModePreference,
  saveRecordingVoiceHintCompleted: jest.fn().mockResolvedValue(undefined),
}));

const { default: RecordingScreen } = require('@/app/recording');

describe('Recording screen', () => {
  beforeEach(() => {
    mockDreams = [];
    mockRecordingPermissionState = 'unknown';
    mockReferenceImagesEnabled = false;
    mockAddDream.mockImplementation(async (dream: DreamAnalysis) => ({ ...dream, id: 42 }));
    mockApplyDreamCategorization.mockResolvedValue(null);
    mockCategorizeDream.mockResolvedValue({
      dreamType: 'Symbolic Dream',
      theme: 'calm',
      title: 'Dream',
    });
    mockForceStopRecording.mockResolvedValue(undefined);
    mockGetGuestRecordedDreamCount.mockResolvedValue(0);
    mockGetInputModePreference.mockResolvedValue('text');
    mockSaveInputModePreference.mockResolvedValue(undefined);
    mockStartRecording.mockResolvedValue({ success: true });
    mockStopRecording.mockResolvedValue({ transcript: '' });
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

  it('saves typed content before offering navigation to the first dream', async () => {
    render(<RecordingScreen />);

    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), {
      target: { value: 'A blue room under the rain' },
    });
    fireEvent.click(await screen.findByTestId('recording-save'));

    await waitFor(() => {
      expect(mockAddDream).toHaveBeenCalledWith(
        expect.objectContaining({ transcript: 'A blue room under the rain' })
      );
      expect(screen.getByTestId('first-dream-sheet')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('first-dream-journal'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/journal');
      expect(mockPush).toHaveBeenCalledWith('/journal/42');
    });
  });

  it('offers animal reference photos before analyzing a saved animal dream', async () => {
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
    fireEvent.click(await screen.findByTestId('first-dream-analyze'));

    const proposition = await screen.findByTestId('subject-proposition');
    expect(proposition.getAttribute('data-subject-type')).toBe('animal');
  });
});
