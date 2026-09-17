/* @jest-environment jsdom */
import React from 'react';
import type { AlertButton } from 'react-native';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { DreamAnalysis } from '@/lib/types';
import { encodeCaptureReview } from '@/lib/captureReviewDraft';
import { TID } from '@/lib/testIDs';

const mockAddDream = jest.fn();
const mockAnalyzeDream = jest.fn();
const mockAnalysisSetStep = jest.fn();
const mockApplyDreamCategorization = jest.fn();
const mockCategorizeDream = jest.fn();
const mockForceStopRecording = jest.fn();
const mockGetInputModePreference = jest.fn();
const mockGetSavedTranscript = jest.fn(async (): Promise<string> => '');
const mockGetRecordingVoiceHintCompleted = jest.fn(async () => true);
const mockSaveTranscript = jest.fn(async (_value: string): Promise<void> => undefined);
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => false);
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSaveInputModePreference = jest.fn();
const mockStartRecording = jest.fn();
const answerPair = (story: string, answer: string, question = 'What else do you remember?') => `${story}\n\nQuestion : ${question}\nRéponse : ${answer}`;
const mockRequestCaptureQuestion = jest.fn(async () => ({ question: 'What else do you remember?', done: false }));
const mockFormatCaptureNarrative = jest.fn(async (_source: string) => 'A blue garden at dawn. A door was open.');
const mockUseFocusEffect = jest.fn();
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
let mockViewportHeight = 844;
let mockBottomInset = 0;
let mockFontScale = 1;
let mockFooterLayout: ((event: any) => void) | undefined;
let mockBottomNavLayout: ((event: any) => void) | undefined;
let mockKeyboardListeners: Record<string, () => void> = {};
let mockOnPartialTranscript: ((text: string) => void) | undefined;
let mockOnNativeEnd: (() => void) | undefined;
let mockAppStateHandler: ((state: string) => void) | undefined;
let mockIsRecording = false;
const mockIsRecordingRef = { current: false };
const mockResolveDeviceSpeechCapability = jest.fn();

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
  useFocusEffect: mockUseFocusEffect,
  useLocalSearchParams: () => ({}),
}));

jest.doMock('react-native', () => {
  const React = require('react');
  const createElement = (tag: string) => {
    const MockNativeElement = React.forwardRef(
      (
        {
          children,
          onLayout,
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
      ) => {
        if (typeof onLayout === 'function') mockFooterLayout = onLayout as (event: any) => void;
        return React.createElement(tag, { ...props, 'data-testid': testID, ref }, children);
      }
    );
    MockNativeElement.displayName = `MockNative${tag}`;
    return MockNativeElement;
  };
  const MockScrollView = React.forwardRef(
    (
      {
        accessibilityState,
        children,
        contentContainerStyle: _contentContainerStyle,
        keyboardShouldPersistTaps: _keyboardShouldPersistTaps,
        style,
        testID,
        ...props
      }: {
        accessibilityState?: { busy?: boolean };
        children?: React.ReactNode;
        contentContainerStyle?: unknown;
        keyboardShouldPersistTaps?: unknown;
        style?: unknown;
        testID?: string;
        [key: string]: any;
      },
      ref: React.ForwardedRef<{ scrollToEnd: () => void; scrollTo: () => void }>
    ) => {
      React.useImperativeHandle(ref, () => ({ scrollToEnd: jest.fn(), scrollTo: jest.fn() }));
      return (
        <div {...props} aria-busy={accessibilityState?.busy} data-testid={testID} data-native-style={JSON.stringify(style)}>
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
        style: _style,
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
    BackHandler: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
    AppState: {
      addEventListener: (_type: string, handler: (state: string) => void) => {
        mockAppStateHandler = handler;
        return { remove: jest.fn() };
      },
    },
    Keyboard: {
      addListener: (event: string, listener: () => void) => {
        mockKeyboardListeners[event] = listener;
        return { remove: () => { delete mockKeyboardListeners[event]; } };
      },
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
    Text: createElement('span'),
    TextInput: createElement('textarea'),
    View: createElement('div'),
    useWindowDimensions: () => ({
      width: mockViewportWidth,
      height: mockViewportHeight,
      scale: 1,
      fontScale: mockFontScale,
    }),
  };
});

jest.doMock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: mockBottomInset, left: 0, right: 0 }),
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
  NoctaliaBottomNav: ({ onBarLayout }: { onBarLayout?: (event: any) => void }) => {
    mockBottomNavLayout = onBarLayout;
    return <div data-testid="recording-bottom-nav" />;
  },
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
        disabled,
        layout,
        onChange,
        onSelectionChange,
        onSwitchToVoice,
        showVoiceHint,
        voiceStatus,
        value,
        inputTestID = TID.Input.DreamTranscript,
      }: {
        disabled?: boolean;
        layout: string;
        onChange: (value: string) => void;
        onSelectionChange?: (event: { nativeEvent: { selection: { start: number; end: number } } }) => void;
        onSwitchToVoice: () => void;
        showVoiceHint?: boolean;
        voiceStatus?: string;
        value: string;
        inputTestID?: string;
      },
      _ref: React.ForwardedRef<unknown>
    ) => (
      <div data-layout={layout} data-testid="recording-composer">
        {showVoiceHint ? <span data-testid="recording-voice-hint">Voice hint</span> : null}
        <textarea
          data-testid={inputTestID}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value)}
          onSelect={(event) => onSelectionChange?.({ nativeEvent: { selection: {
            start: event.currentTarget.selectionStart,
            end: event.currentTarget.selectionEnd,
          } } })}
          value={value}
        />
        <button data-testid="recording-voice-control" data-status={voiceStatus} onClick={onSwitchToVoice}>
          Voice
        </button>
      </div>
    )
  );
  RecordingTextInput.displayName = 'MockRecordingTextInput';
  return { RecordingTextInput };
});

jest.doMock('@/services/captureConversation', () => ({ requestCaptureQuestion: mockRequestCaptureQuestion, formatCaptureNarrative: mockFormatCaptureNarrative }));

jest.doMock('@/components/recording/RecordingConversation', () => ({
  RecordingConversation: (props: any) => {
    const Editor = jest.requireMock('@/components/recording/RecordingTextInput').RecordingTextInput;
    return <>
      <Editor layout="voiceFirst" value={props.transcript} onChange={props.onAnswerChange}
        onSwitchToVoice={props.onVoice} voiceStatus={props.voiceStatus} disabled={props.disabled} />
      <textarea data-testid="conversation-answer" value={props.answer} onChange={(event) => props.onAnswerChange(event.currentTarget.value)} />
      <span data-testid="conversation-story">{props.storyTranscript}</span>
      <span data-testid="conversation-question">{props.question}</span>
      <button data-testid="conversation-restart" onClick={props.onRestart}>Restart</button>
      <button data-testid="conversation-mute" onClick={props.onMute}>Mute</button>
      <button data-testid="conversation-submit" onClick={props.onAnswerSubmit}>Send</button>
      <button data-testid="recording-review-transcript" onClick={props.onReview}>Review</button>
    </>;
  },
}));

jest.doMock('@/components/recording/CaptureDraftEditor', () => ({
  CaptureDraftEditor: ({ draft, disabled, onChange, onClose }: any) => <div data-testid="capture-draft-editor">
    {draft.sections.map((section: any, index: number) => <div key={index}>
      <span>{section.question}</span>
      <textarea data-testid={`capture-adjust-section-${index}`} value={section.text} disabled={disabled}
        onChange={(event) => onChange(index, event.currentTarget.value)} />
    </div>)}
    <button data-testid="capture-adjust-close" disabled={disabled} onClick={onClose}>Close</button>
  </div>,
}));

jest.doMock('@/components/recording/RecordingFooter', () => ({
  RecordingFooter: ({
    isSaveDisabled,
    onSave,
    onCompleteWithHelp,
  }: {
    isSaveDisabled: boolean;
    onSave: () => void;
    onCompleteWithHelp?: () => void;
  }) => (
    <><button data-testid="recording-save" disabled={isSaveDisabled} onClick={onSave}>
      Save
    </button>
    {onCompleteWithHelp ? <button data-testid="recording-complete-with-help" disabled={isSaveDisabled} onClick={onCompleteWithHelp}>Help</button> : null}</>
  ),
}));

