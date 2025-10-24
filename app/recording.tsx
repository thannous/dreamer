import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from '@/hooks/useTranslation';
import { analyzeDream, generateImageForDream } from '@/services/geminiService';
import { useDreams } from '@/context/DreamsContext';
import type { DreamAnalysis } from '@/lib/types';
import { router } from 'expo-router';

export default function RecordingScreen() {
  const { t } = useTranslation();
  const { addDream } = useDreams();
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);

  const onAnalyze = async () => {
    if (!transcript.trim()) return;
    setLoading(true);
    try {
      const analysis = await analyzeDream(transcript);
      const imageUrl = await generateImageForDream(analysis.imagePrompt);
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
      router.replace(`/journal/${newDream.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert(t('analysis_error.title'), msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>New Dream</Text>
      <Text style={styles.subtitle}>Whisper your dream here…</Text>
      <TextInput
        value={transcript}
        onChangeText={setTranscript}
        placeholder="Describe your dream"
        placeholderTextColor="#9CA3AF"
        style={styles.input}
        multiline
      />
      <Pressable disabled={!transcript.trim() || loading} style={[styles.cta, (!transcript.trim() || loading) && { opacity: 0.6 }]} onPress={onAnalyze}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>{t('edit.button.analyze')}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { color: '#9CA3AF', marginVertical: 8 },
  input: { minHeight: 160, borderRadius: 12, borderWidth: 1, borderColor: '#374151', padding: 12, color: '#fff', backgroundColor: '#111827' },
  cta: { marginTop: 16, backgroundColor: '#7c3aed', padding: 14, borderRadius: 9999, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '700' },
});

