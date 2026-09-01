import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, Text, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { MicButton } from '@/components/recording/MicButton';
import { useTheme } from '@/context/ThemeContext';
import { useDreamRecallAssistant } from '@/hooks/useDreamRecallAssistant';
import { useRecordingSession } from '@/hooks/useRecordingSession';
import { useTranslation } from '@/hooks/useTranslation';
import { DREAM_RECALL_MAX_QUESTIONS } from '@/lib/dreamRecallQuestions';
import { getTranscriptionLocale } from '@/lib/locale';
import { canDictate } from '@/lib/speechCapability';
import { TID } from '@/lib/testIDs';
import { combineTranscript } from '@/lib/transcriptMerge';
import { resolveDeviceSpeechCapability } from '@/services/nativeSpeechRecognition';

export type DreamRecallAssistantCardProps = {
  dreamId: string;
  originalTranscript: string;
  originalPersistedSegmentId: string;
  offerEligible: boolean;
};

type RecallActionProps = {
  testID: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
};

function RecallAction({
  testID,
  label,
  onPress,
  disabled = false,
  variant = 'secondary',
}: RecallActionProps) {
  const variantClass =
    variant === 'primary'
      ? 'border-champagne-soft bg-champagne'
      : variant === 'ghost'
        ? 'border-transparent bg-transparent'
        : 'border-champagne-soft bg-transparent';
  const labelClass = variant === 'primary' ? 'text-on-champagne' : 'text-ivory';

  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className={`min-h-[48px] items-center justify-center rounded-full border border-continuous px-[18px] py-3 ${variantClass} ${disabled ? 'opacity-50' : ''}`}
    >
      <Text className={`text-center font-sans-bold text-[15px] ${labelClass}`}>{label}</Text>
    </PressableScale>
  );
}

