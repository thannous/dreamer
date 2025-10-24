import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { useTranslation } from '@/hooks/useTranslation';
import { useDreams } from '@/context/DreamsContext';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { dreams } = useDreams();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('app.title')}</Text>
      <Text style={styles.tagline}>Unlock the secrets of your subconscious.</Text>

      <View style={{ height: 32 }} />

      <Pressable style={styles.cta} onPress={() => router.push('/recording')}>
        <Text style={styles.ctaText}>{t('button.record_dream')}</Text>
      </Pressable>

      <View style={{ height: 12 }} />

      <Pressable style={[styles.cta, styles.secondary]} onPress={() => router.push('/(tabs)/journal')}>
        <Text style={styles.ctaText}>{t('button.view_journal')} ({dreams.length})</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '800' },
  tagline: { marginTop: 8, color: '#666', textAlign: 'center' },
  cta: { backgroundColor: '#7c3aed', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 9999 },
  ctaText: { color: '#fff', fontWeight: '700' },
  secondary: { backgroundColor: '#6b7280' },
});
