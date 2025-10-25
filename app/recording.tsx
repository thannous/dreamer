import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Audio } from 'expo-av';
import { useTranslation } from '@/hooks/useTranslation';
import { analyzeDream, generateImageForDream } from '@/services/geminiService';
import { useDreams } from '@/context/DreamsContext';
import type { DreamAnalysis } from '@/lib/types';
import { SurrealTheme, Fonts } from '@/constants/theme';
import { MicButton } from '@/components/recording/MicButton';
import { Waveform } from '@/components/recording/Waveform';
import { transcribeAudio } from '@/services/speechToText';

export default function RecordingScreen() {
  const { t } = useTranslation();
  const { addDream } = useDreams();
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);

  // Request microphone permissions on mount
  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Microphone permission is required to record dreams.'
        );
      }
    })();
  }, []);

  const getCurrentTimestamp = () => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    };
    return `Cycle of the Moon: ${now.toLocaleDateString('en-US', options)}`;
  };

  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Microphone permission is required to record dreams.'
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recordingOptions: Audio.RecordingOptions = {
        isMeteringEnabled: true,
        android: {
          extension: '.3gp',
          outputFormat: Audio.AndroidOutputFormat.AMR_WB,
          audioEncoder: Audio.AndroidAudioEncoder.AMR_WB,
          sampleRate: 16000,
          numberOfChannels: 1,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
          audioQuality: Audio.IOSAudioQuality.MEDIUM,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 256000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      };

      const { recording: newRecording } = await Audio.Recording.createAsync(
        recordingOptions
      );

      setRecording(newRecording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

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
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
      Alert.alert('Error', 'Failed to stop recording.');
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const handleSave = async () => {
    if (!transcript.trim()) {
      Alert.alert('Empty Dream', 'Please record or write your dream first.');
      return;
    }

    setLoading(true);
    try {
      // Analyze the dream
      const analysis = await analyzeDream(transcript);

      // Generate image
      const imageUrl = await generateImageForDream(analysis.imagePrompt);

      // Create and save the dream
      const newDream: DreamAnalysis = {
        id: Date.now(),
        transcript,
        title: analysis.title,
        interpretation: analysis.interpretation,
        shareableQuote: analysis.shareableQuote,
        theme: analysis.theme,
        dreamType: analysis.dreamType,
        imageUrl,
        chatHistory: [{ role: 'user', text: `Here is my dream: ${transcript}` }],
      };

      await addDream(newDream);

      // Navigate directly to dream detail
      router.replace(`/journal/${newDream.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Analysis Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoToJournal = () => {
    router.push('/(tabs)/journal');
  };

  return (
    <LinearGradient
      colors={[SurrealTheme.bgStart, SurrealTheme.bgEnd]}
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
              <Text style={styles.saveText}>My Dream</Text>
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

              <Text style={styles.timestampText}>{getCurrentTimestamp()}</Text>
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
                editable={!loading}
              />

              {/* Submit Button */}
              <Pressable
                onPress={handleSave}
                disabled={loading || !transcript.trim()}
                style={[
                  styles.submitButton,
                  (!transcript.trim() || loading) && styles.submitButtonDisabled
                ]}
              >
                {loading ? (
                  <View style={styles.buttonContent}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.submitButtonText}>Analyzing...</Text>
                  </View>
                ) : (
                  <Text style={styles.submitButtonText}>
                    ✨ Analyze My Dream
                  </Text>
                )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 60 : 12,
  },
  headerButton: {
    width: 48,
    height: 48,
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