jest.doMock('@/components/recording/RecordingSheets', () => ({
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
  StandardBottomSheet: ({ visible, title, subtitle, actions, onClose, testID }: any) => visible ? <div data-testid={testID}>
    <span>{title}</span><span>{subtitle}</span>
    <button data-testid={actions.primaryTestID} disabled={actions.primaryDisabled || actions.primaryLoading} onClick={actions.onPrimary}>{actions.primaryLabel}</button>
    {actions.secondaryLabel ? <button data-testid={actions.secondaryTestID} disabled={actions.secondaryDisabled} onClick={actions.onSecondary}>{actions.secondaryLabel}</button> : null}
    {actions.linkLabel ? <button data-testid={actions.linkTestID} onClick={actions.onLink}>{actions.linkLabel}</button> : null}
    <button data-testid={`${testID}-close`} onClick={onClose}>Close sheet</button>
  </div> : null,
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
    onNativeEnd,
    onPartialTranscript,
  }: {
    onNativeEnd?: () => void;
    onPartialTranscript?: (text: string) => void;
  }) => {
    mockOnNativeEnd = onNativeEnd;
    mockOnPartialTranscript = onPartialTranscript;
    return {
      forceStopRecording: mockForceStopRecording,
      isRecording: mockIsRecording,
      isSpeechListening: mockIsRecording,
      isRecordingRef: mockIsRecordingRef,
      recordingPermissionState: mockRecordingPermissionState,
      startRecording: mockStartRecording,
      stopRecording: mockStopRecording,
    };
  },
}));

jest.doMock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => (key.startsWith('journal.persistence.') || key === 'recording.conversation.question_label' || key === 'recording.conversation.answer_label')
      ? require('@/lib/i18n/fr').default[key]
      : key,
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

jest.doMock('@/services/nativeSpeechRecognition', () => {
  const actual = jest.requireActual('@/services/nativeSpeechRecognition') as typeof import('@/services/nativeSpeechRecognition');
  return {
    registerOfflineModelPromptHandler: () => jest.fn(),
    resolveDeviceSpeechCapability: mockResolveDeviceSpeechCapability,
    shouldRestartHandsFreeSpeech: actual.shouldRestartHandsFreeSpeech,
  };
});

jest.doMock('@/services/storageService', () => ({
  getRecordingInputModePreference: mockGetInputModePreference,
  getRecordingVoiceHintCompleted: mockGetRecordingVoiceHintCompleted,
  getSavedTranscript: mockGetSavedTranscript,
  getRecordingDraft: async () => {
    const value = await mockGetSavedTranscript();
    return value ? { status: 'loaded', value } : { status: 'absent' };
  },
  saveRecordingInputModePreference: mockSaveInputModePreference,
  saveRecordingVoiceHintCompleted: jest.fn().mockResolvedValue(undefined),
  saveTranscript: mockSaveTranscript,
}));

const { default: RecordingScreen } = require('@/app/recording');
const { DreamPersistenceError } = require('@/lib/dreamStorageRead');
const { Alert } = require('react-native');
const { default: frenchTranslations } = require('@/lib/i18n/fr');
const { getBottomNavigationLayout } = require('@/constants/layout');

const pendingDraftReads = new Set<(value: string) => void>();

function deferredDraftRead() {
  let resolve!: (value: string) => void;
  const promise = new Promise<string>((complete) => { resolve = complete; });
  pendingDraftReads.add(resolve);
  return { promise, resolve };
}

async function awaitEditorReady() {
  await waitFor(() => {
    expect(
      (screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).disabled
    ).toBe(false);
    expect(screen.getByTestId(TID.Screen.Recording).getAttribute('aria-busy')).toBe('false');
  });
}

