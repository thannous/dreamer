import { AnalysisProgress } from '@/components/analysis/AnalysisProgress';
import { MicButton } from '@/components/recording/MicButton';
import { Waveform } from '@/components/recording/Waveform';
import { GradientColors } from '@/constants/gradients';
import { Fonts } from '@/constants/theme';
import { useDreams } from '@/context/DreamsContext';
import { useTheme } from '@/context/ThemeContext';
import { AnalysisStep, useAnalysisProgress } from '@/hooks/useAnalysisProgress';
import { classifyError } from '@/lib/errors';
import type { DreamAnalysis } from '@/lib/types';
import { TID } from '@/lib/testIDs';
import { analyzeDreamWithImageResilient } from '@/services/geminiService';
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
import { GuestLimitBanner } from '@/components/guest/GuestLimitBanner';

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
  const { guestLimitReached, addDream, dreams } = useDreams();
  const { colors, shadows, mode } = useTheme();
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const audioRecorder = useAudioRecorder(RECORDING_OPTIONS);
  const analysisProgress = useAnalysisProgress();
  const { language } = useLanguage();
  const { t } = useTranslation();
  const { user } = useAuth();
  const limitLock = !user && guestLimitReached;

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

  const handleSave = useCallback(async () => {
    if (!transcript.trim()) {
      Alert.alert(t('recording.alert.empty.title'), t('recording.alert.empty.message'));
      return;
    }

    if (!user && guestLimitReached) {
      Alert.alert(
        t('recording.alert.limit.title'),
        t('recording.alert.limit.message', { limit: GUEST_DREAM_LIMIT }),
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

    // Reset progress and start analysis
    analysisProgress.reset();
    analysisProgress.setStep(AnalysisStep.ANALYZING);

    try {
      // Analyze the dream with resilient image generation
      const analysis = await analyzeDreamWithImageResilient(transcript);

      // Update progress to image generation step
      analysisProgress.setStep(AnalysisStep.GENERATING_IMAGE);

      // Brief delay to show the progress update
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Finalize
      analysisProgress.setStep(AnalysisStep.FINALIZING);

      // Create and save the dream
      const newDream: DreamAnalysis = {
        id: Date.now(),
        transcript,
        title: analysis.title,
        interpretation: analysis.interpretation,
        shareableQuote: analysis.shareableQuote,
        theme: analysis.theme,
        dreamType: analysis.dreamType,
        imageUrl: analysis.imageUrl || '', // Empty string if no image
        imageGenerationFailed: analysis.imageGenerationFailed,
        chatHistory: [{ role: 'user', text: `Here is my dream: ${transcript}` }],
      };

      const preCount = dreams.length;
      const savedDream = await addDream(newDream);

      // Mark as complete
      analysisProgress.setStep(AnalysisStep.COMPLETE);

      // Brief delay to show completion
      await new Promise((resolve) => setTimeout(resolve, 300));

      // After 1st dream for guests, show upsell
      if (!user && preCount === 0) {
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
          } else {
            router.replace(`/journal/${savedDream.id}`);
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
        }
        return;
      }

      // Navigate directly to dream detail (default)
      router.replace(`/journal/${savedDream.id}`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if ((error as Error & { code?: string }).code === 'GUEST_LIMIT_REACHED') {
        Alert.alert(
          t('recording.alert.limit.title'),
          t('recording.alert.limit.message', { limit: GUEST_DREAM_LIMIT }),
          [
            {
              text: t('recording.alert.limit.cta'),
              onPress: () => router.push('/(tabs)/settings'),
            },
            { text: t('common.cancel'), style: 'cancel' },
          ]
        );
        analysisProgress.reset();
        return;
      }
      const classified = classifyError(error);
      analysisProgress.setError(classified);
    }
  }, [transcript, addDream, analysisProgress, t, user, guestLimitReached, dreams.length]);

  const handleGoToJournal = useCallback(() => {
    router.push('/(tabs)/journal');
  }, []);

  const gradientColors = mode === 'dark'
    ? GradientColors.surreal
    : ([colors.backgroundSecondary, colors.backgroundDark] as readonly [string, string]);

  const overlayColor = mode === 'dark'
    ? 'rgba(24, 24, 28, 0.78)'
    : 'rgba(170, 170, 180, 0.6)';

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
            <GuestLimitBanner />
            <View style={styles.recordingSection}>
              <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
                {t('recording.instructions')}
              </Text>

              <MicButton
                isRecording={isRecording}
                onPress={toggleRecording}
                disabled={limitLock}
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
                editable={!limitLock && analysisProgress.step === AnalysisStep.IDLE}
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
                  onRetry={handleSave}
                />
              )}

              {/* Submit Button */}
              {analysisProgress.step === AnalysisStep.IDLE && (
                <Pressable
                  onPress={handleSave}
                  disabled={!transcript.trim() || limitLock}
                  style={[
                    styles.submitButton,
                    shadows.lg,
                    { backgroundColor: colors.accent },
                    (!transcript.trim() || limitLock) && [styles.submitButtonDisabled, { backgroundColor: colors.textSecondary }]
                  ]}
                  testID={TID.Button.SaveDream}
                  accessibilityRole="button"
                  accessibilityLabel={t('recording.button.accessibility')}
                >
                  <Text style={styles.submitButtonText}>
                    ✨ {t('recording.button.analyze')}
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={handleGoToJournal}
                style={[styles.journalLinkButton, limitLock && styles.onTop]}
                testID={TID.Button.NavigateJournal}
                accessibilityRole="link"
                accessibilityLabel={t('recording.nav_button.accessibility')}
              >
                <Text style={[styles.journalLinkText, { color: colors.accent }]}>
                  {t('recording.nav_button')}
                </Text>
              </Pressable>
            </View>

            {limitLock && (
              <View
                pointerEvents="none"
                style={[styles.disabledOverlay, { backgroundColor: overlayColor }]}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
            )}
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
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
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
  disabledOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 72,
    borderRadius: 0,
    zIndex: 5,
  },
  onTop: {
    zIndex: 50,
    position: 'relative',
  },
});