export function DreamRecallAssistantCard({
  dreamId,
  originalTranscript,
  originalPersistedSegmentId,
  offerEligible,
}: DreamRecallAssistantCardProps) {
  const { t, currentLang } = useTranslation();
  const { colors } = useTheme();
  const [dismissedOffer, setDismissedOffer] = useState(false);
  const [answer, setAnswer] = useState('');
  const [isVoiceSupported, setIsVoiceSupported] = useState(true);
  const [voiceSupportLocale, setVoiceSupportLocale] = useState<string | null>(null);
  const [isPreparingRecording, setIsPreparingRecording] = useState(false);
  const [isVoiceTransitioning, setIsVoiceTransitioning] = useState(false);
  const [voiceError, setVoiceError] = useState(false);

  const answerRef = useRef(answer);
  const recordingTransitionRef = useRef(false);
  const stopRecordingFromNativeEndRef = useRef<(() => void) | null>(null);
  const previousQuestionKeyRef = useRef<string | null | undefined>(undefined);
  const ignoreVoiceUpdatesRef = useRef(false);
  const hasAutoStoppedRecordingRef = useRef(false);

  const {
    loading,
    state,
    currentQuestion,
    isBusy,
    error,
    start,
    submitAnswer,
    pause,
    resume,
    skip,
    complete,
  } = useDreamRecallAssistant({
    dreamId,
    originalTranscript,
    originalPersistedSegmentId,
    t,
  });

  const transcriptionLocale = useMemo(
    () => getTranscriptionLocale(currentLang),
    [currentLang]
  );

  const voiceSupportedForLocale =
    Platform.OS === 'web' || voiceSupportLocale === transcriptionLocale
      ? isVoiceSupported
      : true;

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    let isMounted = true;
    resolveDeviceSpeechCapability(transcriptionLocale)
      .then((capability) => {
        if (!isMounted) return;
        setIsVoiceSupported(canDictate(capability));
        setVoiceSupportLocale(transcriptionLocale);
      })
      .catch(() => {
        if (!isMounted) return;
        setIsVoiceSupported(true);
        setVoiceSupportLocale(transcriptionLocale);
      });

    return () => {
      isMounted = false;
    };
  }, [transcriptionLocale]);

  const recordingSession = useRecordingSession({
    transcriptionLocale,
    t,
    onNativeEnd: () => {
      stopRecordingFromNativeEndRef.current?.();
    },
    onPartialTranscript: (text, { baseTranscript }) => {
      if (ignoreVoiceUpdatesRef.current) return;
      const { text: combined } = combineTranscript({
        base: baseTranscript,
        addition: text,
      });
      setAnswer(combined);
      answerRef.current = combined;
    },
  });

  const {
    isRecording,
    isRecordingRef,
    startRecording: startSessionRecording,
    stopRecording: stopSessionRecording,
    forceStopRecording,
    baseTranscriptRef,
  } = recordingSession;

  const mergeStoppedTranscript = useCallback((transcriptText: string): string => {
    const addition = transcriptText.trim();
    const current = answerRef.current;
    if (!addition) return current;
    const { text: combined } = combineTranscript({
      base: current,
      addition,
    });
    setAnswer(combined);
    answerRef.current = combined;
    baseTranscriptRef.current = combined;
    return combined;
  }, [baseTranscriptRef]);

  const stopAndMerge = useCallback(async (): Promise<string> => {
    if (!isRecordingRef.current && !isPreparingRecording) {
      return answerRef.current;
    }
    setIsPreparingRecording(false);
    const result = await stopSessionRecording();
    const merged = mergeStoppedTranscript(result.transcript ?? '');
    if (result.error) {
      setVoiceError(true);
    } else {
      setVoiceError(false);
    }
    return merged;
  }, [isPreparingRecording, isRecordingRef, mergeStoppedTranscript, stopSessionRecording]);

  useEffect(() => {
    stopRecordingFromNativeEndRef.current = () => {
      if (recordingTransitionRef.current) return;
      recordingTransitionRef.current = true;
      setIsVoiceTransitioning(true);
      void stopAndMerge().finally(() => {
        recordingTransitionRef.current = false;
        setIsVoiceTransitioning(false);
      });
    };
    return () => {
      stopRecordingFromNativeEndRef.current = null;
    };
  }, [stopAndMerge]);

  useEffect(() => {
    return () => {
      void forceStopRecording('unmount');
    };
  }, [forceStopRecording]);

  const openQuestionKey = currentQuestion
    ? `${currentQuestion.kind}:${currentQuestion.text}`
    : null;

  useEffect(() => {
    if (previousQuestionKeyRef.current === undefined) {
      previousQuestionKeyRef.current = openQuestionKey;
      return;
    }
    if (previousQuestionKeyRef.current === openQuestionKey) return;
    previousQuestionKeyRef.current = openQuestionKey;

    ignoreVoiceUpdatesRef.current = true;
    setVoiceError(false);
    setIsPreparingRecording(false);
    setIsVoiceTransitioning(false);

    let cancelled = false;
    void (async () => {
      try {
        await forceStopRecording('blur');
        if (cancelled) return;
        setAnswer('');
        answerRef.current = '';
        baseTranscriptRef.current = '';
      } finally {
        if (!cancelled) {
          ignoreVoiceUpdatesRef.current = false;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [openQuestionKey, baseTranscriptRef, forceStopRecording]);

  useEffect(() => {
    if (!isRecording) return;

    hasAutoStoppedRecordingRef.current = false;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (
        (nextState === 'background' || nextState === 'inactive') &&
        !hasAutoStoppedRecordingRef.current
      ) {
        hasAutoStoppedRecordingRef.current = true;
        void stopAndMerge();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isRecording, stopAndMerge]);

  const startDictation = useCallback(async () => {
    setVoiceError(false);
    setIsPreparingRecording(true);
    const typed = answerRef.current;
    baseTranscriptRef.current = typed;
    try {
      const response = await startSessionRecording(typed);
      if (!response.success) {
        setVoiceError(true);
      }
    } catch {
      setVoiceError(true);
    } finally {
      setIsPreparingRecording(false);
    }
  }, [baseTranscriptRef, startSessionRecording]);

  const toggleDictation = useCallback(async () => {
    if (recordingTransitionRef.current) return;
    recordingTransitionRef.current = true;
    setIsVoiceTransitioning(true);
    try {
      if (isRecordingRef.current || isPreparingRecording) {
        await stopAndMerge();
        return;
      }
      await startDictation();
    } finally {
      recordingTransitionRef.current = false;
      setIsVoiceTransitioning(false);
    }
  }, [isPreparingRecording, isRecordingRef, startDictation, stopAndMerge]);

  const runAfterVoice = useCallback(
    async (action: (finalText: string) => Promise<void>) => {
      if (recordingTransitionRef.current) return;
      recordingTransitionRef.current = true;
      setIsVoiceTransitioning(true);
      try {
        const finalText = await stopAndMerge();
        await action(finalText);
      } finally {
        recordingTransitionRef.current = false;
        setIsVoiceTransitioning(false);
      }
    },
    [stopAndMerge]
  );

  const trimmedAnswer = answer.trim();
  const voiceLocked = isPreparingRecording || isVoiceTransitioning;
  const canSubmit =
    Boolean(currentQuestion) &&
    !isBusy &&
    !voiceLocked &&
    (isRecording || trimmedAnswer.length > 0);
  const askedCount = state?.turns.filter((turn) => turn.role === 'question').length ?? 0;
  const actionsDisabled = isBusy || voiceLocked;

  const handleLater = useCallback(() => {
    setDismissedOffer(true);
  }, []);

  const handleSubmit = useCallback(() => {
    void runAfterVoice(async (finalText) => {
      const trimmed = finalText.trim();
      if (!trimmed) return;
      await submitAnswer(trimmed);
    });
  }, [runAfterVoice, submitAnswer]);

  const handlePause = useCallback(() => {
    void runAfterVoice(async () => {
      await pause();
    });
  }, [pause, runAfterVoice]);

  const handleSkip = useCallback(() => {
    void runAfterVoice(async () => {
      await skip();
    });
  }, [runAfterVoice, skip]);

  const handleComplete = useCallback(() => {
    void runAfterVoice(async () => {
      await complete();
    });
  }, [complete, runAfterVoice]);

  const cardClass = 'mb-5 gap-3 rounded-md border border-continuous border-line bg-ink-raised p-4';
  const sessionTitle = useMemo(() => String(t('dream_recall.session.title')), [t]);
  const voiceStatus = isPreparingRecording ? 'preparing' : isRecording ? 'recording' : 'idle';
  const showMic = Boolean(currentQuestion) && state?.status === 'active' && voiceSupportedForLocale;
  const inputDisabled = isBusy || isRecording || voiceLocked;
  const micDisabled = isBusy || voiceLocked;
  const sessionActionsDisabled = isBusy || voiceLocked;

  if (loading) return null;
  if (state?.status === 'skipped') return null;

  if (!state) {
    if (!offerEligible || dismissedOffer) return null;

    return (
      <View className={cardClass} testID={TID.Component.DreamRecallOffer}>
        <Text className="font-sans text-caption uppercase tracking-[0] text-champagne-on">
          {String(t('dream_recall.offer.eyebrow'))}
        </Text>
        <Text className="font-sans-bold text-[18px] text-ivory">
          {String(t('dream_recall.offer.title'))}
        </Text>
        <Text className="font-sans text-body-sm text-ivory-muted">
          {String(t('dream_recall.offer.body'))}
        </Text>
        <View className="mt-1 flex-row flex-wrap gap-2">
          <RecallAction
            testID={TID.Button.DreamRecallStart}
            label={String(t('dream_recall.offer.start'))}
            onPress={() => {
              void start();
            }}
            disabled={actionsDisabled}
            variant="primary"
          />
          <RecallAction
            testID={TID.Button.DreamRecallLater}
            label={String(t('dream_recall.offer.later'))}
            onPress={handleLater}
            disabled={actionsDisabled}
            variant="ghost"
          />
        </View>
      </View>
    );
  }

  if (state.status === 'completed') {
    return (
      <View className={cardClass} testID={TID.Component.DreamRecallAssistantCard}>
        <Text className="font-sans-bold text-[18px] text-ivory">
          {String(t('dream_recall.session.completed_title'))}
        </Text>
        <Text className="font-sans text-body-sm text-ivory-muted">
          {String(t('dream_recall.session.completed_body'))}
        </Text>
      </View>
    );
  }

  if (state.status === 'paused') {
    return (
      <View className={cardClass} testID={TID.Component.DreamRecallAssistantCard}>
        <Text className="font-sans-bold text-[18px] text-ivory">{sessionTitle}</Text>
        {currentQuestion ? (
          <Text className="font-sans text-body text-ivory">{currentQuestion.text}</Text>
        ) : null}
        <View className="mt-1 flex-row flex-wrap gap-2">
          <RecallAction
            testID={TID.Button.DreamRecallResume}
            label={String(t('dream_recall.session.resume'))}
            onPress={() => {
              void resume();
            }}
            disabled={actionsDisabled}
            variant="primary"
          />
          <RecallAction
            testID={TID.Button.DreamRecallSkip}
            label={String(t('dream_recall.session.skip'))}
            onPress={handleSkip}
            disabled={actionsDisabled}
            variant="ghost"
          />
        </View>
      </View>
    );
  }

  if (state.status !== 'active') return null;

  const inputLabel = String(t('dream_recall.session.input_label'));
  const placeholder = String(t('dream_recall.session.input_placeholder'));

  return (
    <View className={cardClass} testID={TID.Component.DreamRecallAssistantCard}>
      <View className="flex-row items-baseline justify-between gap-3">
        <Text className="flex-1 font-sans-bold text-[18px] text-ivory">{sessionTitle}</Text>
        <Text className="font-sans text-caption text-ivory-muted">
          {String(
            t('dream_recall.session.progress', {
              current: askedCount,
              total: DREAM_RECALL_MAX_QUESTIONS,
            })
          )}
        </Text>
      </View>

      {currentQuestion ? (
        <>
          <Text className="font-sans text-body text-ivory">{currentQuestion.text}</Text>
          <View className="gap-2">
            <Text className="font-sans text-caption text-ivory-muted">{inputLabel}</Text>
            <View className="flex-row items-start gap-2">
              <TextInput
                testID={TID.Input.DreamRecallAnswer}
                value={answer}
                onChangeText={(text) => {
                  setAnswer(text);
                  answerRef.current = text;
                  if (!isRecordingRef.current) {
                    baseTranscriptRef.current = text;
                  }
                }}
                editable={!inputDisabled}
                multiline
                accessibilityLabel={inputLabel}
                accessibilityState={{ disabled: inputDisabled }}
                placeholder={placeholder}
                placeholderTextColor={colors.textSecondary}
                className="min-h-[96px] flex-1 rounded-md border border-line bg-ink-soft px-4 py-3 font-sans text-[16px] text-ivory"
              />
              {showMic ? (
                <MicButton
                  status={voiceStatus}
                  onPress={() => {
                    void toggleDictation();
                  }}
                  size="inline"
                  interaction={micDisabled ? 'disabled' : 'enabled'}
                  testID={TID.Button.DreamRecallMic}
                  accessibilityLabel={String(
                    t(isRecording ? 'dream_recall.session.voice_stop' : 'dream_recall.session.voice_start')
                  )}
                />
              ) : null}
            </View>
          </View>
        </>
      ) : (
        <>
          <Text accessibilityLiveRegion="polite" className="font-sans text-body-sm text-danger-on">
            {String(t('dream_recall.session.error'))}
          </Text>
          <RecallAction
            testID={TID.Button.DreamRecallStart}
            label={String(t('dream_recall.offer.start'))}
            onPress={() => {
              void start();
            }}
            disabled={actionsDisabled}
            variant="primary"
          />
        </>
      )}

      {isBusy ? (
        <Text className="font-sans text-body-sm text-ivory-muted">
          {String(t('dream_recall.session.saving'))}
        </Text>
      ) : null}

      {error && currentQuestion ? (
        <Text accessibilityLiveRegion="polite" className="font-sans text-body-sm text-danger-on">
          {String(t('dream_recall.session.error'))}
        </Text>
      ) : null}

      {voiceError && currentQuestion ? (
        <Text accessibilityLiveRegion="polite" className="font-sans text-body-sm text-danger-on">
          {String(t('dream_recall.session.voice_error'))}
        </Text>
      ) : null}

      {currentQuestion ? (
        <View className="mt-1 flex-row flex-wrap gap-2">
          <RecallAction
            testID={TID.Button.DreamRecallSubmit}
            label={String(t('dream_recall.session.submit'))}
            onPress={handleSubmit}
            disabled={!canSubmit}
            variant="primary"
          />
          <RecallAction
            testID={TID.Button.DreamRecallPause}
            label={String(t('dream_recall.session.pause'))}
            onPress={handlePause}
            disabled={sessionActionsDisabled}
          />
          <RecallAction
            testID={TID.Button.DreamRecallSkip}
            label={String(t('dream_recall.session.skip'))}
            onPress={handleSkip}
            disabled={sessionActionsDisabled}
            variant="ghost"
          />
          <RecallAction
            testID={TID.Button.DreamRecallComplete}
            label={String(t('dream_recall.session.complete'))}
            onPress={handleComplete}
            disabled={sessionActionsDisabled}
            variant="ghost"
          />
        </View>
      ) : null}
    </View>
  );
}
