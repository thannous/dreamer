/**
 * @jest-environment jsdom
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { UseDreamRecallAssistantResult } from '@/hooks/useDreamRecallAssistant';
import {
  addDreamRecallUserSegment,
  appendNeutralRecallQuestion,
  pauseDreamRecallAssistant,
  serializeDreamRecallAssistantState,
  startDreamRecallAssistant,
  type DreamRecallAssistantState,
} from '@/lib/dreamRecallAssistant';
import { TID } from '@/lib/testIDs';
import { DreamRecallAssistantCard } from '../DreamRecallAssistantCard';

const ORIGINAL = 'I flew over a quiet city with a blue door.';
const QUESTION = { kind: 'what_else' as const, text: 'What else do you remember?' };

const mockStart = jest.fn(async () => undefined);
const mockSubmitAnswer = jest.fn(async (_text: string) => undefined);
const mockPause = jest.fn(async () => undefined);
const mockResume = jest.fn(async () => undefined);
const mockSkip = jest.fn(async () => undefined);
const mockComplete = jest.fn(async () => undefined);
const mockRetryHydration = jest.fn(async () => undefined);
const mockUpdateDraftAnswer = jest.fn((_text: string) => undefined);
let mockPublishDraft: (() => void) | undefined;
let mockUseRealRecall = false;
const mockRecallBytes = new Map<string, string>();

const mockStartRecording = jest.fn(async (_typed: string) => ({ success: true }));
const mockStopRecording = jest.fn(async () => ({ transcript: '' as string, error: undefined as string | undefined }));
const mockForceStopRecording = jest.fn(async (_reason: 'blur' | 'unmount') => undefined);
const mockCanDictate = jest.fn((capability: { tier: string }) => capability.tier !== 'unavailable');
const mockResolveCapability = jest.fn(async () => ({ tier: 'on_device' }));
const mockAppStateRemove = jest.fn();

const mockRecording = {
  isRecording: false,
  isRecordingRef: { current: false },
  baseTranscriptRef: { current: '' },
};

const mockPlatform = { OS: 'ios' as 'ios' | 'web' | 'android' };
let mockAppStateListener: ((state: string) => void) | undefined;
const mockAppStateListeners = new Set<(state: string) => void>();
let mockRecordingSessionOptions: {
  onNativeEnd?: () => void;
  onPartialTranscript?: (text: string, meta: { baseTranscript: string }) => void;
} = {};

const hook: UseDreamRecallAssistantResult = {
  loading: false,
  hydrationStatus: 'ready',
  retryHydration: mockRetryHydration,
  draftAnswer: '',
  updateDraftAnswer: mockUpdateDraftAnswer,
  state: null,
  hasSession: false,
  currentQuestion: null,
  isBusy: false,
  error: null,
  start: mockStart,
  submitAnswer: mockSubmitAnswer,
  pause: mockPause,
  resume: mockResume,
  skip: mockSkip,
  complete: mockComplete,
};

jest.mock('@/hooks/useDreamRecallAssistant', () => ({
  useDreamRecallAssistant: (params: unknown) => {
    const [, publish] = require('react').useState(0);
    mockPublishDraft = () => publish((value: number) => value + 1);
    const actual = jest.requireActual('@/hooks/useDreamRecallAssistant') as typeof import('@/hooks/useDreamRecallAssistant');
    return mockUseRealRecall
      ? actual.useDreamRecallAssistant(params as Parameters<typeof actual.useDreamRecallAssistant>[0])
      : hook;
  },
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      'dream_recall.question.what_else': QUESTION.text,
      'dream_recall.question.where': 'Where did this take place?',
    }[key] ?? key),
    currentLang: 'en',
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      textSecondary: '#57516f',
    },
  }),
}));

jest.mock('@/components/motion', () => ({
  PressableScale: ({
    accessibilityLabel,
    children,
    className,
    disabled,
    onPress,
    testID,
  }: {
    accessibilityLabel?: string;
    children?: React.ReactNode;
    className?: string;
    disabled?: boolean;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button
      aria-label={accessibilityLabel}
      className={className}
      data-testid={testID}
      disabled={disabled}
      onClick={onPress}
      type="button"
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/recording/MicButton', () => ({
  MicButton: ({
    accessibilityLabel,
    interaction,
    onPress,
    status,
    testID,
  }: {
    accessibilityLabel?: string;
    interaction?: string;
    onPress?: () => void;
    status?: string;
    testID?: string;
  }) => (
    <button
      aria-label={accessibilityLabel}
      data-interaction={interaction}
      data-status={status}
      data-testid={testID}
      disabled={interaction === 'disabled'}
      onClick={onPress}
      type="button"
    />
  ),
}));

jest.mock('@/hooks/useRecordingSession', () => ({
  useRecordingSession: (options: {
    onNativeEnd?: () => void;
    onPartialTranscript?: (text: string, meta: { baseTranscript: string }) => void;
  }) => {
    mockRecordingSessionOptions = options;
    return {
      get isRecording() {
        return mockRecording.isRecording;
      },
      isRecordingRef: mockRecording.isRecordingRef,
      startRecording: mockStartRecording,
      stopRecording: mockStopRecording,
      forceStopRecording: mockForceStopRecording,
      baseTranscriptRef: mockRecording.baseTranscriptRef,
    };
  },
}));

jest.mock('@/lib/speechCapability', () => ({
  canDictate: (capability: { tier: string }) => mockCanDictate(capability),
}));

jest.mock('@/services/nativeSpeechRecognition', () => ({
  resolveDeviceSpeechCapability: (locale: string) => mockResolveCapability(locale),
}));

jest.mock('react-native', () => {
  const React = require('react');
  const toDomProps = (props: Record<string, any>) => {
    const {
      testID,
      onPress,
      accessibilityRole,
      accessibilityLabel,
      accessibilityState: _accessibilityState,
      disabled,
      editable,
      onChangeText,
      placeholderTextColor: _placeholderTextColor,
      multiline: _multiline,
      className,
      ...rest
    } = props;
    return {
      ...rest,
      className,
      ...(testID ? { 'data-testid': testID } : {}),
      ...(onPress ? { onClick: onPress } : {}),
      ...(accessibilityRole ? { role: accessibilityRole } : {}),
      ...(accessibilityLabel ? { 'aria-label': accessibilityLabel } : {}),
      ...(disabled || editable === false ? { disabled: true } : {}),
      ...(typeof onChangeText === 'function'
        ? {
            onChange: (event: any) => onChangeText(event.target.value),
          }
        : {}),
    };
  };

  const createElement = (tag: string) => {
    const MockNativeElement = ({
      children,
      ...props
    }: {
      children?: any;
      [key: string]: unknown;
    }) => React.createElement(tag, toDomProps(props), children);
    MockNativeElement.displayName = `MockNative${tag}`;
    return MockNativeElement;
  };

  return {
    AppState: {
      currentState: 'active',
      addEventListener: (_event: string, listener: (state: string) => void) => {
        mockAppStateListener = listener;
        mockAppStateListeners.add(listener);
        return { remove: () => { mockAppStateListeners.delete(listener); mockAppStateRemove(); } };
      },
    },
    Platform: {
      get OS() {
        return mockPlatform.OS;
      },
    },
    Text: createElement('span'),
    TextInput: createElement('textarea'),
    View: createElement('div'),
  };
});

function resetHook(overrides: Partial<UseDreamRecallAssistantResult> = {}) {
  hook.loading = false;
  hook.hydrationStatus = 'ready';
  hook.retryHydration = mockRetryHydration;
  hook.draftAnswer = '';
  hook.updateDraftAnswer = mockUpdateDraftAnswer;
  hook.state = null;
  hook.hasSession = false;
  hook.currentQuestion = null;
  hook.isBusy = false;
  hook.error = null;
  hook.start = mockStart;
  hook.submitAnswer = mockSubmitAnswer;
  hook.pause = mockPause;
  hook.resume = mockResume;
  hook.skip = mockSkip;
  hook.complete = mockComplete;
  Object.assign(hook, overrides);
  hook.hasSession = hook.state != null;
}

function sessionState(
  status: DreamRecallAssistantState['status'],
  turns: DreamRecallAssistantState['turns'] = []
): DreamRecallAssistantState {
  return {
    schemaVersion: 1,
    dreamId: 'dream-42',
    originalTranscript: ORIGINAL,
    originalTranscriptHash: 'v1:deadbeef',
    originalPersistedSegmentId: 'persisted-original-42',
    status,
    turns,
    pendingUserSegment: null,
    maxQuestions: 5,
    startedAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    completedAt: status === 'completed' || status === 'skipped' ? 1_700_000_000_100 : null,
  };
}

const openQuestionTurn = {
  id: 'q-1',
  role: 'question' as const,
  kind: QUESTION.kind,
  text: QUESTION.text,
  createdAt: 1_700_000_000_000,
};

const QUESTION_TWO = { kind: 'where' as const, text: 'Where did this take place?' };

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function resetRecording() {
  mockRecording.isRecording = false;
  mockRecording.isRecordingRef.current = false;
  mockRecording.baseTranscriptRef.current = '';
  mockPlatform.OS = 'ios';
  mockAppStateListener = undefined;
  mockAppStateListeners.clear();
  mockRecordingSessionOptions = {};
  mockStartRecording.mockReset();
  mockStopRecording.mockReset();
  mockForceStopRecording.mockReset();
  mockCanDictate.mockReset();
  mockResolveCapability.mockReset();
  mockAppStateRemove.mockReset();
  mockStartRecording.mockImplementation(async () => {
    mockRecording.isRecording = true;
    mockRecording.isRecordingRef.current = true;
    return { success: true };
  });
  mockStopRecording.mockImplementation(async () => {
    mockRecording.isRecording = false;
    mockRecording.isRecordingRef.current = false;
    return { transcript: '', error: undefined };
  });
  mockForceStopRecording.mockResolvedValue(undefined);
  mockCanDictate.mockImplementation((capability: { tier: string }) => capability.tier !== 'unavailable');
  mockResolveCapability.mockResolvedValue({ tier: 'on_device' });
}

function setRecording(active: boolean) {
  mockRecording.isRecording = active;
  mockRecording.isRecordingRef.current = active;
}

function renderActiveQuestion(
  overrides: Partial<UseDreamRecallAssistantResult> = {},
  props: Partial<React.ComponentProps<typeof DreamRecallAssistantCard>> = {}
) {
  resetHook({
    state: sessionState('active', [openQuestionTurn]),
    currentQuestion: QUESTION,
    ...overrides,
  });
  return renderCard(props);
}

function renderCard(
  props: Partial<React.ComponentProps<typeof DreamRecallAssistantCard>> = {}
) {
  return render(
    <DreamRecallAssistantCard
      dreamId="dream-42"
      originalTranscript={ORIGINAL}
      originalPersistedSegmentId="persisted-original-42"
      offerEligible
      {...props}
    />
  );
}

function legacyPendingRecall(text: string, status: 'active' | 'paused' = 'paused') {
  const started = startDreamRecallAssistant({
    dreamId: 'dream-42', originalTranscript: ORIGINAL,
    originalPersistedSegmentId: 'persisted-original-42', now: 1_700_000_000_000,
  }).state;
  const question = appendNeutralRecallQuestion(started, QUESTION, 1_700_000_000_001).state;
  const pending = addDreamRecallUserSegment(question, text, 1_700_000_000_002).state;
  const state = status === 'paused' ? pauseDreamRecallAssistant(pending, 1_700_000_000_003).state : pending;
  const { answerDraft: _draft, ...legacy } = state;
  return legacy;
}

describe('DreamRecallAssistantCard', () => {
  beforeEach(async () => {
    mockUseRealRecall = false;
    mockRecallBytes.clear();
    jest.mocked(AsyncStorage.getItem).mockImplementation(async (key: string) => mockRecallBytes.get(key) ?? null);
    jest.mocked(AsyncStorage.setItem).mockImplementation(async (key: string, value: string) => { mockRecallBytes.set(key, value); });
    mockRetryHydration.mockClear();
    mockUpdateDraftAnswer.mockClear();
    mockUpdateDraftAnswer.mockImplementation((text: string) => {
      hook.draftAnswer = text;
      mockPublishDraft?.();
    });
    mockStart.mockClear();
    mockSubmitAnswer.mockClear();
    mockPause.mockClear();
    mockResume.mockClear();
    mockSkip.mockClear();
    mockComplete.mockClear();
    resetRecording();
    resetHook();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing while loading', () => {
    resetHook({ loading: true });
    const { container } = renderCard();

    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId(TID.Component.DreamRecallOffer)).toBeNull();
    expect(screen.queryByTestId(TID.Component.DreamRecallAssistantCard)).toBeNull();
  });

  it.each([
    [TID.Button.DreamRecallComplete, 'completed'],
    [TID.Button.DreamRecallSkip, 'skipped'],
  ])('retains valid legacy pending bytes through paused %s', async (button: string, status: string) => {
    mockUseRealRecall = true;
    const text = '  Legacy durable detail\r\nkept verbatim  ';
    const legacy = legacyPendingRecall(text);
    await AsyncStorage.setItem('dream_recall_assistant:dream-42', serializeDreamRecallAssistantState(legacy));
    renderCard();
    await waitFor(() => { expect(screen.getByTestId(TID.Button.DreamRecallResume)).toBeTruthy(); });
    fireEvent.click(screen.getByTestId(button));
    await waitFor(async () => {
      const saved = JSON.parse((await AsyncStorage.getItem('dream_recall_assistant:dream-42'))!);
      expect(saved.status).toBe(status);
      expect(saved.turns.map((turn: { role: string }) => turn.role)).toEqual(['question', 'answer']);
      expect(saved.turns[1].text).toBe(text);
      expect(saved.turns[1].segmentId).toBe(legacy.pendingUserSegment?.id);
      expect(saved.originalTranscript).toBe(ORIGINAL);
    });
  });

  it.each(['submit', 'complete', 'skip'])('recovers legacy active text after hydration mark failure through %s', async (action: string) => {
    mockUseRealRecall = true;
    const text = '  Legacy active detail\r\nwith raw lines  ';
    const legacy = legacyPendingRecall(text, 'active');
    const originalBytes = serializeDreamRecallAssistantState(legacy);
    await AsyncStorage.setItem('dream_recall_assistant:dream-42', originalBytes);
    let failed = false;
    jest.mocked(AsyncStorage.setItem).mockImplementation(async (key: string, value: string) => {
      const state = JSON.parse(value) as DreamRecallAssistantState;
      if (!failed && state.pendingUserSegment?.persisted === true) {
        failed = true;
        throw new Error('legacy mark blocked');
      }
      mockRecallBytes.set(key, value);
    });
    renderCard();
    await waitFor(() => { expect(screen.getByText('dream_recall.session.error')).toBeTruthy(); });
    expect((screen.getByTestId(TID.Input.DreamRecallAnswer) as HTMLTextAreaElement).value).toBe(text.replace(/\r\n/g, '\n'));
    expect(await AsyncStorage.getItem('dream_recall_assistant:dream-42')).toBe(originalBytes);
    const button = action === 'submit' ? TID.Button.DreamRecallSubmit
      : action === 'complete' ? TID.Button.DreamRecallComplete : TID.Button.DreamRecallSkip;
    await waitFor(() => { expect((screen.getByTestId(button) as HTMLButtonElement).disabled).toBe(false); });
    fireEvent.click(screen.getByTestId(button));
    await waitFor(async () => {
      const saved = JSON.parse((await AsyncStorage.getItem('dream_recall_assistant:dream-42'))!);
      expect(saved.status).toBe(action === 'submit' ? 'active' : action === 'complete' ? 'completed' : 'skipped');
      expect(saved.turns.filter((turn: { role: string }) => turn.role === 'answer')).toHaveLength(1);
      expect(saved.turns.filter((turn: { role: string }) => turn.role === 'question')).toHaveLength(action === 'submit' ? 2 : 1);
      expect(saved.turns[1].text).toBe(text);
      expect(saved.turns[1].segmentId).toBe(legacy.pendingUserSegment?.id);
      expect(saved.originalTranscript).toBe(ORIGINAL);
    });
  });

  it('respects an explicit empty edit of restored legacy text before completion', async () => {
    mockUseRealRecall = true;
    const legacy = legacyPendingRecall('Legacy text intentionally cleared', 'active');
    await AsyncStorage.setItem('dream_recall_assistant:dream-42', serializeDreamRecallAssistantState(legacy));
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('mark blocked'));
    renderCard();
    await waitFor(() => { expect(screen.getByText('dream_recall.session.error')).toBeTruthy(); });
    fireEvent.change(screen.getByTestId(TID.Input.DreamRecallAnswer), { target: { value: '' } });
    fireEvent.click(screen.getByTestId(TID.Button.DreamRecallComplete));
    await waitFor(() => { expect(screen.getByText('dream_recall.session.completed_title')).toBeTruthy(); });
    const saved = JSON.parse((await AsyncStorage.getItem('dream_recall_assistant:dream-42'))!);
    expect(saved.turns.map((turn: { role: string }) => turn.role)).toEqual(['question']);
    expect(saved.pendingUserSegment).toBeNull();
    expect(saved.originalTranscript).toBe(ORIGINAL);
  });

  it('keeps final speech received during a delayed background pause without committing an older legacy answer', async () => {
    mockUseRealRecall = true;
    const oldText = 'Legacy old detail';
    const finalText = 'Legacy old detail with new final speech';
    await AsyncStorage.setItem('dream_recall_assistant:dream-42', serializeDreamRecallAssistantState(legacyPendingRecall(oldText, 'active')));
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('mark blocked'));
    const finalSpeech = deferred<{ transcript: string; error: undefined }>();
    mockStopRecording.mockImplementationOnce(async () => {
      const result = await finalSpeech.promise;
      setRecording(false);
      return result;
    });
    renderCard();
    await waitFor(() => { expect(screen.getByText('dream_recall.session.error')).toBeTruthy(); });
    fireEvent.click(screen.getByTestId(TID.Button.DreamRecallMic));
    await waitFor(() => { expect(mockStartRecording).toHaveBeenCalled(); });
    const pauseWrite = deferred<void>();
    let pauseStarted = false;
    jest.mocked(AsyncStorage.setItem).mockImplementationOnce(async (key: string, value: string) => {
      pauseStarted = true;
      await pauseWrite.promise;
      mockRecallBytes.set(key, value);
    });
    act(() => { mockAppStateListeners.forEach((listener) => listener('background')); });
    await waitFor(() => { expect(pauseStarted).toBe(true); });
    await act(async () => { finalSpeech.resolve({ transcript: finalText, error: undefined }); });
    await act(async () => { pauseWrite.resolve(); });
    await waitFor(() => { expect(screen.getByTestId(TID.Button.DreamRecallResume)).toBeTruthy(); });
    fireEvent.click(screen.getByTestId(TID.Button.DreamRecallResume));
    await waitFor(() => {
      expect((screen.getByTestId(TID.Input.DreamRecallAnswer) as HTMLTextAreaElement).value).toBe(finalText);
    });
    const saved = JSON.parse((await AsyncStorage.getItem('dream_recall_assistant:dream-42'))!);
    expect(saved.turns.map((turn: { role: string }) => turn.role)).toEqual(['question']);
    expect(saved.answerDraft.text).toBe(finalText);
    expect(saved.pendingUserSegment).toBeNull();
  });

  it('shows restore retry after read failure without offering a new session', async () => {
    mockUseRealRecall = true;
    const read = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('read locked'));
    renderCard();
    await waitFor(() => { expect(screen.getByText('recording.draft_restore.error')).toBeTruthy(); });
    expect(screen.queryByTestId(TID.Button.DreamRecallStart)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'recording.draft_restore.retry' }));
    await waitFor(() => { expect(screen.getByTestId(TID.Button.DreamRecallStart)).toBeTruthy(); });
    read.mockRestore();
  });

  it('restores typed and partial voice details after pause, unmount and resume with real hook/storage', async () => {
    mockUseRealRecall = true;
    const view = renderCard();
    await waitFor(() => { expect(screen.getByTestId(TID.Button.DreamRecallStart)).toBeTruthy(); });
    fireEvent.click(screen.getByTestId(TID.Button.DreamRecallStart));
    await waitFor(() => { expect(screen.getByTestId(TID.Input.DreamRecallAnswer)).toBeTruthy(); });
    fireEvent.change(screen.getByTestId(TID.Input.DreamRecallAnswer), { target: { value: 'Typed beginning' } });
    fireEvent.click(screen.getByTestId(TID.Button.DreamRecallMic));
    await waitFor(() => { expect(mockStartRecording).toHaveBeenCalled(); });
    await act(async () => {
      mockRecordingSessionOptions.onPartialTranscript?.('partial voice detail', { baseTranscript: 'Typed beginning' });
    });
    mockStopRecording.mockResolvedValueOnce({ transcript: 'partial voice detail with final words', error: undefined });
    fireEvent.click(screen.getByTestId(TID.Button.DreamRecallPause));
    await waitFor(() => { expect(screen.getByTestId(TID.Button.DreamRecallResume)).toBeTruthy(); });
    view.unmount();
    setRecording(false);
    renderCard();
    await waitFor(() => { expect(screen.getByTestId(TID.Button.DreamRecallResume)).toBeTruthy(); });
    fireEvent.click(screen.getByTestId(TID.Button.DreamRecallResume));
    await waitFor(() => {
      expect((screen.getByTestId(TID.Input.DreamRecallAnswer) as HTMLTextAreaElement).value)
        .toBe('Typed beginning\npartial voice detail with final words');
    });
    expect(screen.getByText(QUESTION.text)).toBeTruthy();
    const raw = await AsyncStorage.getItem('dream_recall_assistant:dream-42');
    const saved = JSON.parse(raw!);
    expect(saved.turns).toHaveLength(1);
    expect(saved.originalTranscript).toBe(ORIGINAL);
  });

  it.each([
    [TID.Button.DreamRecallComplete, 'completed'],
    [TID.Button.DreamRecallSkip, 'skipped'],
  ])('waits for final speech and durably retains it on %s', async (button: string, status: string) => {
    mockUseRealRecall = true;
    const stopped = deferred<{ transcript: string; error: undefined }>();
    mockStopRecording.mockImplementationOnce(() => stopped.promise);
    renderCard();
    await waitFor(() => { expect(screen.getByTestId(TID.Button.DreamRecallStart)).toBeTruthy(); });
    fireEvent.click(screen.getByTestId(TID.Button.DreamRecallStart));
    await waitFor(() => { expect(screen.getByTestId(TID.Input.DreamRecallAnswer)).toBeTruthy(); });
    fireEvent.change(screen.getByTestId(TID.Input.DreamRecallAnswer), { target: { value: 'Typed detail' } });
    fireEvent.click(screen.getByTestId(TID.Button.DreamRecallMic));
    await waitFor(() => { expect(mockStartRecording).toHaveBeenCalled(); });
    fireEvent.click(screen.getByTestId(button));
    expect(screen.queryByText('dream_recall.session.completed_title')).toBeNull();
    await act(async () => { stopped.resolve({ transcript: 'final speech detail', error: undefined }); });
    await waitFor(async () => {
      const saved = JSON.parse((await AsyncStorage.getItem('dream_recall_assistant:dream-42'))!);
      expect(saved.status).toBe(status);
      expect(saved.turns.map((turn: { role: string }) => turn.role)).toEqual(['question', 'answer']);
      expect(saved.turns[1].text).toBe('Typed detail\nfinal speech detail');
      expect(saved.originalTranscript).toBe(ORIGINAL);
    });
  });

  it.each(['mark', 'advance'])('recovers a failed %s write through the displayed action in the same mount', async (phase: string) => {
    mockUseRealRecall = true;
    renderCard();
    await waitFor(() => { expect(screen.getByTestId(TID.Button.DreamRecallStart)).toBeTruthy(); });
    fireEvent.click(screen.getByTestId(TID.Button.DreamRecallStart));
    await waitFor(() => { expect(screen.getByTestId(TID.Input.DreamRecallAnswer)).toBeTruthy(); });
    let failed = false;
    jest.mocked(AsyncStorage.setItem).mockImplementation(async (key: string, value: string) => {
      const state = JSON.parse(value) as DreamRecallAssistantState;
      if (!failed && (phase === 'mark' ? state.pendingUserSegment?.persisted === true : state.turns.length === 3)) {
        failed = true;
        throw new Error('write blocked');
      }
      mockRecallBytes.set(key, value);
    });
    fireEvent.change(screen.getByTestId(TID.Input.DreamRecallAnswer), { target: { value: 'Keep this detail' } });
    fireEvent.click(screen.getByTestId(TID.Button.DreamRecallSubmit));
    await waitFor(() => { expect(screen.getByText('dream_recall.session.error')).toBeTruthy(); });
    if (phase === 'mark') {
      expect((screen.getByTestId(TID.Input.DreamRecallAnswer) as HTMLTextAreaElement).value).toBe('Keep this detail');
      fireEvent.click(screen.getByTestId(TID.Button.DreamRecallSubmit));
    } else {
      expect(screen.queryByTestId(TID.Input.DreamRecallAnswer)).toBeNull();
      await waitFor(() => {
        expect((screen.getByTestId(TID.Button.DreamRecallStart) as HTMLButtonElement).disabled).toBe(false);
      });
      fireEvent.click(screen.getByTestId(TID.Button.DreamRecallStart));
    }
    await waitFor(() => { expect(screen.getByText(QUESTION_TWO.text)).toBeTruthy(); });
    const saved = JSON.parse((await AsyncStorage.getItem('dream_recall_assistant:dream-42'))!);
    expect(saved.turns.map((turn: { role: string }) => turn.role)).toEqual(['question', 'answer', 'question']);
    expect(saved.turns[1].text).toBe('Keep this detail');
  });

  it.each(['mark', 'terminal'])('retries completion after a paused %s failure through the visible card action', async (phase: string) => {
    mockUseRealRecall = true;
    renderCard();
    await waitFor(() => { expect(screen.getByTestId(TID.Button.DreamRecallStart)).toBeTruthy(); });
    fireEvent.click(screen.getByTestId(TID.Button.DreamRecallStart));
    await waitFor(() => { expect(screen.getByTestId(TID.Input.DreamRecallAnswer)).toBeTruthy(); });
    let failed = false;
    jest.mocked(AsyncStorage.setItem).mockImplementation(async (key: string, value: string) => {
      const state = JSON.parse(value) as DreamRecallAssistantState;
      if (!failed && (phase === 'mark'
        ? state.status === 'paused' && state.pendingUserSegment?.persisted === true
        : state.status === 'completed')) {
        failed = true;
        throw new Error('terminal progress blocked');
      }
      mockRecallBytes.set(key, value);
    });
    fireEvent.change(screen.getByTestId(TID.Input.DreamRecallAnswer), { target: { value: 'Final details' } });
    fireEvent.click(screen.getByTestId(TID.Button.DreamRecallComplete));
    await waitFor(() => { expect(screen.getByTestId(TID.Button.DreamRecallResume)).toBeTruthy(); });
    expect(screen.getByText('dream_recall.session.error')).toBeTruthy();
    expect(screen.queryByText('dream_recall.session.completed_title')).toBeNull();
    await waitFor(() => {
      expect((screen.getByTestId(TID.Button.DreamRecallComplete) as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(screen.getByTestId(TID.Button.DreamRecallComplete));
    await waitFor(() => { expect(screen.getByText('dream_recall.session.completed_title')).toBeTruthy(); });
    const saved = JSON.parse((await AsyncStorage.getItem('dream_recall_assistant:dream-42'))!);
    expect(saved.turns.map((turn: { role: string }) => turn.role)).toEqual(['question', 'answer']);
    expect(saved.turns[1].text).toBe('Final details');
  });

  it('shows the offer only when eligible and there is no session', () => {
    renderCard({ offerEligible: true });

    expect(screen.getByTestId(TID.Component.DreamRecallOffer)).toBeTruthy();
    const start = screen.getByTestId(TID.Button.DreamRecallStart);
    expect(start).toBeTruthy();
    expect(start.className).toContain('bg-transparent');
    expect(start.className).not.toContain('bg-champagne');
    expect(screen.getByTestId(TID.Button.DreamRecallLater)).toBeTruthy();
    expect(screen.queryByTestId(TID.Component.DreamRecallAssistantCard)).toBeNull();
    expect(screen.queryByText(ORIGINAL)).toBeNull();

    cleanup();
    renderCard({ offerEligible: false });
    expect(screen.queryByTestId(TID.Component.DreamRecallOffer)).toBeNull();
  });

  it('hides the offer after later and calls start from the offer', () => {
    renderCard();

    fireEvent.click(screen.getByTestId(TID.Button.DreamRecallLater));
    expect(screen.queryByTestId(TID.Component.DreamRecallOffer)).toBeNull();
    expect(mockStart).not.toHaveBeenCalled();

    cleanup();
    resetHook();
    renderCard();
    fireEvent.click(screen.getByTestId(TID.Button.DreamRecallStart));
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('keeps an active session visible even when the offer is no longer eligible', () => {
    resetHook({
      state: sessionState('active', [openQuestionTurn]),
      currentQuestion: QUESTION,
    });
    renderCard({ offerEligible: false });

    expect(screen.queryByTestId(TID.Component.DreamRecallOffer)).toBeNull();
    expect(screen.getByTestId(TID.Component.DreamRecallAssistantCard)).toBeTruthy();
    expect(screen.getByText(QUESTION.text)).toBeTruthy();
    expect(screen.getByTestId(TID.Input.DreamRecallAnswer)).toBeTruthy();
    expect(screen.queryByText(ORIGINAL)).toBeNull();
    expect(screen.getByTestId(TID.Component.DreamRecallAssistantCard).textContent).not.toContain(
      ORIGINAL
    );
  });

  it('keeps submit disabled for empty or whitespace answers and submits raw answer text', async () => {
    resetHook({
      state: sessionState('active', [openQuestionTurn]),
      currentQuestion: QUESTION,
    });
    renderCard();

    const submit = screen.getByTestId(TID.Button.DreamRecallSubmit) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(submit);
    expect(mockSubmitAnswer).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId(TID.Input.DreamRecallAnswer), {
      target: { value: '   ' },
    });
    expect(submit.disabled).toBe(true);
    fireEvent.click(submit);
    expect(mockSubmitAnswer).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId(TID.Input.DreamRecallAnswer), {
      target: { value: '  Rain on the glass.  ' },
    });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    await waitFor(() => {
      expect(mockSubmitAnswer).toHaveBeenCalledTimes(1);
    });
    expect(mockSubmitAnswer).toHaveBeenCalledWith('  Rain on the glass.  ');
  });

  it('disables session actions while busy', () => {
    resetHook({
      state: sessionState('active', [openQuestionTurn]),
      currentQuestion: QUESTION,
      isBusy: true,
    });
    renderCard();

    expect(screen.getByText('dream_recall.session.saving')).toBeTruthy();
    expect((screen.getByTestId(TID.Button.DreamRecallSubmit) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect((screen.getByTestId(TID.Button.DreamRecallPause) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect((screen.getByTestId(TID.Button.DreamRecallSkip) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect((screen.getByTestId(TID.Button.DreamRecallComplete) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect((screen.getByTestId(TID.Input.DreamRecallAnswer) as HTMLTextAreaElement).disabled).toBe(
      true
    );
  });

  it('keeps the question UI when an error is exposed', () => {
    resetHook({
      state: sessionState('active', [openQuestionTurn]),
      currentQuestion: QUESTION,
      error: new Error('write failed'),
    });
    renderCard();

    expect(screen.getByText(QUESTION.text)).toBeTruthy();
    expect(screen.getByText('dream_recall.session.error')).toBeTruthy();
    expect(screen.getByTestId(TID.Input.DreamRecallAnswer)).toBeTruthy();
    expect(screen.getByTestId(TID.Button.DreamRecallSubmit)).toBeTruthy();
    expect(screen.queryByText(ORIGINAL)).toBeNull();
  });

  it('shows a retry start action when active without an open question', () => {
    resetHook({
      state: sessionState('active'),
      currentQuestion: null,
      error: new Error('blocked next question'),
    });
    renderCard();

    expect(screen.getByTestId(TID.Component.DreamRecallAssistantCard)).toBeTruthy();
    expect(screen.getByText('dream_recall.session.error')).toBeTruthy();
    expect(screen.getByTestId(TID.Button.DreamRecallStart)).toBeTruthy();
    expect(screen.queryByTestId(TID.Input.DreamRecallAnswer)).toBeNull();
    expect(screen.queryByTestId(TID.Button.DreamRecallSubmit)).toBeNull();

    fireEvent.click(screen.getByTestId(TID.Button.DreamRecallStart));
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('exposes resume and skip while paused', async () => {
    resetHook({
      state: sessionState('paused', [openQuestionTurn]),
      currentQuestion: QUESTION,
    });
    renderCard();

    expect(screen.getByTestId(TID.Component.DreamRecallAssistantCard)).toBeTruthy();
    expect(screen.getByText(QUESTION.text)).toBeTruthy();
    expect(screen.queryByTestId(TID.Input.DreamRecallAnswer)).toBeNull();

    fireEvent.click(screen.getByTestId(TID.Button.DreamRecallResume));
    fireEvent.click(screen.getByTestId(TID.Button.DreamRecallSkip));
    await waitFor(() => {
      expect(mockResume).toHaveBeenCalledTimes(1);
      expect(mockSkip).toHaveBeenCalledTimes(1);
    });
  });

  it('renders the completed confirmation and nothing when skipped', () => {
    resetHook({
      state: sessionState('completed', [openQuestionTurn]),
      currentQuestion: null,
    });
    renderCard();

    expect(screen.getByTestId(TID.Component.DreamRecallAssistantCard)).toBeTruthy();
    expect(screen.getByText('dream_recall.session.completed_title')).toBeTruthy();
    expect(screen.getByText('dream_recall.session.completed_body')).toBeTruthy();
    expect(screen.queryByTestId(TID.Button.DreamRecallSubmit)).toBeNull();

    cleanup();
    resetHook({
      state: sessionState('skipped'),
      currentQuestion: null,
    });
    const skipped = renderCard({ offerEligible: true });
    expect(skipped.container.firstChild).toBeNull();
    expect(screen.queryByTestId(TID.Component.DreamRecallOffer)).toBeNull();
    expect(screen.queryByTestId(TID.Component.DreamRecallAssistantCard)).toBeNull();
  });

  it('wires pause and complete actions on an active question', async () => {
    resetHook({
      state: sessionState('active', [openQuestionTurn]),
      currentQuestion: QUESTION,
    });
    renderCard();

    fireEvent.click(screen.getByTestId(TID.Button.DreamRecallPause));
    await waitFor(() => {
      expect(mockPause).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByTestId(TID.Button.DreamRecallComplete));
    await waitFor(() => {
      expect(mockComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('dictation', () => {
    it('shows the mic only for an active question, not offer, paused, or completed', () => {
      renderCard();
      expect(screen.queryByTestId(TID.Button.DreamRecallMic)).toBeNull();

      cleanup();
      renderActiveQuestion();
      expect(screen.getByTestId(TID.Button.DreamRecallMic)).toBeTruthy();

      cleanup();
      resetHook({
        state: sessionState('paused', [openQuestionTurn]),
        currentQuestion: QUESTION,
      });
      renderCard();
      expect(screen.queryByTestId(TID.Button.DreamRecallMic)).toBeNull();

      cleanup();
      resetHook({
        state: sessionState('completed', [openQuestionTurn]),
        currentQuestion: null,
      });
      renderCard();
      expect(screen.queryByTestId(TID.Button.DreamRecallMic)).toBeNull();
    });

    it('hides the mic when speech capability is unavailable', async () => {
      mockResolveCapability.mockResolvedValue({ tier: 'unavailable' });
      renderActiveQuestion();

      await waitFor(() => {
        expect(screen.queryByTestId(TID.Button.DreamRecallMic)).toBeNull();
      });
      expect(mockResolveCapability).toHaveBeenCalledWith('en-US');
    });

    it('starts recording with already typed text', async () => {
      renderActiveQuestion();

      fireEvent.change(screen.getByTestId(TID.Input.DreamRecallAnswer), {
        target: { value: 'Rain on the glass' },
      });
      fireEvent.click(screen.getByTestId(TID.Button.DreamRecallMic));

      await waitFor(() => {
        expect(mockStartRecording).toHaveBeenCalledWith('Rain on the glass');
      });
      expect(mockRecording.baseTranscriptRef.current).toBe('Rain on the glass');
      expect(mockSubmitAnswer).not.toHaveBeenCalled();
    });

    it('keeps the typed prefix when a partial transcript arrives', async () => {
      renderActiveQuestion();
      fireEvent.change(screen.getByTestId(TID.Input.DreamRecallAnswer), {
        target: { value: 'Rain on the glass' },
      });
      fireEvent.click(screen.getByTestId(TID.Button.DreamRecallMic));
      await waitFor(() => {
        expect(mockStartRecording).toHaveBeenCalled();
      });

      await act(async () => {
        mockRecordingSessionOptions.onPartialTranscript?.('by the canal', {
          baseTranscript: mockRecording.baseTranscriptRef.current,
        });
      });

      expect((screen.getByTestId(TID.Input.DreamRecallAnswer) as HTMLTextAreaElement).value).toBe(
        'Rain on the glass\nby the canal'
      );
    });

    it('merges the final transcript on stop and native end without submitting', async () => {
      mockStopRecording.mockImplementation(async () => {
        mockRecording.isRecording = false;
        mockRecording.isRecordingRef.current = false;
        return { transcript: 'Rain on the glass by the canal', error: undefined };
      });
      renderActiveQuestion();
      fireEvent.change(screen.getByTestId(TID.Input.DreamRecallAnswer), {
        target: { value: 'Rain on the glass' },
      });
      fireEvent.click(screen.getByTestId(TID.Button.DreamRecallMic));
      await waitFor(() => {
        expect(mockStartRecording).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByTestId(TID.Button.DreamRecallMic));
      await waitFor(() => {
        expect(mockStopRecording).toHaveBeenCalledTimes(1);
      });
      expect((screen.getByTestId(TID.Input.DreamRecallAnswer) as HTMLTextAreaElement).value).toBe(
        'Rain on the glass by the canal'
      );
      expect(mockSubmitAnswer).not.toHaveBeenCalled();

      setRecording(true);
      mockStopRecording.mockClear();
      mockStopRecording.mockImplementation(async () => {
        mockRecording.isRecording = false;
        mockRecording.isRecordingRef.current = false;
        return { transcript: 'and a red bicycle', error: undefined };
      });

      await act(async () => {
        mockRecordingSessionOptions.onNativeEnd?.();
      });
      await waitFor(() => {
        expect(mockStopRecording).toHaveBeenCalledTimes(1);
      });
      expect((screen.getByTestId(TID.Input.DreamRecallAnswer) as HTMLTextAreaElement).value).toContain(
        'and a red bicycle'
      );
      expect(mockSubmitAnswer).not.toHaveBeenCalled();
    });

    it('waits for stop then submits the final text when saving during recording', async () => {
      const gate = deferred<{ transcript: string; error?: string }>();
      mockStopRecording.mockImplementation(async () => {
        const result = await gate.promise;
        mockRecording.isRecording = false;
        mockRecording.isRecordingRef.current = false;
        return result;
      });
      renderActiveQuestion();
      fireEvent.change(screen.getByTestId(TID.Input.DreamRecallAnswer), {
        target: { value: 'Rain on the glass' },
      });
      fireEvent.click(screen.getByTestId(TID.Button.DreamRecallMic));
      await waitFor(() => {
        expect(mockStartRecording).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByTestId(TID.Button.DreamRecallSubmit));
      expect(mockSubmitAnswer).not.toHaveBeenCalled();
      expect(mockStopRecording).toHaveBeenCalled();

      await act(async () => {
        gate.resolve({ transcript: 'Rain on the glass by the canal' });
      });
      await waitFor(() => {
        expect(mockSubmitAnswer).toHaveBeenCalledWith('Rain on the glass by the canal');
      });
    });

    it('stops recording before pause, skip, and complete', async () => {
      const order: string[] = [];
      mockStopRecording.mockImplementation(async () => {
        order.push('stop');
        mockRecording.isRecording = false;
        mockRecording.isRecordingRef.current = false;
        return { transcript: 'Rain on the glass', error: undefined };
      });
      mockPause.mockImplementation(async () => {
        order.push('pause');
      });
      mockSkip.mockImplementation(async () => {
        order.push('skip');
      });
      mockComplete.mockImplementation(async () => {
        order.push('complete');
      });

      renderActiveQuestion();
      fireEvent.click(screen.getByTestId(TID.Button.DreamRecallMic));
      await waitFor(() => {
        expect(mockStartRecording).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByTestId(TID.Button.DreamRecallPause));
      await waitFor(() => {
        expect(order).toEqual(['stop', 'pause']);
      });

      order.length = 0;
      setRecording(true);
      fireEvent.click(screen.getByTestId(TID.Button.DreamRecallSkip));
      await waitFor(() => {
        expect(order).toEqual(['stop', 'skip']);
      });

      order.length = 0;
      setRecording(true);
      fireEvent.click(screen.getByTestId(TID.Button.DreamRecallComplete));
      await waitFor(() => {
        expect(order).toEqual(['stop', 'complete']);
      });
    });

    it('force-stops recording on unmount', () => {
      const { unmount } = renderActiveQuestion();
      unmount();
      expect(mockForceStopRecording).toHaveBeenCalledWith('unmount');
    });

    it('disables mic, input, and save while busy or transitioning', async () => {
      const view = renderActiveQuestion({ isBusy: true });
      expect((screen.getByTestId(TID.Button.DreamRecallMic) as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByTestId(TID.Input.DreamRecallAnswer) as HTMLTextAreaElement).disabled).toBe(true);
      expect((screen.getByTestId(TID.Button.DreamRecallSubmit) as HTMLButtonElement).disabled).toBe(true);

      cleanup();
      const startGate = deferred<{ success: boolean }>();
      mockStartRecording.mockImplementation(async () => startGate.promise);
      renderActiveQuestion();
      fireEvent.change(screen.getByTestId(TID.Input.DreamRecallAnswer), {
        target: { value: 'Rain' },
      });
      fireEvent.click(screen.getByTestId(TID.Button.DreamRecallMic));

      await waitFor(() => {
        expect((screen.getByTestId(TID.Button.DreamRecallMic) as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByTestId(TID.Input.DreamRecallAnswer) as HTMLTextAreaElement).disabled).toBe(true);
        expect((screen.getByTestId(TID.Button.DreamRecallSubmit) as HTMLButtonElement).disabled).toBe(true);
      });

      await act(async () => {
        startGate.resolve({ success: true });
      });
      expect(view).toBeTruthy();
    });

    it('keeps typed text and shows voice_error when start fails', async () => {
      mockStartRecording.mockImplementation(async () => ({ success: false }));
      renderActiveQuestion();
      fireEvent.change(screen.getByTestId(TID.Input.DreamRecallAnswer), {
        target: { value: 'Rain on the glass' },
      });
      fireEvent.click(screen.getByTestId(TID.Button.DreamRecallMic));

      await waitFor(() => {
        expect(screen.getByText('dream_recall.session.voice_error')).toBeTruthy();
      });
      expect((screen.getByTestId(TID.Input.DreamRecallAnswer) as HTMLTextAreaElement).value).toBe(
        'Rain on the glass'
      );
      expect(mockSubmitAnswer).not.toHaveBeenCalled();
    });

    it('force-stops and clears the answer when the question changes, without mixing transcripts', async () => {
      const view = renderActiveQuestion();
      fireEvent.change(screen.getByTestId(TID.Input.DreamRecallAnswer), {
        target: { value: 'Rain on the glass' },
      });
      fireEvent.click(screen.getByTestId(TID.Button.DreamRecallMic));
      await waitFor(() => {
        expect(mockStartRecording).toHaveBeenCalled();
      });

      resetHook({
        state: sessionState('active', [
          openQuestionTurn,
          {
            id: 'a-1',
            role: 'answer',
            text: 'Rain on the glass',
            createdAt: 1_700_000_000_010,
            segmentId: 'seg-1',
          },
          {
            id: 'q-2',
            role: 'question',
            kind: QUESTION_TWO.kind,
            text: QUESTION_TWO.text,
            createdAt: 1_700_000_000_020,
          },
        ]),
        currentQuestion: QUESTION_TWO,
      });
      view.rerender(
        <DreamRecallAssistantCard
          dreamId="dream-42"
          originalTranscript={ORIGINAL}
          originalPersistedSegmentId="persisted-original-42"
          offerEligible={false}
        />
      );

      await waitFor(() => {
        expect(mockForceStopRecording).toHaveBeenCalledWith('blur');
        expect((screen.getByTestId(TID.Input.DreamRecallAnswer) as HTMLTextAreaElement).value).toBe('');
      });
      expect(screen.getByText(QUESTION_TWO.text)).toBeTruthy();
      expect(screen.queryByText('Rain on the glass')).toBeNull();
    });

    it('stops and merges on AppState background', async () => {
      mockStopRecording.mockImplementation(async () => {
        mockRecording.isRecording = false;
        mockRecording.isRecordingRef.current = false;
        return { transcript: 'by the canal', error: undefined };
      });
      renderActiveQuestion();
      fireEvent.change(screen.getByTestId(TID.Input.DreamRecallAnswer), {
        target: { value: 'Rain on the glass' },
      });
      fireEvent.click(screen.getByTestId(TID.Button.DreamRecallMic));
      await waitFor(() => {
        expect(mockStartRecording).toHaveBeenCalled();
      });

      await act(async () => {
        mockAppStateListener?.('background');
      });
      await waitFor(() => {
        expect(mockStopRecording).toHaveBeenCalled();
      });
      expect((screen.getByTestId(TID.Input.DreamRecallAnswer) as HTMLTextAreaElement).value).toBe(
        'Rain on the glass\nby the canal'
      );
      expect(mockSubmitAnswer).not.toHaveBeenCalled();
    });

    it('does not truncate a longer partial when the final result is shorter', async () => {
      renderActiveQuestion();
      fireEvent.change(screen.getByTestId(TID.Input.DreamRecallAnswer), {
        target: { value: 'Rain on the glass' },
      });
      fireEvent.click(screen.getByTestId(TID.Button.DreamRecallMic));
      await waitFor(() => {
        expect(mockStartRecording).toHaveBeenCalled();
      });

      await act(async () => {
        mockRecordingSessionOptions.onPartialTranscript?.('Rain on the glass by the canal', {
          baseTranscript: 'Rain on the glass',
        });
      });
      expect((screen.getByTestId(TID.Input.DreamRecallAnswer) as HTMLTextAreaElement).value).toBe(
        'Rain on the glass by the canal'
      );

      mockStopRecording.mockImplementation(async () => {
        mockRecording.isRecording = false;
        mockRecording.isRecordingRef.current = false;
        return { transcript: 'Rain on the glass', error: undefined };
      });
      fireEvent.click(screen.getByTestId(TID.Button.DreamRecallMic));
      await waitFor(() => {
        expect(mockStopRecording).toHaveBeenCalled();
      });
      expect((screen.getByTestId(TID.Input.DreamRecallAnswer) as HTMLTextAreaElement).value).toBe(
        'Rain on the glass by the canal'
      );
    });
  });
});
