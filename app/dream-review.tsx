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
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from '@/hooks/useTranslation';
import { generateImageForDream } from '@/services/geminiService';
import { useDreams } from '@/context/DreamsContext';
import type { DreamAnalysis } from '@/lib/types';
import { SurrealTheme } from '@/constants/theme';
import { MicButton } from '@/components/recording/MicButton';
import { Waveform } from '@/components/recording/Waveform';

export default function DreamReviewScreen() {
  const { t } = useTranslation();
  const { addDream } = useDreams();
  const params = useLocalSearchParams();

  // Parse the analysis results from route params
  const [transcript, setTranscript] = useState(
    typeof params.transcript === 'string' ? params.transcript : ''
  );
  const [analysisData] = useState({
    title: typeof params.title === 'string' ? params.title : '',
    interpretation: typeof params.interpretation === 'string' ? params.interpretation : '',
    shareableQuote: typeof params.shareableQuote === 'string' ? params.shareableQuote : '',
    theme: typeof params.theme === 'string' ? params.theme : 'surreal',
    dreamType: typeof params.dreamType === 'string' ? params.dreamType : '',
    imagePrompt: typeof params.imagePrompt === 'string' ? params.imagePrompt : '',
  });

  const [loading, setLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Track unsaved changes
  useEffect(() => {
    const originalTranscript = typeof params.transcript === 'string' ? params.transcript : '';
    setHasUnsavedChanges(transcript !== originalTranscript);
  }, [transcript, params.transcript]);

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

  const handleClose = () => {
    if (hasUnsavedChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have edited the transcript. Are you sure you want to discard these changes?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      router.back();
    }
  };

  const handleSave = async () => {
    if (!transcript.trim()) {
      Alert.alert('Empty Dream', 'Please enter your dream text.');
      return;
    }

    setLoading(true);
    try {
      // Generate image using the prompt from analysis
      const imageUrl = await generateImageForDream(analysisData.imagePrompt);

      // Create the final dream object
      const newDream: DreamAnalysis = {
        id: Date.now(),
        transcript,
        title: analysisData.title,
        interpretation: analysisData.interpretation,
        shareableQuote: analysisData.shareableQuote,
        theme: analysisData.theme as 'surreal' | 'mystical' | 'calm' | 'noir',
        dreamType: analysisData.dreamType,
        imageUrl,
        chatHistory: [{ role: 'user', text: `Here is my dream: ${transcript}` }],
      };

      await addDream(newDream);
      setHasUnsavedChanges(false);

      // Navigate to dream detail
      router.replace(`/journal/${newDream.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Error', `Failed to save dream: ${msg}`);
    } finally {
      setLoading(false);
    }
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
            <Pressable onPress={handleClose} style={styles.headerButton}>
              <Ionicons name="close" size={28} color={SurrealTheme.textMuted} />
            </Pressable>
            <Text style={styles.headerTitle}>New Dream</Text>
            <Pressable
              onPress={handleSave}
              disabled={loading || !transcript.trim()}
              style={styles.headerButton}
            >
              {loading ? (
                <ActivityIndicator size="small" color={SurrealTheme.accent} />
              ) : (
                <Text
                  style={[
                    styles.saveText,
                    !transcript.trim() && styles.saveTextDisabled,
                  ]}
                >
                  Save
                </Text>
              )}
            </Pressable>
          </View>

          {/* Main Content */}
          <View style={styles.flexGrow}>
            {/* Recording Section - Centered */}
            <View style={styles.recordingSection}>
              <Text style={styles.instructionText}>
                Whisper your dream into the ether...
              </Text>

              {/* Decorative Mic Button with pulse animation */}
              <MicButton isRecording={false} onPress={() => {}} />

              {/* Decorative Waveform */}
              <Waveform isActive={false} />

              <Text style={styles.timestampText}>{getCurrentTimestamp()}</Text>
            </View>

            {/* Text Input Section */}
            <View style={styles.textInputSection}>
              <TextInput
                value={transcript}
                onChangeText={setTranscript}
                placeholder="Or transcribe the whispers of your subconscious here..."
                placeholderTextColor={SurrealTheme.textMuted}
                style={styles.textInput}
                multiline
                editable={!loading}
                textAlignVertical="top"
              />
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
    justifyContent: 'space-between',
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: SurrealTheme.textLight,
    flex: 1,
    textAlign: 'center',
  },
  saveText: {
    fontSize: 18,
    fontWeight: '700',
    color: SurrealTheme.accent,
  },
  saveTextDisabled: {
    opacity: 0.5,
  },
  flexGrow: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
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
    fontStyle: 'italic',
    color: SurrealTheme.textMuted,
    textAlign: 'center',
  },
  timestampText: {
    fontSize: 16,
    color: SurrealTheme.textMuted,
    opacity: 0.8,
    textAlign: 'center',
  },
  textInputSection: {
    width: '100%',
    maxWidth: 512,
    alignSelf: 'center',
  },
  textInput: {
    minHeight: 160,
    maxHeight: 240,
    borderRadius: 16,
    backgroundColor: SurrealTheme.darkAccent,
    color: SurrealTheme.textLight,
    padding: 20,
    fontSize: 16,
    fontStyle: 'italic',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
});
