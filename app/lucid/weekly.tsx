import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { LucidButton, LucidCard, LucidIconAction, LucidMetric, LucidPill, LucidScreen } from '@/components/lucid/LucidUI';
import { getLucidPalette } from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import { useLucidNow } from '@/hooks/useLucidNow';
import { buildLucidWeeklyReview } from '@/lib/lucid/progress';
import { closeLucidRoute, LUCID_HOME_HREF } from '@/lib/lucid/routes';

const COPY = { en: { eyebrow: 'Weekly adaptation', title: 'Review the week gently', practice: 'practice days', recall: 'recall days', lucid: 'lucid dreams', recommendation: 'Suggested next focus', notes: 'What helped or disturbed sleep?', save: 'Save weekly review', saved: 'Weekly review saved' }, fr: { eyebrow: 'Adaptation hebdomadaire', title: 'Relisez la semaine avec douceur', practice: 'jours de pratique', recall: 'jours de rappel', lucid: 'rêves lucides', recommendation: 'Prochain axe suggéré', notes: 'Qu’est-ce qui a aidé ou perturbé le sommeil ?', save: 'Enregistrer le bilan', saved: 'Bilan hebdomadaire enregistré' }, es: { eyebrow: 'Adaptación semanal', title: 'Revisa la semana con calma', practice: 'días de práctica', recall: 'días de recuerdo', lucid: 'sueños lúcidos', recommendation: 'Próximo foco sugerido', notes: '¿Qué ayudó o alteró el sueño?', save: 'Guardar revisión semanal', saved: 'Revisión guardada' }, de: { eyebrow: 'Wöchentliche Anpassung', title: 'Die Woche sanft betrachten', practice: 'Übungstage', recall: 'Erinnerungstage', lucid: 'Klarträume', recommendation: 'Nächster Fokus', notes: 'Was hat Schlaf geholfen oder gestört?', save: 'Wochenrückblick speichern', saved: 'Wochenrückblick gespeichert' }, it: { eyebrow: 'Adattamento settimanale', title: 'Rivedi la settimana con calma', practice: 'giorni di pratica', recall: 'giorni di ricordo', lucid: 'sogni lucidi', recommendation: 'Prossimo focus suggerito', notes: 'Cosa ha aiutato o disturbato il sonno?', save: 'Salva bilancio settimanale', saved: 'Bilancio salvato' } } as const;
export default function LucidWeeklyScreen() {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { state, content, saveWeeklyReview } = useLucidTrainer();
  const copy = COPY[content.locale];
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const now = useLucidNow();
  const review = useMemo(() => {
    const endAt = now + 1;
    return buildLucidWeeklyReview(state!.experiments, {
      startAt: endAt - 7 * 86400000,
      endAt,
    });
  }, [now, state]);
  const dateKey = new Date(review.currentWindow.startAt).toISOString().slice(0, 10);
  const practiceDays = new Set(
    state!.progress
      .flatMap((item) => item.practiceDates)
      .filter((key) => key >= dateKey)
  ).size;
  const close = () => closeLucidRoute(router, LUCID_HOME_HREF);
  const save = async () => {
    setSaving(true);
    try {
      await saveWeeklyReview({
        weekStart: dateKey,
        practiceDays: Math.min(7, practiceDays),
        recallDays: Math.min(7, review.current.recalledDreams),
        lucidDreams: review.current.lucidDreams,
        recommendedTechnique: review.coaching.technique,
        notes: notes.trim() || undefined,
      });
      Alert.alert(copy.saved, content.weeklyReview.coachingNote, [
        { text: content.chrome.common.done, onPress: close },
      ]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <LucidScreen
      eyebrow={copy.eyebrow}
      title={copy.title}
      subtitle={content.weeklyReview.intro}
      trailing={<LucidIconAction label={content.chrome.common.back} icon="close" onPress={close} />}
    >
      <View style={styles.metrics}>
        <LucidMetric value={String(practiceDays)} label={copy.practice} />
        <LucidMetric value={String(review.current.recalledDreams)} label={copy.recall} tone="cyan" />
        <LucidMetric value={String(review.current.lucidDreams)} label={copy.lucid} tone="amber" />
      </View>
      <LucidCard accent="cyan">
        <LucidPill label={copy.recommendation} tone="cyan" icon="sparkles" />
        <Text style={[styles.recommendation, { color: palette.text }]}>
          {review.coaching.technique
            ? content.programs[review.coaching.technique].title
            : content.weeklyReview.adaptationRules[0]}
        </Text>
        <Text style={[styles.body, { color: palette.textSecondary }]}>
          {content.weeklyReview.coachingNote}
        </Text>
      </LucidCard>
      <Text style={[styles.label, { color: palette.text }]}>{copy.notes}</Text>
      <TextInput
        accessibilityLabel={copy.notes}
        multiline
        maxLength={4000}
        onChangeText={setNotes}
        placeholder={copy.notes}
        placeholderTextColor={palette.textMuted}
        style={[
          styles.notes,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            color: palette.text,
          },
        ]}
        value={notes}
      />
      <LucidButton
        label={copy.save}
        icon="checkmark"
        loading={saving}
        onPress={() => void save()}
      />
    </LucidScreen>
  );
}
const styles = StyleSheet.create({ metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, recommendation: { fontFamily: 'Fraunces_600SemiBold', fontSize: 21, lineHeight: 27 }, body: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, lineHeight: 19 }, label: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16 }, notes: { minHeight: 130, borderRadius: 18, borderWidth: 1, padding: 15, fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, lineHeight: 20, textAlignVertical: 'top' } });
