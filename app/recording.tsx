import { AnalysisProgress } from '@/components/analysis/AnalysisProgress';
import { MicButton } from '@/components/recording/MicButton';
import { Waveform } from '@/components/recording/Waveform';
import { GradientColors } from '@/constants/gradients';
import { Fonts, SurrealTheme } from '@/constants/theme';
import { useDreams } from '@/context/DreamsContext';
import { AnalysisStep, useAnalysisProgress } from '@/hooks/useAnalysisProgress';
import { classifyError } from '@/lib/errors';
import type { DreamAnalysis } from '@/lib/types';
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
import React, { useCallback, useEffect, useState } from 'react';
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
  const { addDream } = useDreams();
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const audioRecorder = useAudioRecorder(RECORDING_OPTIONS);
  const analysisProgress = useAnalysisProgress();

  // Request microphone permissions on mount
  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert(
          'Permission Required',
          'Microphone permission is required to record dreams.'
        );
      }
    })();
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Microphone permission is required to record dreams.'
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
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  }, [audioRecorder]);

  const stopRecording = useCallback(async () => {
    try {
      setIsRecording(false);
      await audioRecorder.stop();
      const uri = audioRecorder.uri ?? undefined;

      if (uri) {
        try {
          const transcribedText = await transcribeAudio({ uri, languageCode: 'fr-FR' });
          if (transcribedText) {
            setTranscript((prev) => (prev ? `${prev}\n${transcribedText}` : transcribedText));
          } else {
            Alert.alert('No Speech Detected', 'No transcript returned for this recording.');
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown transcription error';
          Alert.alert('Transcription Failed', msg);
        }
      } else {
        Alert.alert('Recording Invalid', 'No audio file was produced. Please try again and speak for at least 2 seconds.');
      }
    } catch (err) {
      if (__DEV__) {
        console.error('Failed to stop recording:', err);
      }
      Alert.alert('Error', 'Failed to stop recording.');
    }
  }, [audioRecorder]);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, stopRecording, startRecording]);

  const handleSave = useCallback(async () => {
    if (!transcript.trim()) {
      Alert.alert('Empty Dream', 'Please record or write your dream first.');
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

      await addDream(newDream);

      // Mark as complete
      analysisProgress.setStep(AnalysisStep.COMPLETE);

      // Brief delay to show completion
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Navigate directly to dream detail
      router.replace(`/journal/${newDream.id}`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const classified = classifyError(error);
      analysisProgress.setError(classified);
    }
  }, [transcript, addDream, analysisProgress]);

  const handleGoToJournal = useCallback(() => {
    router.push('/(tabs)/journal');
  }, []);

  return (
    <LinearGradient
      colors={GradientColors.surreal}
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
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={handleGoToJournal}
              style={styles.headerButton}
            >
              <Text style={styles.saveText} numberOfLines={1}>
                Dream Journal
              </Text>
            </Pressable>
          </View>

          {/* Main Content */}
          <View style={styles.mainContent}>
            <Text style={styles.pageTitle}>New Dream</Text>
            <View style={styles.recordingSection}>
              <Text style={styles.instructionText}>
                Whisper your dream into the ether...
              </Text>

              <MicButton isRecording={isRecording} onPress={toggleRecording} />

              <Waveform isActive={isRecording} />
            </View>

            {/* Text Input */}
            <View style={styles.textInputSection}>
              <TextInput
                value={transcript}
                onChangeText={setTranscript}
                placeholder="Or transcribe the whispers of your subconscious here..."
                placeholderTextColor={SurrealTheme.textMuted}
                style={styles.textInput}
                multiline
                editable={analysisProgress.step === AnalysisStep.IDLE}
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
                  disabled={!transcript.trim()}
                  style={[
                    styles.submitButton,
                    !transcript.trim() && styles.submitButtonDisabled
                  ]}
                >
                  <Text style={styles.submitButtonText}>
                    ✨ Analyze My Dream
                  </Text>
                </Pressable>
              )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 60 : 12,
  },
  headerButton: {
    paddingHorizontal: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontSize: 18,
    fontFamily: Fonts.spaceGrotesk.bold,
    color: SurrealTheme.accent,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 16,
  },
  pageTitle: {
    fontSize: 32,
    fontFamily: Fonts.spaceGrotesk.bold,
    color: SurrealTheme.textLight,
    textAlign: 'center',
    marginBottom: 8,
  },
  recordingSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 32,
  },
  instructionText: {
    fontSize: 18,
    fontFamily: Fonts.lora.regularItalic,
    color: SurrealTheme.textMuted,
    textAlign: 'center',
  },
  timestampText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.regular,
    color: SurrealTheme.textMuted,
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
    backgroundColor: SurrealTheme.darkAccent,
    color: SurrealTheme.textLight,
    padding: 20,
    fontSize: 16,
    fontFamily: Fonts.lora.regularItalic,
    textAlignVertical: 'top',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButton: {
    backgroundColor: SurrealTheme.accent,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: SurrealTheme.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonDisabled: {
    backgroundColor: SurrealTheme.textMuted,
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
});
