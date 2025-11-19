import { AnalysisProgress } from '@/components/analysis/AnalysisProgress';
import { MicButton } from '@/components/recording/MicButton';
import { Waveform } from '@/components/recording/Waveform';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { GradientColors } from '@/constants/gradients';
import { ThemeLayout } from '@/constants/journalTheme';
import { GUEST_DREAM_LIMIT } from '@/constants/limits';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useDreams } from '@/context/DreamsContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { AnalysisStep, useAnalysisProgress } from '@/hooks/useAnalysisProgress';
import { useQuota } from '@/hooks/useQuota';
import { useTranslation } from '@/hooks/useTranslation';
import { classifyError, QuotaError } from '@/lib/errors';
import { TID } from '@/lib/testIDs';
import type { DreamAnalysis } from '@/lib/types';
import { transcribeAudio } from '@/services/speechToText';
import {
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    AppState,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
  extension: '.caf',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 128000,
  android: {
    ...RecordingPresets.HIGH_QUALITY.android,
    extension: '.amr',
    outputFormat: 'amrwb',
    audioEncoder: 'amr_wb',
    sampleRate: 16000,
  },
  ios: {
    ...RecordingPresets.HIGH_QUALITY.ios,
    extension: '.caf',
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.MEDIUM,
    sampleRate: 16000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

const RECORDER_RELEASE_ERROR_SNIPPET = 'shared object that was already released';

const isRecorderReleasedError = (error: unknown): error is Error => {
  return (
    error instanceof Error &&
    typeof error.message === 'string' &&
    error.message.toLowerCase().includes(RECORDER_RELEASE_ERROR_SNIPPET)
  );
};

const handleRecorderReleaseError = (context: string, error: unknown): boolean => {
  if (isRecorderReleasedError(error)) {
    if (__DEV__) {
      console.warn(`[Recording] AudioRecorder already released during ${context}.`, error);
    }
    return true;
  }
  return false;
};

export default function RecordingScreen() {
  const { addDream, dreams, analyzeDream } = useDreams();
  const { colors, shadows, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [draftDream, setDraftDream] = useState<DreamAnalysis | null>(null);
  const [firstDreamPrompt, setFirstDreamPrompt] = useState<DreamAnalysis | null>(null);
  const [analyzePromptDream, setAnalyzePromptDream] = useState<DreamAnalysis | null>(null);
  const [pendingAnalysisDream, setPendingAnalysisDream] = useState<DreamAnalysis | null>(null);
  const [isPersisting, setIsPersisting] = useState(false);
  const [showGuestLimitSheet, setShowGuestLimitSheet] = useState(false);
  const [pendingGuestLimitDream, setPendingGuestLimitDream] = useState<DreamAnalysis | null>(null);
  const audioRecorder = useAudioRecorder(RECORDING_OPTIONS);
  const analysisProgress = useAnalysisProgress();
  const hasAutoStoppedRecordingRef = useRef(false);
  const { language } = useLanguage();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { canAnalyzeNow } = useQuota();
  const trimmedTranscript = useMemo(() => transcript.trim(), [transcript]);
  const isAnalyzing = analysisProgress.step !== AnalysisStep.IDLE && analysisProgress.step !== AnalysisStep.COMPLETE;
  const interactionDisabled = isPersisting || isAnalyzing;

  const transcriptionLocale = useMemo(() => {
    switch (language) {
      case 'fr':
        return 'fr-FR';
      case 'es':
        return 'es-ES';
      default:
        return 'en-US';
    }
  }, [language]);

  // Request microphone permissions on mount
  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert(
          t('recording.alert.permission_required.title'),
          t('recording.alert.permission_required.message')
        );
      }
    })();
  }, [t]);

  const deriveDraftTitle = useCallback(() => {
    if (!trimmedTranscript) {
      return t('recording.draft.default_title');
    }
    const firstLine = trimmedTranscript.split('\n')[0]?.trim() ?? '';
    if (!firstLine) {
      return t('recording.draft.default_title');
    }
    return firstLine.length > 64 ? `${firstLine.slice(0, 64)}…` : firstLine;
  }, [trimmedTranscript, t]);

  const buildDraftDream = useCallback((): DreamAnalysis => {
    const title = deriveDraftTitle();
    return {
      id: Date.now(),
      transcript: trimmedTranscript,
      title,
      interpretation: '',
      shareableQuote: '',
      theme: undefined,
      dreamType: 'Symbolic Dream',
      imageUrl: '',
      thumbnailUrl: undefined,
      chatHistory: trimmedTranscript
        ? [{ role: 'user', text: `Here is my dream: ${trimmedTranscript}` }]
        : [],
      isFavorite: false,
      imageGenerationFailed: false,
      isAnalyzed: false,
      analysisStatus: 'none',
    };
  }, [deriveDraftTitle, trimmedTranscript]);

  const ensureDraftSaved = useCallback(async () => {
    if (draftDream && draftDream.transcript === trimmedTranscript) {
      return draftDream;
    }
    const draft = buildDraftDream();
    const saved = await addDream(draft);
    setDraftDream(saved);
    return saved;
  }, [draftDream, trimmedTranscript, buildDraftDream, addDream]);

  const resetComposer = useCallback(() => {
    setTranscript('');
    setDraftDream(null);
    analysisProgress.reset();
  }, [analysisProgress]);

  const navigateAfterSave = useCallback(
    (savedDream: DreamAnalysis, previousDreamCount: number, options?: { skipFirstDreamSheet?: boolean }) => {
      if (options?.skipFirstDreamSheet) {
        router.replace(`/journal/${savedDream.id}`);
        return;
      }

      if (previousDreamCount === 0) {
        setFirstDreamPrompt(savedDream);
        return;
      }

      setAnalyzePromptDream(savedDream);
    },
    []
  );

  useEffect(() => {
    if (!user || !pendingGuestLimitDream) {
      return;
    }

    let cancelled = false;

    const persistPendingGuestDream = async () => {
      try {
        setIsPersisting(true);
        const preCount = dreams.length;
        const savedDream = await addDream(pendingGuestLimitDream);
        if (cancelled) {
          return;
        }
        resetComposer();
        setPendingGuestLimitDream(null);
        navigateAfterSave(savedDream, preCount, { skipFirstDreamSheet: true });
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error ? error.message : 'Unexpected error occurred. Please try again.';
        Alert.alert(t('common.error_title'), message);
      } finally {
        if (!cancelled) {
          setIsPersisting(false);
        }
      }
    };

    void persistPendingGuestDream();

    return () => {
      cancelled = true;
    };
  }, [user, pendingGuestLimitDream, addDream, dreams.length, navigateAfterSave, resetComposer, t]);

  const startRecording = useCallback(async () => {
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert(
          t('recording.alert.permission_required.title'),
          t('recording.alert.permission_required.message')
        );
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      hasAutoStoppedRecordingRef.current = false;
      await audioRecorder.prepareToRecordAsync(RECORDING_OPTIONS);
      audioRecorder.record();
      setIsRecording(true);
    } catch (err) {
      if (__DEV__) {
        console.error('Failed to start recording:', err);
      }
      Alert.alert(t('common.error_title'), t('recording.alert.start_failed'));
    }
  }, [audioRecorder, t]);

  const stopRecording = useCallback(async () => {
    try {
      setIsRecording(false);
      await audioRecorder.stop();
      const uri = audioRecorder.uri ?? undefined;

      if (uri) {
        try {
          const transcribedText = await transcribeAudio({ uri, languageCode: transcriptionLocale });
          if (transcribedText) {
            setTranscript((prev) => (prev ? `${prev}\n${transcribedText}` : transcribedText));
          } else {
            Alert.alert(
              t('recording.alert.no_speech.title'),
              t('recording.alert.no_speech.message')
            );
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown transcription error';
          Alert.alert(t('recording.alert.transcription_failed.title'), msg);
        }
      } else {
        Alert.alert(
          t('recording.alert.recording_invalid.title'),
          t('recording.alert.recording_invalid.message')
        );
      }
    } catch (err) {
      if (handleRecorderReleaseError('stopRecording', err)) {
        return;
      }
      if (__DEV__) {
        console.error('Failed to stop recording:', err);
      }
      Alert.alert(t('common.error_title'), t('recording.alert.stop_failed'));
    } finally {
      try {
        await setAudioModeAsync({ allowsRecording: false });
      } catch (err) {
        if (__DEV__) {
          console.warn('Failed to reset audio mode after recording:', err);
        }
      }
      hasAutoStoppedRecordingRef.current = false;
    }
  }, [audioRecorder, transcriptionLocale, t]);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, stopRecording, startRecording]);

  useEffect(() => {
    hasAutoStoppedRecordingRef.current = false;

    const subscription = AppState.addEventListener('change', (state) => {
      try {
        if ((state === 'background' || state === 'inactive') && audioRecorder.isRecording && !hasAutoStoppedRecordingRef.current) {
          hasAutoStoppedRecordingRef.current = true;
          void stopRecording();
        }
      } catch (error) {
        handleRecorderReleaseError('appStateChange', error);
      }
    });

    return () => {
      subscription.remove();
      try {
        if (audioRecorder.isRecording && !hasAutoStoppedRecordingRef.current) {
          hasAutoStoppedRecordingRef.current = true;
          void stopRecording();
        }
      } catch (error) {
        if (!handleRecorderReleaseError('appStateCleanup', error)) {
          throw error;
        }
      }
    };
  }, [audioRecorder, stopRecording]);

  const handleSaveDream = useCallback(async () => {
    if (!trimmedTranscript) {
      Alert.alert(t('recording.alert.empty.title'), t('recording.alert.empty.message'));
      return;
    }

    if (!user && dreams.length >= GUEST_DREAM_LIMIT - 1) {
      const draft =
        draftDream && draftDream.transcript === trimmedTranscript
          ? draftDream
          : buildDraftDream();
      setPendingGuestLimitDream(draft);
      setShowGuestLimitSheet(true);
      return;
    }

    setIsPersisting(true);
    try {
      const preCount = dreams.length;
      const savedDream = await ensureDraftSaved();
      resetComposer();
      navigateAfterSave(savedDream, preCount);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error occurred. Please try again.';
      Alert.alert(t('common.error_title'), message);
    } finally {
      setIsPersisting(false);
    }
  }, [
    trimmedTranscript,
    dreams.length,
    draftDream,
    buildDraftDream,
    ensureDraftSaved,
    navigateAfterSave,
    resetComposer,
    t,
    user,
  ]);


  const handleGoToJournal = useCallback(() => {
    router.push('/(tabs)/journal');
  }, []);

  const handleFirstDreamDismiss = useCallback(() => {
    if (!firstDreamPrompt) {
      return;
    }
    setFirstDreamPrompt(null);
    setPendingAnalysisDream(null);
  }, [firstDreamPrompt]);

  const handleFirstDreamJournal = useCallback(() => {
    if (!firstDreamPrompt) {
      return;
    }
    setFirstDreamPrompt(null);
    setPendingAnalysisDream(null);
    router.push('/(tabs)/journal');
  }, [firstDreamPrompt]);

  const handleAnalyzePromptDismiss = useCallback(() => {
    if (!analyzePromptDream) {
      return;
    }
    setAnalyzePromptDream(null);
    setPendingAnalysisDream(null);
  }, [analyzePromptDream]);

  const handleAnalyzePromptJournal = useCallback(() => {
    if (!analyzePromptDream) {
      return;
    }
    setAnalyzePromptDream(null);
    setPendingAnalysisDream(null);
    router.push('/(tabs)/journal');
  }, [analyzePromptDream]);

  const handleFirstDreamAnalyze = useCallback(async () => {
    const dream = firstDreamPrompt ?? analyzePromptDream ?? pendingAnalysisDream;
    if (!dream) {
      return;
    }
    if (!canAnalyzeNow) {
      const tier = user ? 'free' : 'guest';
      const limit = tier === 'guest' ? 2 : 5;
      const title = tier === 'guest'
        ? t('recording.alert.analysis_limit.title_guest')
        : t('recording.alert.analysis_limit.title_free');
      const message = tier === 'guest'
        ? t('recording.alert.analysis_limit.message_guest', { limit })
        : t('recording.alert.analysis_limit.message_free', { limit });

      Alert.alert(
        title,
        message,
        [
          {
            text: t('recording.alert.limit.cta'),
            onPress: () => router.push('/(tabs)/settings'),
          },
          { text: t('common.cancel'), style: 'cancel' },
        ]
      );
      return;
    }

    if (firstDreamPrompt) {
      setFirstDreamPrompt(null);
    }
    if (analyzePromptDream) {
      setAnalyzePromptDream(null);
    }
    setPendingAnalysisDream(dream);

    setIsPersisting(true);
    const preCount = dreams.length;
    try {
      analysisProgress.reset();
      analysisProgress.setStep(AnalysisStep.ANALYZING);

      const analyzedDream = await analyzeDream(dream.id, dream.transcript);

      analysisProgress.setStep(AnalysisStep.COMPLETE);
      setPendingAnalysisDream(null);
      resetComposer();
      await new Promise((resolve) => setTimeout(resolve, 300));
      navigateAfterSave(analyzedDream, preCount, { skipFirstDreamSheet: true });
    } catch (error) {
      if (error instanceof QuotaError) {
        const title = error.tier === 'guest'
          ? t('recording.alert.analysis_limit.title_guest')
          : t('recording.alert.analysis_limit.title_free');
        Alert.alert(
          title,
          error.userMessage,
          [
            {
              text: t('recording.alert.limit.cta'),
              onPress: () => router.push('/(tabs)/settings'),
            },
            { text: t('common.cancel'), style: 'cancel' },
          ]
        );
        analysisProgress.reset();
      } else {
        const classified = classifyError(error as Error);
        analysisProgress.setError(classified);
      }
    } finally {
      setIsPersisting(false);
    }
  }, [
    analysisProgress,
    analyzeDream,
    analyzePromptDream,
    canAnalyzeNow,
    dreams.length,
    firstDreamPrompt,
    pendingAnalysisDream,
    navigateAfterSave,
    resetComposer,
    t,
    user,
  ]);

  const gradientColors = mode === 'dark'
    ? GradientColors.surreal
    : ([colors.backgroundSecondary, colors.backgroundDark] as readonly [string, string]);

  return (
    <>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          testID={TID.Screen.Recording}
        >
          {/* Main Content */}
          <View style={styles.mainContent}>
            <View style={styles.recordingSection}>
              <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
                {t('recording.instructions')}
              </Text>

              <MicButton
                isRecording={isRecording}
                onPress={toggleRecording}
                disabled={interactionDisabled}
                testID={TID.Button.RecordToggle}
              />

              <Waveform isActive={isRecording} />
            </View>

            {/* Text Input */}
            <View style={styles.textInputSection}>
              <TextInput
                value={transcript}
                onChangeText={setTranscript}
                placeholder={t('recording.placeholder')}
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.textInput,
                  shadows.md,
                  {
                    backgroundColor: colors.backgroundSecondary,
                    color: colors.textPrimary,
                  },
                ]}
                multiline
                editable={!interactionDisabled}
                testID={TID.Input.DreamTranscript}
                accessibilityLabel={t('recording.placeholder.accessibility')}
              />
              {/* Analysis Progress */}
              {analysisProgress.step !== AnalysisStep.IDLE && analysisProgress.step !== AnalysisStep.COMPLETE && (
                <AnalysisProgress
                  step={analysisProgress.step}
                  progress={analysisProgress.progress}
                  message={analysisProgress.message}
                  error={analysisProgress.error}
                  onRetry={pendingAnalysisDream ? handleFirstDreamAnalyze : undefined}
                />
              )}

              {/* Actions */}
              <View style={styles.actionButtons}>
                <Pressable
                  onPress={handleSaveDream}
                  disabled={!trimmedTranscript || interactionDisabled}
                  style={[
                    styles.submitButton,
                    shadows.lg,
                    { backgroundColor: colors.accent },
                    (!trimmedTranscript || interactionDisabled) && [styles.submitButtonDisabled, { backgroundColor: colors.textSecondary }],
                  ]}
                  testID={TID.Button.SaveDream}
                  accessibilityRole="button"
                  accessibilityLabel={t('recording.button.save_dream_accessibility', { defaultValue: t('recording.button.save_dream') })}
                >
                  <Text style={styles.submitButtonText}>
                    💾 {t('recording.button.save_dream')}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={handleGoToJournal}
                style={styles.journalLinkButton}
                testID={TID.Button.NavigateJournal}
                accessibilityRole="link"
                accessibilityLabel={t('recording.nav_button.accessibility')}
              >
                <Text style={[styles.journalLinkText, { color: colors.accent }]}>
                  {t('recording.nav_button')}
                </Text>
              </Pressable>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
      <BottomSheet
        visible={Boolean(firstDreamPrompt)}
        onClose={handleFirstDreamDismiss}
        backdropColor={mode === 'dark' ? 'rgba(2, 0, 12, 0.75)' : 'rgba(0, 0, 0, 0.25)'}
        style={[
          styles.firstDreamSheet,
          {
            backgroundColor: colors.backgroundCard,
            paddingBottom: insets.bottom + ThemeLayout.spacing.md,
          },
          shadows.xl,
        ]}
      >
        <View style={[styles.sheetHandle, { backgroundColor: colors.divider }]} />
        <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
          {t('guest.first_dream.sheet.title')}
        </Text>
        <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
          {t('guest.first_dream.sheet.subtitle')}
        </Text>
        <View style={styles.sheetButtons}>
          <Pressable
            style={[
              styles.sheetPrimaryButton,
              { backgroundColor: colors.accent },
              isPersisting && styles.sheetDisabledButton,
            ]}
            onPress={handleFirstDreamAnalyze}
            disabled={isPersisting}
          >
            <Text style={[styles.sheetPrimaryButtonText, { color: colors.textOnAccentSurface }]}>
              {t('guest.first_dream.sheet.analyze')}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.sheetSecondaryButton,
              { borderColor: colors.divider, backgroundColor: colors.backgroundSecondary },
              isPersisting && styles.sheetDisabledButton,
            ]}
            onPress={handleFirstDreamJournal}
            disabled={isPersisting}
          >
            <Text style={[styles.sheetSecondaryButtonText, { color: colors.textPrimary }]}>
              {t('guest.first_dream.sheet.journal')}
            </Text>
          </Pressable>
        </View>
        <Pressable onPress={handleFirstDreamDismiss} style={styles.sheetLinkButton}>
          <Text style={[styles.sheetLinkText, { color: colors.textSecondary }]}>
            {t('guest.first_dream.sheet.dismiss')}
          </Text>
        </Pressable>
      </BottomSheet>
      <BottomSheet
        visible={Boolean(analyzePromptDream)}
        onClose={handleAnalyzePromptDismiss}
        backdropColor={mode === 'dark' ? 'rgba(2, 0, 12, 0.75)' : 'rgba(0, 0, 0, 0.25)'}
        style={[
          styles.firstDreamSheet,
          {
            backgroundColor: colors.backgroundCard,
            paddingBottom: insets.bottom + ThemeLayout.spacing.md,
          },
          shadows.xl,
        ]}
      >
        <View style={[styles.sheetHandle, { backgroundColor: colors.divider }]} />
        <Text
          style={[styles.sheetTitle, { color: colors.textPrimary }]}
          testID={TID.Text.AnalyzePromptTitle}
        >
          {t('recording.analyze_prompt.sheet.title')}
        </Text>
        <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
          {t('recording.analyze_prompt.sheet.subtitle')}
        </Text>
        <View style={styles.sheetButtons}>
          <Pressable
            style={[
              styles.sheetPrimaryButton,
              { backgroundColor: colors.accent },
              isPersisting && styles.sheetDisabledButton,
            ]}
            onPress={handleFirstDreamAnalyze}
            disabled={isPersisting}
          >
            <Text style={[styles.sheetPrimaryButtonText, { color: colors.textOnAccentSurface }]}>
              {t('recording.analyze_prompt.sheet.analyze')}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.sheetSecondaryButton,
              { borderColor: colors.divider, backgroundColor: colors.backgroundSecondary },
              isPersisting && styles.sheetDisabledButton,
            ]}
            onPress={handleAnalyzePromptJournal}
            disabled={isPersisting}
          >
            <Text style={[styles.sheetSecondaryButtonText, { color: colors.textPrimary }]}>
              {t('recording.analyze_prompt.sheet.journal')}
            </Text>
          </Pressable>
        </View>
        <Pressable onPress={handleAnalyzePromptDismiss} style={styles.sheetLinkButton}>
          <Text style={[styles.sheetLinkText, { color: colors.textSecondary }]}>
            {t('recording.analyze_prompt.sheet.dismiss')}
          </Text>
        </Pressable>
      </BottomSheet>
      <BottomSheet
        visible={showGuestLimitSheet}
        onClose={() => {
          setShowGuestLimitSheet(false);
          setPendingGuestLimitDream(null);
        }}
        backdropColor={mode === 'dark' ? 'rgba(2, 0, 12, 0.75)' : 'rgba(0, 0, 0, 0.25)'}
        style={[
          styles.firstDreamSheet,
          {
            backgroundColor: colors.backgroundCard,
            paddingBottom: insets.bottom + ThemeLayout.spacing.md,
          },
          shadows.xl,
        ]}
      >
        <View style={[styles.sheetHandle, { backgroundColor: colors.divider }]} />
        <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
          {t('recording.guest_limit_sheet.title')}
        </Text>
        <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
          {t('recording.guest_limit_sheet.message')}
        </Text>
        <View style={styles.sheetButtons}>
          <Pressable
            style={[
              styles.sheetPrimaryButton,
              { backgroundColor: colors.accent },
            ]}
            onPress={() => {
              setShowGuestLimitSheet(false);
              router.push('/(tabs)/settings');
            }}
          >
            <Text style={[styles.sheetPrimaryButtonText, { color: colors.textOnAccentSurface }]}>
              {t('recording.guest_limit_sheet.cta')}
            </Text>
          </Pressable>
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 16,
    position: 'relative',
  },
  recordingSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 32,
  },
  instructionText: {
    fontSize: 22,
    lineHeight: 32,
    fontFamily: Fonts.lora.regularItalic,
    // color: set dynamically in component
    textAlign: 'center',
  },
  timestampText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.regular,
    // color: set dynamically in component
    opacity: 0.8,
    textAlign: 'center',
  },
  textInputSection: {
    width: '100%',
    maxWidth: 512,
    alignSelf: 'center',
    gap: 16,
  },
  textInput: {
    minHeight: 160,
    maxHeight: 240,
    borderRadius: 16,
    // backgroundColor and color: set dynamically in component
    padding: 20,
    fontSize: 16,
    fontFamily: Fonts.lora.regularItalic,
    textAlignVertical: 'top',
    // shadow: applied via theme shadows.md
  },
  submitButton: {
    // backgroundColor: set dynamically in component
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    // shadow: applied via theme shadows.lg
  },
  submitButtonDisabled: {
    // backgroundColor: set dynamically in component
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  actionButtons: {
    gap: 12,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: Fonts.spaceGrotesk.bold,
    letterSpacing: 0.5,
  },
  journalLinkButton: {
    paddingVertical: 12,
    alignItems: 'center',
    alignSelf: 'center',
  },
  journalLinkText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  firstDreamSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: ThemeLayout.spacing.lg,
    gap: ThemeLayout.spacing.md,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 56,
    height: 5,
    borderRadius: ThemeLayout.borderRadius.full,
    opacity: 0.6,
    marginBottom: ThemeLayout.spacing.sm,
  },
  sheetTitle: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 22,
    textAlign: 'center',
  },
  sheetSubtitle: {
    fontFamily: Fonts.lora.regular,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  sheetButtons: {
    width: '100%',
    gap: 12,
  },
  sheetPrimaryButton: {
    borderRadius: ThemeLayout.borderRadius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetPrimaryButtonText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
  },
  sheetSecondaryButton: {
    borderWidth: 1,
    borderRadius: ThemeLayout.borderRadius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSecondaryButtonText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 16,
  },
  sheetLinkButton: {
    paddingVertical: ThemeLayout.spacing.xs,
    alignItems: 'center',
  },
  sheetLinkText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
  },
  sheetDisabledButton: {
    opacity: 0.6,
  },
});
