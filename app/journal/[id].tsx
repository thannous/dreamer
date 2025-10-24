import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet, Pressable, Share, Alert, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useDreams } from '@/context/DreamsContext';
import { useTranslation } from '@/hooks/useTranslation';

export default function JournalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dreamId = useMemo(() => Number(id), [id]);
  const { dreams, deleteDream, toggleFavorite } = useDreams();
  const { t } = useTranslation();

  const dream = dreams.find((d) => d.id === dreamId);
  if (!dream) {
    return (
      <View style={styles.container}> 
        <Text style={{ color: '#fff' }}>Dream not found.</Text>
        <Pressable onPress={() => router.replace('/(tabs)/journal')} style={styles.back}>
          <Text style={styles.backText}>{t('journal.back_button')}</Text>
        </Pressable>
      </View>
    );
  }

  const onShare = async () => {
    try {
      await Share.share({ message: `"${dream.shareableQuote}" - From my dream journal.` });
    } catch (e) {
      Alert.alert('Share failed');
    }
  };

  const onDelete = async () => {
    await deleteDream(dream.id);
    router.replace('/(tabs)/journal');
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={styles.header}> 
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← {t('journal.back_button')}</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => toggleFavorite(dream.id)} style={styles.iconBtn}>
            <Text style={{ color: dream.isFavorite ? '#F59E0B' : '#fff' }}>{dream.isFavorite ? '★' : '☆'}</Text>
          </Pressable>
          <Pressable onPress={onShare} style={styles.iconBtn}>
            <Text style={{ color: '#fff' }}>↗</Text>
          </Pressable>
          <Pressable onPress={onDelete} style={styles.iconBtn}>
            <Text style={{ color: '#EF4444' }}>🗑</Text>
          </Pressable>
        </View>
      </View>
      <Image source={{ uri: dream.imageUrl }} style={styles.cover} resizeMode="cover" />
      <View style={styles.body}>
        <Text style={styles.title}>{dream.title}</Text>
        <Text style={styles.date}>{new Date(dream.id).toDateString()}</Text>
        <View style={styles.quoteBox}>
          <Text style={styles.quote}>"{dream.shareableQuote}"</Text>
        </View>
        <Text style={styles.interpretation}>{dream.interpretation}</Text>
        <View style={styles.transcriptBox}>
          <Text style={styles.sectionTitle}>{t('journal.original_transcript')}</Text>
          <Text style={styles.transcript}>{dream.transcript}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#111827', borderRadius: 20 },
  backText: { color: '#fff', fontWeight: '700' },
  cover: { width: '100%', height: 240, backgroundColor: '#0f172a' },
  body: { padding: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff' },
  date: { color: '#9CA3AF', marginTop: 4 },
  quoteBox: { borderLeftWidth: 4, borderLeftColor: '#8B5CF6', paddingLeft: 12, marginTop: 12 },
  quote: { color: '#E5E7EB', fontStyle: 'italic' },
  interpretation: { marginTop: 16, color: '#E5E7EB', lineHeight: 22 },
  transcriptBox: { marginTop: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#374151' },
  sectionTitle: { fontWeight: '700', color: '#fff', marginBottom: 6 },
  transcript: { color: '#9CA3AF' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { backgroundColor: '#111827', borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 8 },
});