describe('Recording screen', () => {
  it.each([[640, 320], [915, 412]])('keeps one Save action and the draft when rotating through compact %i by %i dp', async (width: number, height: number) => {
    mockPlatformOS = 'android';
    mockBottomInset = 24;
    for (const scale of [1, 1.5, 2]) {
      for (const footerHeight of [86, 128]) {
        mockFontScale = scale;
        mockViewportWidth = height;
        mockViewportHeight = width;
        const view = render(<RecordingScreen />);
        await awaitEditorReady();
        act(() => mockFooterLayout?.({ nativeEvent: { layout: { height: footerHeight } } }));
        const draft = 'A blue room with rain at the window.';
        fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), { target: { value: draft } });

        mockViewportWidth = width;
        mockViewportHeight = height;
        view.rerender(<RecordingScreen />);
        const navHeight = getBottomNavigationLayout(width, height, scale).barHeight;
        act(() => mockBottomNavLayout?.({ nativeEvent: { layout: { y: height - navHeight - 24 } } }));
        const scroll = screen.getByTestId(TID.Screen.Recording);
        const save = screen.getByTestId('recording-save') as HTMLButtonElement;
        expect(screen.getAllByTestId('recording-save')).toHaveLength(1);
        expect(scroll.contains(save)).toBe(true);
        expect(save.disabled).toBe(false);
        const styles = JSON.parse(scroll.getAttribute('data-native-style') ?? '[]');
        const style = Object.assign({}, ...styles.filter(Boolean));
        expect(style.marginBottom).toBe(navHeight + 24);
        expect(height - (style.marginBottom ?? 0)).toBeGreaterThanOrEqual(120);

        for (const event of ['keyboardDidShow', 'keyboardDidHide']) {
          act(() => mockKeyboardListeners[event]?.());
          expect(screen.getAllByTestId('recording-save')).toHaveLength(1);
          expect(screen.getByTestId(TID.Screen.Recording).contains(screen.getByTestId('recording-save'))).toBe(true);
          expect((screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value).toBe(draft);
        }

        mockViewportWidth = height;
        mockViewportHeight = width;
        view.rerender(<RecordingScreen />);
        expect(screen.getAllByTestId('recording-save')).toHaveLength(1);
        expect(screen.getByTestId(TID.Screen.Recording).contains(screen.getByTestId('recording-save'))).toBe(false);
        expect((screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value).toBe(draft);
        view.unmount();
      }
    }
  });

  it.each([568, 640])('preserves a positive scroll viewport on a 320 by %i dp phone at 200%% text', async (height: number) => {
    mockPlatformOS = 'android';
    mockFontScale = 2;
    mockViewportWidth = 320;
    mockViewportHeight = height;
    mockBottomInset = 24;
    const navHeight = getBottomNavigationLayout(320, height, 2).barHeight;
    render(<RecordingScreen />);
    await awaitEditorReady();
    act(() => {
      mockFooterLayout?.({ nativeEvent: { layout: { height: 128 } } });
      mockBottomNavLayout?.({ nativeEvent: { layout: { y: height - navHeight - 24 } } });
    });
    const styles = JSON.parse(screen.getByTestId(TID.Screen.Recording).getAttribute('data-native-style') ?? '[]');
    const style = Object.assign({}, ...styles.filter(Boolean));
    expect(style.marginBottom).toBe(navHeight + 24 + 128);
    expect(height - style.marginBottom).toBeGreaterThanOrEqual(100);
    expect(screen.getByTestId(TID.Input.DreamTranscript)).toBeTruthy();
  });

  it.each([1, 1.5, 2])('keeps scrolling above the measured footer and navigation at scale %s', async (fontScale: number) => {
    mockPlatformOS = 'android';
    mockFontScale = fontScale;
    render(<RecordingScreen />);
    await awaitEditorReady();

    act(() => {
      mockFooterLayout?.({ nativeEvent: { layout: { height: 96 } } });
      mockBottomNavLayout?.({ nativeEvent: { layout: { y: 500 } } });
    });

    const styles = JSON.parse(screen.getByTestId(TID.Screen.Recording).getAttribute('data-native-style') ?? '[]');
    const style = Object.assign({}, ...styles.filter(Boolean));
    expect(style.marginBottom).toBe(440);
    expect(screen.getByTestId('recording-save')).toBeTruthy();
    expect(screen.getByTestId('recording-bottom-nav')).toBeTruthy();
  });

  beforeEach(() => {
    mockCurrentUser = { id: 'user-1' };
    mockDreams = [];
    mockPendingRecordingIntent = null;
    mockTransitionOnboarding = jest.fn().mockResolvedValue(undefined);
    mockPlatformOS = 'web';
    mockRecordingPermissionState = 'unknown';
    mockReferenceImagesEnabled = false;
    mockViewportWidth = 390;
    mockViewportHeight = 844;
    mockBottomInset = 0;
    mockFontScale = 1;
    mockFooterLayout = undefined;
    mockBottomNavLayout = undefined;
    mockKeyboardListeners = {};
    mockOnPartialTranscript = undefined;
    mockOnNativeEnd = undefined;
    mockAppStateHandler = undefined;
    mockIsRecording = false;
    mockIsRecordingRef.current = false;
    mockGetSavedTranscript.mockReset();
    mockSaveTranscript.mockReset();
    mockGetSavedTranscript.mockResolvedValue('');
    mockGetRecordingVoiceHintCompleted.mockResolvedValue(true);
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
    mockStartRecording.mockImplementation(async () => {
      mockIsRecordingRef.current = true;
      return { success: true };
    });
    mockStopRecording.mockImplementation(async () => {
      mockIsRecordingRef.current = false;
      return { transcript: '' };
    });
    mockCanGoBack.mockReturnValue(false);
    mockResolveDeviceSpeechCapability.mockReset();
    mockResolveDeviceSpeechCapability.mockResolvedValue({
      tier: 'on_device',
      reason: 'locale_installed',
      requiresOnDeviceRecognition: true,
      localAlternatives: [],
    });
  });

  afterEach(async () => {
    try {
      cleanup();
    } finally {
      // A failed assertion must not strand a read on the shared storage queue.
      await act(async () => {
        pendingDraftReads.forEach((resolve) => resolve(''));
        pendingDraftReads.clear();
      });
      jest.clearAllMocks();
    }
  });

  it('reviews the formatted narrative before saving and retains the original answered questions', async () => {
    mockGetInputModePreference.mockResolvedValue('voice');
    render(<RecordingScreen />);
    await awaitEditorReady();
    expect(screen.queryByTestId('recording-complete-with-help')).toBeNull();
    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), { target: { value: 'A blue garden at dawn' } });
    fireEvent.click(screen.getByTestId('conversation-submit'));
    await waitFor(() => expect(screen.getByTestId('conversation-question').textContent).toBe('What else do you remember?'));
    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), { target: { value: 'A door was open.' } });
    fireEvent.click(screen.getByTestId('conversation-submit'));
    fireEvent.click(screen.getByTestId('recording-save'));
    await screen.findByTestId('capture-review-text');
    expect(mockAddDream).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId('capture-review-text'), { target: { value: 'My corrected account.' } });
    fireEvent.click(screen.getByTestId('recording-save'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/journal/[id]', params: { id: '42', saved: '1' } }));
    expect(mockAddDream).toHaveBeenCalledWith(expect.objectContaining({ transcript: 'My corrected account.', captureOriginalTranscript: answerPair('A blue garden at dawn', 'A door was open.') }));
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
  });

  it('preserves the exact question for a one-word answer in the draft, restored editor and direct save', async () => {
    const question = 'De quelle couleur était la plage ?';
    const expected = answerPair('Une plage.', 'Noire.', question);
    mockGetInputModePreference.mockResolvedValue('voice');
    mockGetSavedTranscript.mockResolvedValueOnce('Une plage.');
    mockRequestCaptureQuestion.mockResolvedValueOnce({ question, done: false });
    const { unmount } = render(<RecordingScreen />);
    await awaitEditorReady();
    await waitFor(() => expect(screen.getByTestId('conversation-question').textContent).toBe(question));
    const calls = mockRequestCaptureQuestion.mock.calls.length;
    fireEvent.change(screen.getByTestId('conversation-answer'), { target: { value: 'Noire.' } });
    act(() => mockAppStateHandler?.('background'));
    await waitFor(() => expect(mockSaveTranscript).toHaveBeenLastCalledWith(expected));
    expect(screen.getByTestId('conversation-story').textContent).toBe('Une plage.');
    expect(mockRequestCaptureQuestion).toHaveBeenCalledTimes(calls);
    unmount();

    mockGetSavedTranscript.mockResolvedValueOnce(expected);
    mockGetInputModePreference.mockResolvedValueOnce('text');
    render(<RecordingScreen />);
    await awaitEditorReady();
    expect((screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value).toBe(expected);
    fireEvent.click(screen.getByTestId('recording-save'));
    await waitFor(() => expect(mockAddDream).toHaveBeenCalledWith(expect.objectContaining({ transcript: expected })));
    expect(mockAnalyzeDream).not.toHaveBeenCalled();
  });

  it('confirms restart, stops dictation, clears the durable draft and resets question history', async () => {
    mockPlatformOS = 'android';
    mockRecordingPermissionState = 'granted';
    mockGetInputModePreference.mockResolvedValue('voice');
    mockGetSavedTranscript.mockResolvedValueOnce('Ancien récit.');
    render(<RecordingScreen />);
    await awaitEditorReady();
    await waitFor(() => expect(screen.getByTestId('conversation-question').textContent).toBe('What else do you remember?'));
    fireEvent.click(screen.getByTestId('recording-voice-control'));
    await waitFor(() => expect(mockStartRecording).toHaveBeenCalledTimes(1));
    act(() => mockOnPartialTranscript?.('Une réponse.'));
    const before = (screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value;
    fireEvent.click(screen.getByTestId('conversation-restart'));
    expect((screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value).toBe(before);
    expect(mockStopRecording).not.toHaveBeenCalled();
    const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2] as AlertButton[] | undefined;
    expect(buttons?.find(button => button.style === 'cancel')).toBeTruthy();
    let resolveStop!: (value: { transcript: string }) => void;
    const stop = { promise: new Promise<{ transcript: string }>(resolve => { resolveStop = resolve; }) };
    mockStopRecording.mockReturnValueOnce(stop.promise);
    let pending: unknown;
    act(() => { pending = buttons?.find(button => button.style === 'destructive')?.onPress?.(); });
    expect(mockStopRecording).toHaveBeenCalledTimes(1);
    act(() => mockOnPartialTranscript?.('Derniers mots à ignorer.'));
    await act(async () => {
      mockIsRecordingRef.current = false;
      resolveStop({ transcript: 'Derniers mots à ignorer.' });
      await pending;
    });
    expect((screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value).toBe('');
    expect((screen.getByTestId('conversation-answer') as HTMLTextAreaElement).value).toBe('');
    expect(screen.getByTestId('conversation-question').textContent).toBe('');
    act(() => mockAppStateHandler?.('background'));
    await waitFor(() => expect(mockSaveTranscript).toHaveBeenLastCalledWith(''));
    expect(mockStartRecording).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByTestId('conversation-answer'), { target: { value: 'Nouveau rêve.' } });
    await act(async () => { fireEvent.click(screen.getByTestId('conversation-submit')); });
    expect(mockRequestCaptureQuestion).toHaveBeenLastCalledWith('Nouveau rêve.', expect.any(String), [], expect.anything());
    expect(mockAddDream).not.toHaveBeenCalled();
  });

  it('keeps the conversational draft and stays on capture if saving fails', async () => {
    mockGetInputModePreference.mockResolvedValue('voice');
    mockAddDream.mockRejectedValueOnce(new Error('storage unavailable'));
    render(<RecordingScreen />);
    await awaitEditorReady();
    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), { target: { value: 'A blue garden at dawn' } });
    fireEvent.click(screen.getByTestId('recording-save'));
    await screen.findByTestId('capture-review-text');
    fireEvent.click(screen.getByTestId('recording-save'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    expect(mockReplace).not.toHaveBeenCalled();
    expect((screen.getByTestId('capture-review-text') as HTMLTextAreaElement).value).toBe('A blue garden at dawn. A door was open.');
  });

  it('edits the narrative and answers while keeping their question context through close, reopen and validation', async () => {
    const source = answerPair('Une plage.', 'Noir.', 'Quelle couleur ?');
    mockGetInputModePreference.mockResolvedValue('voice');
    mockGetSavedTranscript.mockResolvedValueOnce(source);
    render(<RecordingScreen />);
    await awaitEditorReady();
    await act(async () => { fireEvent.click(screen.getByTestId('recording-review-transcript')); });
    expect(screen.queryByTestId('recording-mode-text')).toBeNull();
    expect(screen.getByText('Quelle couleur ?')).toBeTruthy();
    expect((screen.getByTestId('capture-adjust-section-1') as HTMLTextAreaElement).value).toBe('Noir.');
    fireEvent.change(screen.getByTestId('capture-adjust-section-1'), { target: { value: 'Gris, je crois.' } });
    fireEvent.change(screen.getByTestId('capture-adjust-section-0'), { target: { value: 'Je marchais sur une plage.' } });
    act(() => mockAppStateHandler?.('background'));
    const edited = answerPair('Je marchais sur une plage.', 'Gris, je crois.', 'Quelle couleur ?');
    await waitFor(() => expect(mockSaveTranscript).toHaveBeenLastCalledWith(edited));
    fireEvent.click(screen.getByTestId('capture-adjust-close'));
    expect(screen.getByTestId('conversation-story').textContent).toBe(edited);
    await act(async () => { fireEvent.click(screen.getByTestId('recording-review-transcript')); });
    expect((screen.getByTestId('capture-adjust-section-1') as HTMLTextAreaElement).value).toBe('Gris, je crois.');
    fireEvent.click(screen.getByTestId('recording-save'));
    await screen.findByTestId('capture-review-text');
    expect(mockFormatCaptureNarrative).toHaveBeenCalledWith(edited, expect.any(String), expect.anything());
    expect(mockAddDream).not.toHaveBeenCalled();
    expect(screen.queryByTestId('capture-draft-editor')).toBeNull();
  });

  it('does not validate empty narrator fields just because the source contains questions', async () => {
    mockGetInputModePreference.mockResolvedValue('voice');
    mockGetSavedTranscript.mockResolvedValueOnce(answerPair('Une plage.', 'Noir.', 'Quelle couleur ?'));
    render(<RecordingScreen />);
    await awaitEditorReady();
    await act(async () => { fireEvent.click(screen.getByTestId('recording-review-transcript')); });
    fireEvent.change(screen.getByTestId('capture-adjust-section-0'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('capture-adjust-section-1'), { target: { value: '' } });
    expect((screen.getByTestId('recording-save') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Quelle couleur ?')).toBeTruthy();
    fireEvent.click(screen.getByTestId('capture-adjust-close'));
    expect((screen.getByTestId('recording-save') as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps the final dictated words when opening the answer editor during listening', async () => {
    mockPlatformOS = 'android';
    mockRecordingPermissionState = 'granted';
    mockGetInputModePreference.mockResolvedValue('voice');
    mockGetSavedTranscript.mockResolvedValueOnce('Une plage.');
    render(<RecordingScreen />);
    await awaitEditorReady();
    await waitFor(() => expect(screen.getByTestId('conversation-question').textContent).toBe('What else do you remember?'));
    fireEvent.click(screen.getByTestId('recording-voice-control'));
    await waitFor(() => expect(mockStartRecording).toHaveBeenCalledTimes(1));
    act(() => mockOnPartialTranscript?.('Noir'));
    mockStopRecording.mockImplementationOnce(async () => {
      mockIsRecordingRef.current = false;
      return { transcript: 'Noir, je crois.' };
    });
    await act(async () => { fireEvent.click(screen.getByTestId('recording-review-transcript')); });
    expect((screen.getByTestId('capture-adjust-section-1') as HTMLTextAreaElement).value).toBe('Noir, je crois.');
    expect(mockFormatCaptureNarrative).not.toHaveBeenCalled();
    expect(mockAddDream).not.toHaveBeenCalled();
  });

  it('waits for the edited review and original to persist before leaving without a journal save', async () => {
    const review = { source: 'Une plage.', text: 'Une plage noire.' };
    mockGetSavedTranscript.mockResolvedValueOnce(encodeCaptureReview(review));
    render(<RecordingScreen />);
    await screen.findByTestId('capture-review-text');
    fireEvent.change(screen.getByTestId('capture-review-text'), { target: { value: 'Une plage noire, je crois.' } });
    fireEvent.click(screen.getByTestId('capture-review-exit'));
    let resolveWrite!: () => void;
    const pending = { promise: new Promise<void>(resolve => { resolveWrite = resolve; }), resolve: () => resolveWrite() };
    mockSaveTranscript.mockReturnValueOnce(pending.promise);
    fireEvent.click(screen.getByTestId('capture-review-keep'));
    await waitFor(() => expect(mockSaveTranscript).toHaveBeenCalled());
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockAddDream).not.toHaveBeenCalled();
    await act(async () => { pending.resolve(); });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)'));
    expect(mockSaveTranscript).toHaveBeenLastCalledWith(encodeCaptureReview({ ...review, text: 'Une plage noire, je crois.' }));
    expect(mockAddDream).not.toHaveBeenCalled();
  });

  it('continues without leaving and only deletes both review and originals after explicit confirmation', async () => {
    mockGetSavedTranscript.mockResolvedValueOnce(encodeCaptureReview({ source: 'Original exchanges.', text: 'A reviewed account.' }));
    render(<RecordingScreen />);
    await screen.findByTestId('capture-review-text');
    fireEvent.click(screen.getByTestId('capture-review-exit'));
    fireEvent.click(screen.getByTestId('capture-review-continue'));
    expect(screen.queryByTestId('capture-review-exit-sheet')).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('capture-review-exit'));
    fireEvent.click(screen.getByTestId('capture-review-discard'));
    expect(mockSaveTranscript).not.toHaveBeenCalledWith('');
    fireEvent.click(screen.getByTestId('capture-review-discard-cancel'));
    expect(screen.getByTestId('capture-review-keep')).toBeTruthy();
    fireEvent.click(screen.getByTestId('capture-review-discard'));
    fireEvent.click(screen.getByTestId('capture-review-discard-confirm'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)'));
    expect(mockSaveTranscript).toHaveBeenLastCalledWith('');
    expect(mockAddDream).not.toHaveBeenCalled();
  });

  it('keeps the review open if durable deletion fails', async () => {
    const saved = encodeCaptureReview({ source: 'Original exchanges.', text: 'A reviewed account.' });
    mockGetSavedTranscript.mockResolvedValueOnce(saved);
    render(<RecordingScreen />);
    await screen.findByTestId('capture-review-text');
    mockSaveTranscript.mockRejectedValueOnce(new Error('disk full')).mockRejectedValueOnce(new Error('disk full'));
    fireEvent.click(screen.getByTestId('capture-review-exit'));
    fireEvent.click(screen.getByTestId('capture-review-discard'));
    fireEvent.click(screen.getByTestId('capture-review-discard-confirm'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('common.error_title', 'recording.review.exit_error'));
    expect(mockReplace).not.toHaveBeenCalled();
    expect((screen.getByTestId('capture-review-text') as HTMLTextAreaElement).value).toBe('A reviewed account.');
    act(() => mockAppStateHandler?.('background'));
    await waitFor(() => expect(mockSaveTranscript).toHaveBeenLastCalledWith(saved));
  });

  it('opens the same exit options with Android Back and does not save the dream', async () => {
    mockGetSavedTranscript.mockResolvedValueOnce(encodeCaptureReview({ source: 'Original exchanges.', text: 'A reviewed account.' }));
    render(<RecordingScreen />);
    await screen.findByTestId('capture-review-text');
    const focus = mockUseFocusEffect.mock.calls.at(-1)?.[0] as (() => (() => void));
    const unfocus = focus();
    const backHandler = jest.requireMock('react-native').BackHandler.addEventListener.mock.calls.at(-1)[1] as () => boolean;
    act(() => { expect(backHandler()).toBe(true); });
    expect(screen.getByTestId('capture-review-keep')).toBeTruthy();
    expect(mockAddDream).not.toHaveBeenCalled();
    unfocus();
  });

  it('keeps the raw account when formatting fails and permits saving without AI', async () => {
    mockGetInputModePreference.mockResolvedValue('voice');
    mockGetSavedTranscript.mockResolvedValueOnce('Une plage.');
    mockFormatCaptureNarrative.mockRejectedValueOnce(new Error('offline'));
    render(<RecordingScreen />);
    await awaitEditorReady();
    fireEvent.click(screen.getByTestId('recording-save'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    expect(mockAddDream).not.toHaveBeenCalled();
    expect((screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value).toBe('Une plage.');
    const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2] as AlertButton[];
    await act(async () => { buttons.find(button => button.text === 'recording.review.save_original')?.onPress?.(); });
    expect(mockAddDream).toHaveBeenCalledWith(expect.objectContaining({ transcript: 'Une plage.' }));
  });

  it('restores edited review and original together after leaving capture without another AI request', async () => {
    const saved = encodeCaptureReview({ source: 'Une plage. Question : couleur ? Réponse : noire.', text: 'Une plage noire, je crois.' });
    mockGetSavedTranscript.mockResolvedValueOnce(saved);
    render(<RecordingScreen />);
    const editor = await screen.findByTestId('capture-review-text') as HTMLTextAreaElement;
    expect(editor.value).toBe('Une plage noire, je crois.');
    expect(mockFormatCaptureNarrative).not.toHaveBeenCalled();
    fireEvent.change(editor, { target: { value: 'Une plage noire, peut-être.' } });
    act(() => mockAppStateHandler?.('background'));
    await waitFor(() => expect(mockSaveTranscript).toHaveBeenLastCalledWith(encodeCaptureReview({
      source: 'Une plage. Question : couleur ? Réponse : noire.', text: 'Une plage noire, peut-être.',
    })));
    expect(screen.queryByText('recording.review.back')).toBeNull();
    fireEvent.click(screen.getByText('recording.review.original'));
    expect(screen.getByText('Une plage. Question : couleur ? Réponse : noire.')).toBeTruthy();
    expect((screen.getByTestId('capture-review-text') as HTMLTextAreaElement).value).toBe('Une plage noire, peut-être.');
    fireEvent.click(screen.getByText('recording.review.original'));
    expect(screen.queryByText('Une plage. Question : couleur ? Réponse : noire.')).toBeNull();
  });

  it('stops listening before formatting, rejects duplicate validation, and includes the final words', async () => {
    mockPlatformOS = 'android';
    mockRecordingPermissionState = 'granted';
    mockGetInputModePreference.mockResolvedValue('voice');
    render(<RecordingScreen />);
    await awaitEditorReady();
    fireEvent.click(screen.getByTestId('recording-voice-control'));
    await waitFor(() => expect(mockStartRecording).toHaveBeenCalledTimes(1));
    act(() => mockOnPartialTranscript?.('Une plage'));
    mockStopRecording.mockImplementationOnce(async () => {
      mockIsRecordingRef.current = false;
      return { transcript: 'Une plage noire.' };
    });
    fireEvent.click(screen.getByTestId('recording-save'));
    fireEvent.click(screen.getByTestId('recording-save'));
    await screen.findByTestId('capture-review-text');
    expect(mockFormatCaptureNarrative).toHaveBeenCalledTimes(1);
    expect(mockFormatCaptureNarrative).toHaveBeenCalledWith('Une plage noire.', expect.any(String), expect.any(AbortSignal));
    expect(mockAddDream).not.toHaveBeenCalled();
  });

  it('ignores a formatting result after the screen unmounts', async () => {
    mockGetInputModePreference.mockResolvedValue('voice');
    mockGetSavedTranscript.mockResolvedValueOnce('Une plage.');
    let resolve!: (text: string) => void;
    mockFormatCaptureNarrative.mockReturnValueOnce(new Promise<string>(done => { resolve = done; }));
    const view = render(<RecordingScreen />);
    await awaitEditorReady();
    fireEvent.click(screen.getByTestId('recording-save'));
    await waitFor(() => expect(mockFormatCaptureNarrative).toHaveBeenCalledTimes(1));
    view.unmount();
    await act(async () => resolve('A late proposal.'));
    expect(mockAddDream).not.toHaveBeenCalled();
    expect(mockSaveTranscript.mock.calls.some(([value]: [string]) => value.includes('A late proposal.'))).toBe(false);
  });

  it('starts voice capture only after the first permission rationale is accepted', async () => {
    render(<RecordingScreen />);
    await awaitEditorReady();

    fireEvent.click(screen.getByTestId('recording-voice-control'));

    expect(await screen.findByTestId('mic-rationale')).toBeTruthy();
    expect(mockStartRecording).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('mic-rationale-allow'));

    await waitFor(() => {
      expect(mockStartRecording).toHaveBeenCalledTimes(1);
      expect(mockStartRecording).toHaveBeenCalledWith('');
    });
  });

  it('shows active dictation only once recognition is listening, never during permission or startup', async () => {
    let finishStart: ((value: { success: boolean }) => void) | undefined;
    mockStartRecording.mockImplementationOnce(() => new Promise((resolve) => { finishStart = resolve; }));
    const view = render(<RecordingScreen />);
    await awaitEditorReady();
    const status = () => screen.getByTestId('recording-voice-control').getAttribute('data-status');

    fireEvent.click(screen.getByTestId('recording-voice-control'));
    await screen.findByTestId('mic-rationale');
    expect(status()).toBe('idle');
    fireEvent.click(screen.getByTestId('mic-rationale-allow'));
    await waitFor(() => expect(mockStartRecording).toHaveBeenCalledTimes(1));
    expect(status()).toBe('preparing');

    await act(async () => { finishStart?.({ success: true }); });
    expect(status()).not.toBe('recording');

    mockIsRecording = true;
    view.rerender(<RecordingScreen />);
    expect(status()).toBe('recording');
    mockIsRecording = false;
    view.rerender(<RecordingScreen />);
    expect(status()).not.toBe('recording');
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
    await awaitEditorReady();

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

  it('keeps the save button visible and disabled for empty or whitespace drafts', async () => {
    render(<RecordingScreen />);
    await awaitEditorReady();

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
      await awaitEditorReady();

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
      await awaitEditorReady();

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

  it.each(['read', 'write'] as const)(
    'keeps the draft and capture identity after a queue %s failure with French recovery copy',
    async (operation: 'read' | 'write') => {
      mockAddDream.mockRejectedValueOnce(new DreamPersistenceError(operation, 'remote-cache'));
      render(<RecordingScreen />);
      await awaitEditorReady();
      const input = screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement;
      fireEvent.change(input, { target: { value: 'Un lac et une porte rouge' } });
      fireEvent.click(screen.getByTestId('recording-save'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'common.error_title',
          frenchTranslations[`journal.persistence.${operation}_cache`]
        );
        expect((screen.getByTestId('recording-save') as HTMLButtonElement).disabled).toBe(false);
      });
      expect(input.value).toBe('Un lac et une porte rouge');
      expect(mockSaveTranscript).not.toHaveBeenCalledWith('');
      expect(mockReplace).not.toHaveBeenCalled();
      expect(mockCategorizeDream).not.toHaveBeenCalled();
      const firstCapture = mockAddDream.mock.calls[0][0];

      fireEvent.click(screen.getByTestId('recording-save'));
      await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/journal/[id]',
        params: { id: '42', saved: '1' },
      }));
      expect(mockAddDream).toHaveBeenCalledTimes(2);
      expect(mockAddDream.mock.calls[1][0]).toBe(firstCapture);
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
    await awaitEditorReady();

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
    await awaitEditorReady();

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
    await awaitEditorReady();

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
      await awaitEditorReady();

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
    await awaitEditorReady();

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
    await awaitEditorReady();

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
    await awaitEditorReady();

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
    await awaitEditorReady();

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

  it('preserves the stored draft and rejects early input before hydration completes', async () => {
    const read = deferredDraftRead();
    mockGetSavedTranscript.mockReturnValueOnce(read.promise);

    render(<RecordingScreen />);

    const input = screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement;
    expect(input.disabled).toBe(true);
    fireEvent.change(input, {
      target: { value: 'typed while loading' },
    });
    expect(input.value).toBe('');
    expect(mockSaveTranscript).not.toHaveBeenCalled();

    await waitFor(() => expect(mockGetSavedTranscript).toHaveBeenCalledTimes(1));
    await act(async () => {
      read.resolve('saved draft from disk');
    });

    await awaitEditorReady();
    expect(
      (screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value
    ).toBe('saved draft from disk');

    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), {
      target: { value: 'saved draft from disk plus more' },
    });

    await waitFor(() => {
      expect(mockSaveTranscript).toHaveBeenCalledWith('saved draft from disk plus more');
    });
    expect(mockSaveTranscript).not.toHaveBeenCalledWith('typed while loading');
  });

  it('does not erase stored content during the initial empty render', async () => {
    const read = deferredDraftRead();
    mockGetSavedTranscript.mockReturnValueOnce(read.promise);

    render(<RecordingScreen />);

    await waitFor(() => expect(mockGetSavedTranscript).toHaveBeenCalledTimes(1));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(mockSaveTranscript).not.toHaveBeenCalled();
    expect(
      (screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value
    ).toBe('');

    await act(async () => {
      read.resolve('stored dream');
    });

    await waitFor(() => {
      expect(
        (screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value
      ).toBe('stored dream');
    });
    expect(mockSaveTranscript).not.toHaveBeenCalled();
  });

  it('offers retry after a failed restore and restores the original before accepting edits', async () => {
    const read = deferredDraftRead();
    mockGetSavedTranscript
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockReturnValueOnce(read.promise);
    mockGetInputModePreference.mockResolvedValue('voice');
    mockGetRecordingVoiceHintCompleted.mockResolvedValue(false);
    mockViewportWidth = 1280;

    render(<RecordingScreen />);
    expect(screen.getByText('recording.draft_restore.loading')).toBeTruthy();
    expect(screen.getByTestId(TID.Screen.Recording).getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByTestId(TID.Component.RecordingDraftProgress)).toBeNull();
    expect(screen.queryByTestId('recording-voice-hint')).toBeNull();

    expect(await screen.findByText('recording.draft_restore.error')).toBeTruthy();
    expect(screen.getByTestId(TID.Screen.Recording).getAttribute('aria-busy')).toBe('false');
    const input = screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement;
    expect(input.disabled).toBe(true);
    expect((screen.getByTestId('recording-save') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId(TID.Component.RecordingDraftProgress)).toBeNull();
    expect(screen.queryByTestId('recording-voice-hint')).toBeNull();
    fireEvent.click(screen.getByTestId('recording-mode-text'));
    fireEvent.click(screen.getByTestId('recording-voice-control'));
    fireEvent.change(input, { target: { value: 'unsafe early edit' } });
    expect(input.value).toBe('');
    expect(screen.getByTestId('recording-mode').getAttribute('data-value')).toBe('voice');
    expect(mockStartRecording).not.toHaveBeenCalled();
    expect(mockSaveInputModePreference).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId(TID.Button.RecordingHome));
    expect(mockReplace).toHaveBeenCalled();

    const retry = screen.getByRole('button', { name: 'recording.draft_restore.retry' });
    act(() => {
      fireEvent.click(retry);
      fireEvent.click(retry);
    });
    await waitFor(() => expect(mockGetSavedTranscript).toHaveBeenCalledTimes(2));
    expect(screen.getByText('recording.draft_restore.loading')).toBeTruthy();
    expect((retry as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId(TID.Screen.Recording).getAttribute('aria-busy')).toBe('true');
    expect(input.disabled).toBe(true);
    expect(screen.queryByTestId(TID.Component.RecordingDraftProgress)).toBeNull();
    expect(screen.queryByTestId('recording-voice-hint')).toBeNull();
    fireEvent.change(input, { target: { value: 'unsafe retry edit' } });
    act(() => mockAppStateHandler?.('background'));
    expect(mockSaveTranscript).not.toHaveBeenCalled();

    await act(async () => { read.resolve('original durable dream'); });
    await awaitEditorReady();
    expect(input.value).toBe('original durable dream');
    expect(screen.queryByText('recording.draft_restore.loading')).toBeNull();
    expect(screen.queryByText('recording.draft_restore.error')).toBeNull();
    expect(screen.queryByRole('button', { name: 'recording.draft_restore.retry' })).toBeNull();
    expect(screen.getByTestId(TID.Component.RecordingDraftProgress)).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('conversation-question').textContent).toBe('What else do you remember?'));
    expect(mockSaveTranscript).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'continued' } });
    act(() => mockAppStateHandler?.('background'));
    await waitFor(() => expect(mockSaveTranscript).toHaveBeenCalledTimes(1));
    expect(mockSaveTranscript).toHaveBeenLastCalledWith(answerPair('original durable dream', 'continued'));
  });

  it('keeps a single shared draft when switching Write -> Tell -> Write', async () => {
    render(<RecordingScreen />);
    await awaitEditorReady();

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

  it('keeps an unfinished typed answer when switching tabs and appends the next answer', async () => {
    mockGetInputModePreference.mockResolvedValue('voice');
    render(<RecordingScreen />);
    await awaitEditorReady();
    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), { target: { value: 'Un jardin.' } });
    fireEvent.click(screen.getByTestId('conversation-submit'));
    await waitFor(() => expect(screen.getByTestId('conversation-question').textContent).toBe('What else do you remember?'));
    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), { target: { value: 'Une porte.' } });
    fireEvent.click(screen.getByTestId('recording-mode-text'));
    fireEvent.click(screen.getByTestId('recording-mode-voice'));
    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), { target: { value: 'Du soleil.' } });
    expect((screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value).toBe(answerPair(answerPair('Un jardin.', 'Une porte.'), 'Du soleil.', 'dream_recall.question.what_else'));
  });

  it('does not render the retired hamburger capture tour', () => {
    render(<RecordingScreen />);

    expect(screen.queryByTestId(TID.Component.RecordingOnboardingTour)).toBeNull();
  });

  it('shows the saved-locally copy only after the draft is persisted, including across Write/Tell', async () => {
    render(<RecordingScreen />);
    await awaitEditorReady();

    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), {
      target: { value: 'A blue room under the rain' },
    });

    const progress = screen.getByTestId(TID.Component.RecordingDraftProgress);
    expect(progress.textContent).not.toContain('recording.draft_progress.saved_locally');

    await waitFor(() => {
      expect(mockSaveTranscript).toHaveBeenCalledWith('A blue room under the rain');
      expect(progress.textContent).toContain('recording.draft_progress.saved_locally');
    });

    fireEvent.click(screen.getByTestId('recording-mode-voice'));
    await waitFor(() => {
      expect(screen.getByTestId('recording-composer').getAttribute('data-layout')).toBe('voiceFirst');
    });
    expect(screen.getByTestId(TID.Component.RecordingDraftProgress).textContent).toContain(
      'recording.draft_progress.saved_locally'
    );

    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), {
      target: { value: 'and a red bicycle' },
    });
    expect(screen.getByTestId(TID.Component.RecordingDraftProgress).textContent).not.toContain(
      'recording.draft_progress.saved_locally'
    );

    fireEvent.click(screen.getByTestId('recording-mode-text'));
    await waitFor(() => {
      expect(screen.getByTestId('recording-composer').getAttribute('data-layout')).toBe('textFirst');
    });
    expect(
      (screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value
    ).toBe(answerPair('A blue room under the rain', 'and a red bicycle'));
    expect(screen.getByTestId(TID.Component.RecordingDraftProgress).textContent).not.toContain(
      'recording.draft_progress.saved_locally'
    );
  });

  it('inserts cumulative voice partials after the kept draft without duplicating them', async () => {
    render(<RecordingScreen />);
    await awaitEditorReady();

    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), {
      target: { value: 'typed prefix' },
    });

    await waitFor(() => {
      expect(mockOnPartialTranscript).toEqual(expect.any(Function));
    });

    act(() => {
      mockOnPartialTranscript?.('a lake at dusk');
    });
    act(() => {
      mockOnPartialTranscript?.('a lake at dusk and a red bicycle');
    });

    await waitFor(() => {
      expect(
        (screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value
      ).toBe('typed prefix a lake at dusk and a red bicycle');
    });
    await waitFor(() => {
      expect(mockSaveTranscript).toHaveBeenCalledWith(
        'typed prefix a lake at dusk and a red bicycle'
      );
    });
  });

  it.each([
    [0, 0, 'grand Le jardin fleuri'],
    [3, 3, 'Le grand jardin fleuri'],
    [3, 9, 'Le grand fleuri'],
  ])('dictates at selection %i–%i and preserves surrounding text', async (start: number, end: number, expected: string) => {
    mockRecordingPermissionState = 'granted';
    render(<RecordingScreen />);
    await awaitEditorReady();
    const editor = screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: 'Le jardin fleuri' } });
    editor.setSelectionRange(start, end);
    fireEvent.select(editor);
    fireEvent.click(screen.getByTestId('recording-voice-control'));
    await waitFor(() => expect(mockStartRecording).toHaveBeenCalledTimes(1));
    act(() => mockOnPartialTranscript?.('gran'));
    act(() => mockOnPartialTranscript?.('grand'));
    expect(editor.value).toBe(expected);

    mockStopRecording.mockResolvedValueOnce({ transcript: 'grand' });
    fireEvent.click(screen.getByTestId('recording-voice-control'));
    await waitFor(() => expect(mockStopRecording).toHaveBeenCalledTimes(1));
    expect(editor.value).toBe(expected);
    await waitFor(() => expect(mockSaveTranscript).toHaveBeenCalledWith(expected));
  });

  it('uses the new cursor position when dictation is paused and resumed', async () => {
    mockRecordingPermissionState = 'granted';
    render(<RecordingScreen />);
    await awaitEditorReady();
    const editor = screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: 'Le jardin fleuri' } });
    editor.setSelectionRange(3, 3);
    fireEvent.select(editor);
    fireEvent.click(screen.getByTestId('recording-voice-control'));
    await waitFor(() => expect(mockStartRecording).toHaveBeenCalledTimes(1));
    act(() => mockOnPartialTranscript?.('grand'));
    mockStopRecording.mockImplementationOnce(async () => {
      mockIsRecordingRef.current = false;
      return { transcript: 'grand' };
    });
    fireEvent.click(screen.getByTestId('recording-voice-control'));
    await waitFor(() => expect(mockStopRecording).toHaveBeenCalledTimes(1));

    editor.setSelectionRange(0, 0);
    fireEvent.select(editor);
    fireEvent.click(screen.getByTestId('recording-voice-control'));
    await waitFor(() => expect(mockStartRecording).toHaveBeenCalledTimes(2));
    act(() => mockOnPartialTranscript?.('Hier'));
    expect(editor.value).toBe('Hier Le grand jardin fleuri');
  });

  it('continues at the insertion point after Android restarts recognition', async () => {
    mockPlatformOS = 'android';
    mockRecordingPermissionState = 'granted';
    render(<RecordingScreen />);
    await awaitEditorReady();
    const editor = screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: 'Le jardin fleuri' } });
    editor.setSelectionRange(3, 3);
    fireEvent.select(editor);
    fireEvent.click(screen.getByTestId('recording-voice-control'));
    await waitFor(() => expect(mockStartRecording).toHaveBeenCalledTimes(1));
    act(() => mockOnPartialTranscript?.('grand'));
    mockStopRecording.mockResolvedValueOnce({ transcript: 'grand' });
    await act(async () => { mockOnNativeEnd?.(); });
    await waitFor(() => expect(mockStartRecording).toHaveBeenCalledTimes(2));
    act(() => mockOnPartialTranscript?.('et beau'));
    expect(editor.value).toBe('Le grand et beau jardin fleuri');
  });

  it('keeps Tell available on Android when a local speech model is installed', async () => {
    mockPlatformOS = 'android';
    mockGetInputModePreference.mockResolvedValue('voice');

    render(<RecordingScreen />);

    await waitFor(() => {
      expect(mockResolveDeviceSpeechCapability).toHaveBeenCalled();
      expect(screen.getByTestId('recording-mode').getAttribute('data-value')).toBe('voice');
      expect(screen.getByTestId('recording-composer').getAttribute('data-layout')).toBe('voiceFirst');
    });
  });

  it('falls back to Write on Android only when speech capture is unavailable', async () => {
    mockPlatformOS = 'android';
    mockGetInputModePreference.mockResolvedValue('voice');
    mockResolveDeviceSpeechCapability.mockResolvedValue({
      tier: 'unavailable',
      reason: 'no_microphone',
      requiresOnDeviceRecognition: false,
      localAlternatives: [],
    });

    render(<RecordingScreen />);

    await waitFor(() => {
      expect(mockResolveDeviceSpeechCapability).toHaveBeenCalled();
      expect(screen.getByTestId('recording-mode').getAttribute('data-value')).toBe('text');
      expect(screen.getByTestId('recording-composer').getAttribute('data-layout')).toBe('textFirst');
    });
  });

  async function startAndroidHandsFree() {
    mockPlatformOS = 'android';
    mockRecordingPermissionState = 'granted';
    mockGetInputModePreference.mockResolvedValue('text');
    const view = render(<RecordingScreen />);
    await awaitEditorReady();
    await waitFor(() => {
      expect(screen.getByTestId('recording-voice-control')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('recording-voice-control'));
    await waitFor(() => {
      expect(mockStartRecording).toHaveBeenCalledTimes(1);
    });
    return view;
  }

  it('does not restart dictation after a native end on web', async () => {
    mockPlatformOS = 'web';
    mockRecordingPermissionState = 'granted';
    render(<RecordingScreen />);
    await awaitEditorReady();
    fireEvent.click(screen.getByTestId('recording-voice-control'));
    await waitFor(() => {
      expect(mockStartRecording).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      mockOnNativeEnd?.();
    });

    await waitFor(() => {
      expect(mockStopRecording).toHaveBeenCalledTimes(1);
    });
    expect(mockStartRecording).toHaveBeenCalledTimes(1);
  });

  it('restarts Android dictation after an unsolicited native end while listening', async () => {
    await startAndroidHandsFree();

    await act(async () => {
      mockOnNativeEnd?.();
    });

    await waitFor(() => {
      expect(mockStopRecording).toHaveBeenCalledTimes(1);
      expect(mockStartRecording).toHaveBeenCalledTimes(2);
    });
  });

  it('edits dictated words in the current answer without duplicating them or changing earlier answers', async () => {
    mockPlatformOS = 'android';
    mockRecordingPermissionState = 'granted';
    mockGetInputModePreference.mockResolvedValue('voice');
    mockGetSavedTranscript.mockResolvedValueOnce('Un jardin.');
    render(<RecordingScreen />);
    await awaitEditorReady();
    await waitFor(() => expect(screen.getByTestId('conversation-question').textContent).toBe('What else do you remember?'));
    fireEvent.click(screen.getByTestId('recording-voice-control'));
    await waitFor(() => expect(mockStartRecording).toHaveBeenCalledTimes(1));
    act(() => mockOnPartialTranscript?.('Une porte rouge.'));
    expect((screen.getByTestId('conversation-answer') as HTMLTextAreaElement).value).toBe('Une porte rouge.');
    expect(screen.getByTestId('conversation-story').textContent).toBe('Un jardin.');
    mockStopRecording.mockImplementationOnce(async () => {
      mockIsRecordingRef.current = false;
      return { transcript: 'Une porte rouge.' };
    });
    await act(async () => { fireEvent.click(screen.getByTestId('conversation-mute')); });
    fireEvent.change(screen.getByTestId('conversation-answer'), { target: { value: 'Une porte bleue.' } });
    expect((screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value).toBe(answerPair('Un jardin.', 'Une porte bleue.'));
    act(() => mockAppStateHandler?.('background'));
    await waitFor(() => expect(mockSaveTranscript).toHaveBeenLastCalledWith(answerPair('Un jardin.', 'Une porte bleue.')));
    fireEvent.click(screen.getByTestId('recording-voice-control'));
    await waitFor(() => expect(mockStartRecording).toHaveBeenCalledTimes(2));
    act(() => mockOnPartialTranscript?.('Puis un oiseau.'));
    expect((screen.getByTestId('conversation-answer') as HTMLTextAreaElement).value).toBe('Une porte bleue. Puis un oiseau.');
    mockStopRecording.mockImplementationOnce(async () => {
      mockIsRecordingRef.current = false;
      return { transcript: 'Puis un oiseau.' };
    });
    await act(async () => { fireEvent.click(screen.getByTestId('conversation-submit')); });
    expect((screen.getByTestId('conversation-answer') as HTMLTextAreaElement).value).toBe('');
    expect(screen.getByTestId('conversation-story').textContent).toBe(answerPair('Un jardin.', 'Une porte bleue. Puis un oiseau.'));
    fireEvent.change(screen.getByTestId('conversation-answer'), { target: { value: 'Du soleil.' } });
    fireEvent.change(screen.getByTestId('conversation-answer'), { target: { value: '' } });
    expect((screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value).toBe(answerPair('Un jardin.', 'Une porte bleue. Puis un oiseau.'));
  });

  it('mutes a Tell reply without requesting another question or restarting the microphone', async () => {
    mockPlatformOS = 'android';
    mockRecordingPermissionState = 'granted';
    mockGetInputModePreference.mockResolvedValue('voice');
    render(<RecordingScreen />);
    await awaitEditorReady();
    fireEvent.click(screen.getByTestId('recording-voice-control'));
    await waitFor(() => expect(mockStartRecording).toHaveBeenCalledTimes(1));
    act(() => mockOnPartialTranscript?.('Un jardin au soleil.'));
    const questionCount = mockRequestCaptureQuestion.mock.calls.length;
    await act(async () => { fireEvent.click(screen.getByTestId('conversation-mute')); });
    expect(mockStopRecording).toHaveBeenCalledTimes(1);
    expect(mockRequestCaptureQuestion).toHaveBeenCalledTimes(questionCount);
    await act(async () => { mockOnNativeEnd?.(); });
    expect(mockStartRecording).toHaveBeenCalledTimes(1);
    expect(mockRequestCaptureQuestion).toHaveBeenCalledTimes(questionCount);
    expect((screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value).toContain('Un jardin au soleil.');
  });

  it('finishes an active reply only after stopping dictation and preserving its final words', async () => {
    mockPlatformOS = 'android';
    mockRecordingPermissionState = 'granted';
    mockGetInputModePreference.mockResolvedValue('voice');
    render(<RecordingScreen />);
    await awaitEditorReady();
    fireEvent.click(screen.getByTestId('recording-voice-control'));
    await waitFor(() => expect(mockStartRecording).toHaveBeenCalledTimes(1));
    act(() => mockOnPartialTranscript?.('Un jardin'));
    mockStopRecording.mockResolvedValueOnce({ transcript: 'Un jardin au soleil.' });
    await act(async () => { fireEvent.click(screen.getByTestId('conversation-submit')); });
    expect(mockStopRecording).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mockRequestCaptureQuestion).toHaveBeenCalledWith(
      'Un jardin au soleil.', expect.any(String), expect.any(Array), expect.anything()
    ));
    expect((screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value).toContain('Un jardin au soleil.');
  });

  it('keeps a Tell answer editable after native speech ends without advancing or restarting', async () => {
    mockPlatformOS = 'android';
    mockRecordingPermissionState = 'granted';
    mockGetInputModePreference.mockResolvedValue('voice');
    render(<RecordingScreen />);
    await awaitEditorReady();
    fireEvent.click(screen.getByTestId('recording-voice-control'));
    await waitFor(() => expect(mockStartRecording).toHaveBeenCalledTimes(1));
    act(() => mockOnPartialTranscript?.('Un jardin au soleil.'));
    await act(async () => { mockOnNativeEnd?.(); });
    expect(mockRequestCaptureQuestion).not.toHaveBeenCalled();
    expect((screen.getByTestId('conversation-answer') as HTMLTextAreaElement).value).toBe('Un jardin au soleil.');
    expect(mockStopRecording).toHaveBeenCalledTimes(1);
    expect(mockStartRecording).toHaveBeenCalledTimes(1);
    await act(async () => { mockOnNativeEnd?.(); });
    expect(mockStopRecording).toHaveBeenCalledTimes(1);
  });

  it('does not restart Android dictation from a concurrent native-end while a restart is in flight', async () => {
    let releaseStop: ((value: { transcript: string }) => void) | undefined;
    mockStopRecording.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseStop = resolve;
        })
    );
    await startAndroidHandsFree();

    act(() => {
      mockOnNativeEnd?.();
      mockOnNativeEnd?.();
    });

    expect(mockStopRecording).toHaveBeenCalledTimes(1);

    await act(async () => {
      mockIsRecordingRef.current = false;
      releaseStop?.({ transcript: '' });
    });

    await waitFor(() => {
      expect(mockStartRecording).toHaveBeenCalledTimes(2);
    });
    expect(mockStopRecording).toHaveBeenCalledTimes(1);
  });

  it('does not restart after pause, then resumes only from an explicit tap', async () => {
    await startAndroidHandsFree();

    fireEvent.click(screen.getByTestId('recording-voice-control'));
    await waitFor(() => {
      expect(mockStopRecording).toHaveBeenCalledTimes(1);
    });
    expect(mockStartRecording).toHaveBeenCalledTimes(1);

    await act(async () => {
      mockOnNativeEnd?.();
    });
    expect(mockStartRecording).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('recording-voice-control'));
    await waitFor(() => {
      expect(mockStartRecording).toHaveBeenCalledTimes(2);
    });
    expect(mockStopRecording).toHaveBeenCalledTimes(1);
  });

  it('does not auto-restart after background, cleanup, or an unsolicited end once idle', async () => {
    const view = await startAndroidHandsFree();

    await waitFor(() => {
      expect(mockAppStateHandler).toEqual(expect.any(Function));
    });

    await act(async () => {
      mockAppStateHandler?.('background');
    });
    await waitFor(() => {
      expect(mockStopRecording).toHaveBeenCalledTimes(1);
    });
    expect(mockStartRecording).toHaveBeenCalledTimes(1);

    await act(async () => {
      mockOnNativeEnd?.();
    });
    expect(mockStartRecording).toHaveBeenCalledTimes(1);

    view.unmount();
    await act(async () => {
      mockOnNativeEnd?.();
    });
    expect(mockStartRecording).toHaveBeenCalledTimes(1);
    expect(mockForceStopRecording).toHaveBeenCalled();
  });

  it('keeps the shared draft across pause/resume and does not duplicate a native-end final', async () => {
    mockStopRecording.mockImplementation(async () => {
      mockIsRecordingRef.current = false;
      return { transcript: 'a lake at dusk' };
    });
    await startAndroidHandsFree();

    fireEvent.change(screen.getByTestId(TID.Input.DreamTranscript), {
      target: { value: 'typed prefix' },
    });
    act(() => {
      mockOnPartialTranscript?.('a lake at dusk');
    });
    await waitFor(() => {
      expect(
        (screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value
      ).toBe('typed prefix a lake at dusk');
    });

    fireEvent.click(screen.getByTestId('recording-voice-control'));
    await waitFor(() => {
      expect(mockStopRecording).toHaveBeenCalledTimes(1);
    });
    expect(
      (screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value
    ).toBe('typed prefix a lake at dusk');

    fireEvent.click(screen.getByTestId('recording-mode-text'));
    await waitFor(() => {
      expect(screen.getByTestId('recording-composer').getAttribute('data-layout')).toBe('textFirst');
    });
    expect(
      (screen.getByTestId(TID.Input.DreamTranscript) as HTMLTextAreaElement).value
    ).toBe('typed prefix a lake at dusk');
    expect(mockStartRecording).toHaveBeenCalledTimes(1);
  });
});
