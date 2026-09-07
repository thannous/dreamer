import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { LucidButton, LucidCard, LucidIconAction, LucidScreen } from '@/components/lucid/LucidUI';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import { getLucidPalette, LucidSpace, LucidType } from '@/constants/lucidTheme';
import { closeLucidRoute } from '@/lib/lucid/routes';

const COPY = {
  en: { title: 'Morning observation', missing: 'This observation is not available in this account.', voice: 'Open local voice notes' },
  fr: { title: 'Observation du matin', missing: 'Cette observation n’est pas disponible dans ce compte.', voice: 'Ouvrir les notes vocales locales' },
  es: { title: 'Observación matinal', missing: 'Esta observación no está disponible en esta cuenta.', voice: 'Abrir notas de voz locales' },
  de: { title: 'Morgenbeobachtung', missing: 'Diese Beobachtung ist in diesem Konto nicht verfügbar.', voice: 'Lokale Sprachnotizen öffnen' },
  it: { title: 'Osservazione mattutina', missing: 'Questa osservazione non è disponibile in questo account.', voice: 'Apri le note vocali locali' },
} as const;

export default function LucidObservationScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { observations, content, loading } = useLucidTrainer();
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const copy = COPY[content.locale];
  const observation = observations.find(item => item.id === id);
  return <LucidScreen title={observation?.title || copy.title}
    trailing={<LucidIconAction icon="close" label={content.chrome.common.back} onPress={() => closeLucidRoute(router, '/lucid/(tabs)/journal')} />}>
    {observation ? <LucidCard style={styles.card}>
      <Text selectable style={[styles.body, { color: palette.text }]}>{observation.transcript}</Text>
      {observation.voiceCapture === 'local_note' ? <LucidButton label={copy.voice} onPress={() => router.push('/lucid/morning-voice')} /> : null}
    </LucidCard> : <Text style={{ color: palette.textSecondary }}>{loading ? content.chrome.common.loading : copy.missing}</Text>}
  </LucidScreen>;
}

const styles = StyleSheet.create({
  card: { padding: LucidSpace.lg, gap: LucidSpace.lg },
  body: { fontSize: LucidType.body[0], lineHeight: LucidType.body[1] },
});
