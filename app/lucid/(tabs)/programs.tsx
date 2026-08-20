import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  LUCID_TAB_BAR_INSET,
  LucidCard,
  LucidPill,
  LucidProgressBar,
  LucidScreen,
} from '@/components/lucid/LucidUI';
import { getLucidPalette } from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import type { LucidTechnique } from '@/lib/lucid/model';

// La technique est identifiée par son icône et son nom, pas par une couleur :
// trois accents de poids égal ne désignaient plus rien. L'accent est réservé à
// l'état — un programme engagé — qui, lui, mérite d'être vu.
const PROGRAMS: { id: LucidTechnique; icon: 'bulb' | 'radio' | 'alarm' }[] = [
  { id: 'mild', icon: 'bulb' },
  { id: 'ssild', icon: 'radio' },
  { id: 'wbtb', icon: 'alarm' },
];

const COPY = {
  en: { eyebrow: 'Guided paths', title: 'Train with a plan', subtitle: 'Three complete programs. Try one at a time and keep sleep the priority.', sessions: 'sessions', completed: 'completed', active: 'active', notStarted: 'ready to start' },
  fr: { eyebrow: 'Parcours guidés', title: 'Un entraînement structuré', subtitle: 'Trois programmes complets. Essayez-les un par un, en gardant le sommeil prioritaire.', sessions: 'séances', completed: 'terminé', active: 'en cours', notStarted: 'prêt à commencer' },
  es: { eyebrow: 'Rutas guiadas', title: 'Entrena con un plan', subtitle: 'Tres programas completos. Prueba uno cada vez y prioriza el sueño.', sessions: 'sesiones', completed: 'completado', active: 'activo', notStarted: 'listo para empezar' },
  de: { eyebrow: 'Geführte Wege', title: 'Training mit Plan', subtitle: 'Drei vollständige Programme. Teste eines nach dem anderen und schütze den Schlaf.', sessions: 'Einheiten', completed: 'abgeschlossen', active: 'aktiv', notStarted: 'startbereit' },
  it: { eyebrow: 'Percorsi guidati', title: 'Allenati con un piano', subtitle: 'Tre programmi completi. Provane uno alla volta e proteggi il sonno.', sessions: 'sessioni', completed: 'completato', active: 'attivo', notStarted: 'pronto' },
} as const;

export default function LucidProgramsScreen() {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { state, content } = useLucidTrainer();
  const copy = COPY[content.locale];
  return (
    <LucidScreen testID="lucid-programs" bottomInset={LUCID_TAB_BAR_INSET} eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle}>
      {PROGRAMS.map(({ id, icon }) => {
        const program = content.programs[id];
        const progress = state!.progress.find((item) => item.technique === id);
        const engaged = progress != null && progress.status !== 'paused';
        const color = palette.accent;
        const status = progress?.status === 'completed' ? copy.completed : progress?.status === 'active' ? copy.active : copy.notStarted;
        return (
          <LucidCard key={id} accent={engaged ? 'accent' : 'none'} onPress={() => router.push(`/lucid/program/${id}`)} accessibilityLabel={program.title} testID={`lucid-program-${id}`}>
            <View style={styles.topRow}>
              <View style={[styles.programIcon, { backgroundColor: `${color}1F` }]}><Ionicons name={icon} size={27} color={color} /></View>
              <View style={styles.topCopy}>
                <Text style={[styles.title, { color: palette.text }]}>{program.title}</Text>
                <Text style={[styles.expanded, { color: palette.textSecondary }]}>{program.expandedName}</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={palette.textMuted} />
            </View>
            <Text style={[styles.summary, { color: palette.textSecondary }]}>{program.summary}</Text>
            <View style={styles.metaRow}>
              <LucidPill label={`${program.sessions.length} ${copy.sessions}`} tone="neutral" icon="calendar" />
              <LucidPill label={status} tone={engaged ? 'accent' : 'neutral'} />
            </View>
            <LucidProgressBar value={(progress?.completedExerciseIds.length ?? 0) / program.sessions.length} />
          </LucidCard>
        );
      })}
      <LucidCard>
        <View style={styles.noticeRow}>
          <Ionicons name="shield-checkmark" size={24} color={palette.accent} />
          <Text style={[styles.notice, { color: palette.textSecondary }]}>{content.science.sleepPriority}</Text>
        </View>
      </LucidCard>
    </LucidScreen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  programIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  topCopy: { flex: 1, gap: 2 },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 22, lineHeight: 27 },
  expanded: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 12, lineHeight: 17 },
  summary: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, lineHeight: 21 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  noticeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  notice: { flex: 1, fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, lineHeight: 19 },
});
