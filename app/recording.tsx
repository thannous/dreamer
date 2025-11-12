import { AnalysisProgress } from '@/components/analysis/AnalysisProgress';
import { MicButton } from '@/components/recording/MicButton';
import { Waveform } from '@/components/recording/Waveform';
import { GradientColors } from '@/constants/gradients';
import { Fonts } from '@/constants/theme';
import { ThemeLayout } from '@/constants/journalTheme';
import { useDreams } from '@/context/DreamsContext';
import { useTheme } from '@/context/ThemeContext';
import { AnalysisStep, useAnalysisProgress } from '@/hooks/useAnalysisProgress';
import { classifyError, QuotaError } from '@/lib/errors';
import type { DreamAnalysis } from '@/lib/types';
import { TID } from '@/lib/testIDs';
import { useQuota } from '@/hooks/useQuota';
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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/context/AuthContext';
import { GUEST_DREAM_LIMIT } from '@/constants/limits';

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

export default function RecordingScreen() {
  const { addDream, dreams, analyzeDream } = useDreams();
  const { colors, shadows, mode } = useTheme();
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [draftDream, setDraftDream] = useState<DreamAnalysis | null>(null);
  const [isPersisting, setIsPersisting] = useState(false);
  const audioRecorder = useAudioRecorder(RECORDING_OPTIONS);
  const analysisProgress = useAnalysisProgress();
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
      dreamType: 'Dream',
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
    (savedDream: DreamAnalysis, previousDreamCount: number) => {
      if (!user && previousDreamCount === 0) {
        const upsellTitle = t('guest.upsell.after1.title');
        const upsellMessage = t('guest.upsell.after1.message', { limit: GUEST_DREAM_LIMIT });
        const upsellCta = t('guest.upsell.after1.cta');
        const upsellLater = t('guest.upsell.after1.later');

        if (Platform.OS === 'web') {
          const goToSettings = typeof window !== 'undefined'
            && window.confirm(
              `${upsellTitle}\n\n${upsellMessage}\n\nOK ▸ ${upsellCta}\n${t('common.cancel')} ▸ ${upsellLater}`
            );
          if (goToSettings) {
            router.push('/(tabs)/settings');
            return;
          }
        } else {
          Alert.alert(
            upsellTitle,
            upsellMessage,
            [
              {
                text: upsellCta,
                onPress: () => router.push('/(tabs)/settings'),
              },
              {
                text: upsellLater,
                style: 'cancel',
                onPress: () => router.replace(`/journal/${savedDream.id}`),
              },
            ]
          );
          return;
        }
      }

      router.replace(`/journal/${savedDream.id}`);
    },
    [router, t, user]
  );

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
      if (__DEV__) {
        console.error('Failed to stop recording:', err);
      }
      Alert.alert(t('common.error_title'), t('recording.alert.stop_failed'));
    }
  }, [audioRecorder, transcriptionLocale, t]);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, stopRecording, startRecording]);

  const handleSaveDraft = useCallback(async () => {
    if (!trimmedTranscript) {
      Alert.alert(t('recording.alert.empty.title'), t('recording.alert.empty.message'));
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
  }, [trimmedTranscript, dreams.length, ensureDraftSaved, navigateAfterSave, resetComposer, t]);

  const handleAnalyzeNow = useCallback(async () => {
    if (!trimmedTranscript) {
      Alert.alert(t('recording.alert.empty.title'), t('recording.alert.empty.message'));
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

    setIsPersisting(true);
    const preCount = dreams.length;
    try {
      const savedDream = await ensureDraftSaved();
      analysisProgress.reset();
      analysisProgress.setStep(AnalysisStep.ANALYZING);

      const analyzedDream = await analyzeDream(savedDream.id, savedDream.transcript);

      analysisProgress.setStep(AnalysisStep.COMPLETE);
      resetComposer();
      await new Promise((resolve) => setTimeout(resolve, 300));
      navigateAfterSave(analyzedDream, preCount);
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
    trimmedTranscript,
    canAnalyzeNow,
    user,
    t,
    dreams.length,
    ensureDraftSaved,
    analysisProgress,
    analyzeDream,
    navigateAfterSave,
    resetComposer,
    router,
  ]);

  const handleGoToJournal = useCallback(() => {
    router.push('/(tabs)/journal');
  }, []);

  const gradientColors = mode === 'dark'
    ? GradientColors.surreal
    : ([colors.backgroundSecondary, colors.backgroundDark] as readonly [string, string]);

  return (
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

              {!canAnalyzeNow && (
                <Text style={[styles.inlineQuotaWarning, { color: colors.accent }]}>
                  {user ? t('recording.alert.analysis_limit.title_free') : t('recording.alert.analysis_limit.title_guest')}
                </Text>
              )}

              {/* Analysis Progress */}
              {analysisProgress.step !== AnalysisStep.IDLE && analysisProgress.step !== AnalysisStep.COMPLETE && (
                <AnalysisProgress
                  step={analysisProgress.step}
                  progress={analysisProgress.progress}
                  message={analysisProgress.message}
                  error={analysisProgress.error}
                  onRetry={handleAnalyzeNow}
                />
              )}

              {/* Actions */}
              <View style={styles.actionButtons}>
                <Pressable
                  onPress={handleAnalyzeNow}
                  disabled={!trimmedTranscript || interactionDisabled || !canAnalyzeNow}
                  style={[
                    styles.submitButton,
                    shadows.lg,
                    { backgroundColor: colors.accent },
                    (!trimmedTranscript || interactionDisabled || !canAnalyzeNow) && [styles.submitButtonDisabled, { backgroundColor: colors.textSecondary }],
                  ]}
                  testID={TID.Button.SaveDream}
                  accessibilityRole="button"
                  accessibilityLabel={t('recording.button.analyze_now_accessibility', { defaultValue: t('recording.button.analyze') })}
                >
                  <Text style={styles.submitButtonText}>
                    ✨ {t('recording.button.analyze_now', { defaultValue: t('recording.button.analyze') })}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveDraft}
                  disabled={!trimmedTranscript || interactionDisabled}
                  style={[
                    styles.secondaryButton,
                    { borderColor: colors.divider },
                    (!trimmedTranscript || interactionDisabled) && styles.secondaryButtonDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('recording.button.save_draft_accessibility', { defaultValue: t('recording.button.save_draft') })}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>
                    💾 {t('recording.button.save_draft')}
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
  inlineQuotaWarning: {
    marginTop: ThemeLayout.spacing.xs,
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.medium,
    textAlign: 'center',
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
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonDisabled: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
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
});
