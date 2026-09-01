/**
 * @jest-environment jsdom
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { UseDreamRecallAssistantResult } from '@/hooks/useDreamRecallAssistant';
import type { DreamRecallAssistantState } from '@/lib/dreamRecallAssistant';
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
let mockRecordingSessionOptions: {
  onNativeEnd?: () => void;
  onPartialTranscript?: (text: string, meta: { baseTranscript: string }) => void;
} = {};

const hook: UseDreamRecallAssistantResult = {
  loading: false,
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
  useDreamRecallAssistant: () => hook,
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
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
    disabled,
    onPress,
    testID,
  }: {
    accessibilityLabel?: string;
    children?: React.ReactNode;
    disabled?: boolean;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button
      aria-label={accessibilityLabel}
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
        return { remove: mockAppStateRemove };
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

describe('DreamRecallAssistantCard', () => {
  beforeEach(() => {
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

  it('shows the offer only when eligible and there is no session', () => {
    renderCard({ offerEligible: true });

    expect(screen.getByTestId(TID.Component.DreamRecallOffer)).toBeTruthy();
    expect(screen.getByTestId(TID.Button.DreamRecallStart)).toBeTruthy();
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

  it('keeps submit disabled for empty or whitespace answers and submits a trimmed answer', async () => {
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
    expect(mockSubmitAnswer).toHaveBeenCalledWith('Rain on the glass.');
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
