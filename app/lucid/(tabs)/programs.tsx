import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  LUCID_TAB_BAR_INSET,
  LucidCard,
  LucidProgressBar,
  LucidScreen,
} from '@/components/lucid/LucidUI';
import { getLucidPalette, LucidIcon, LucidRadius, LucidSpace, LucidType } from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import type { LucidTechnique } from '@/lib/lucid/model';
import { getLucidGuidanceProfile } from '@/lib/lucid/personalization';

const PROGRAMS: readonly LucidTechnique[] = [
  'mild',
  'ssild',
  'wbtb',
];

// Static requires are intentional: Metro can bundle these offline and the
// artwork remains neutral. All labels, progress and selection state stay in
// React Native so they remain translated and accessible.
const PROGRAM_ART: Readonly<Record<LucidTechnique, number>> = {
  mild: require('../../../assets/images/lucid/program-mild-destination.png'),
  ssild: require('../../../assets/images/lucid/program-ssild-destination.png'),
  wbtb: require('../../../assets/images/lucid/program-wbtb-destination.png'),
};

const COPY = {
  en: { eyebrow: 'Programs', title: 'Choose your path', sessions: 'sessions', completed: 'completed', active: 'in progress', paused: 'paused', notStarted: 'ready', suggested: 'Suggested starting point', wbtbBeginnerWarning: 'Interrupts sleep; approach gradually.' },
  fr: { eyebrow: 'Programmes', title: 'Choisissez votre chemin', sessions: 'séances', completed: 'terminé', active: 'en cours', paused: 'en pause', notStarted: 'prêt', suggested: 'Point de départ suggéré', wbtbBeginnerWarning: 'Interrompt le sommeil ; à aborder progressivement.' },
  es: { eyebrow: 'Programas', title: 'Elige tu camino', sessions: 'sesiones', completed: 'completado', active: 'en curso', paused: 'en pausa', notStarted: 'listo', suggested: 'Punto de partida sugerido', wbtbBeginnerWarning: 'Interrumpe el sueño; empieza gradualmente.' },
  de: { eyebrow: 'Programme', title: 'Wähle deinen Weg', sessions: 'Einheiten', completed: 'abgeschlossen', active: 'läuft', paused: 'pausiert', notStarted: 'bereit', suggested: 'Empfohlener Ausgangspunkt', wbtbBeginnerWarning: 'Unterbricht den Schlaf; langsam herantasten.' },
  it: { eyebrow: 'Programmi', title: 'Scegli il tuo percorso', sessions: 'sessioni', completed: 'completato', active: 'in corso', paused: 'in pausa', notStarted: 'pronto', suggested: 'Punto di partenza suggerito', wbtbBeginnerWarning: 'Interrompe il sonno; procedi gradualmente.' },
} as const;

export default function LucidProgramsScreen() {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { state, content } = useLucidTrainer();
  const copy = COPY[content.locale];
  const guidance = getLucidGuidanceProfile({
    goal: state!.onboarding.goal,
    experience: state!.onboarding.experience,
  });
  const hasStartedProgram = state!.progress.some((item) => item.status !== 'not_started');
  return (
    <LucidScreen testID="lucid-programs" bottomInset={LUCID_TAB_BAR_INSET} eyebrow={copy.eyebrow} title={copy.title}>
      <View accessibilityRole="list" style={styles.destinations}>
      {PROGRAMS.map((id) => {
        const program = content.programs[id];
        const progress = state!.progress.find((item) => item.technique === id);
        const completed = program.sessions.filter((session) =>
          progress?.completedExerciseIds.includes(session.id)
        ).length;
        const status = progress?.status === 'completed'
          ? copy.completed
          : progress?.status === 'active'
            ? copy.active
            : progress?.status === 'paused'
              ? copy.paused
              : copy.notStarted;
        const recommended = !hasStartedProgram && guidance.recommendedTechnique === id;
        const cautions = guidance.cautionWbtb && id === 'wbtb'
          ? ` ${copy.wbtbBeginnerWarning}`
          : '';
        const accessibilityLabel = `${program.title}. ${program.expandedName}. ${recommended ? `${copy.suggested}. ` : ''}${status}. ${completed} / ${program.sessions.length} ${copy.sessions}. ${program.summary}${cautions}`;
        return (
          <LucidCard
            key={id}
            accent={progress?.status === 'active' || recommended ? 'accent' : 'none'}
            style={recommended
              ? {
                  ...styles.destination,
                  shadowColor: palette.accent,
                  shadowOpacity: 0.18,
                  shadowRadius: 14,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 4,
                }
              : styles.destination}
            onPress={() => router.push(`/lucid/program/${id}`)}
            accessibilityLabel={accessibilityLabel}
            testID={`lucid-program-${id}`}
          >
            <Image
              accessibilityIgnoresInvertColors
              accessible={false}
              cachePolicy="memory-disk"
              contentFit="cover"
              source={PROGRAM_ART[id]}
              style={StyleSheet.absoluteFill}
              testID={`lucid-program-${id}-art`}
            />
            <LinearGradient
              colors={['transparent', `${palette.backgroundDeep}80`, palette.backgroundDeep]}
              locations={[0.08, 0.5, 1]}
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.destinationContent}>
              <View style={styles.statusStack}>
                {recommended ? (
                  <View
                    style={[styles.suggestedRow, { backgroundColor: palette.accentSoft }]}
                    testID={`lucid-program-${id}-recommended`}
                  >
                    <Text style={[styles.suggested, { color: palette.accentOn }]}>{copy.suggested}</Text>
                  </View>
                ) : (
                  <View style={[styles.statusRow, { backgroundColor: `${palette.backgroundDeep}CC` }]}>
                    <View style={[styles.statusDot, { backgroundColor: progress?.status === 'active' ? palette.accent : palette.textMuted }]} />
                    <Text style={[styles.status, { color: progress?.status === 'active' ? palette.accent : palette.textSecondary }]}>{status}</Text>
                  </View>
                )}
              </View>
              <View style={styles.destinationBottom}>
                <View style={styles.destinationTitleRow}>
                  <View style={styles.destinationCopy}>
                    <Text style={[styles.title, { color: palette.text }]}>{program.title}</Text>
                    <Text numberOfLines={1} style={[styles.expanded, { color: palette.textSecondary }]}>{program.expandedName}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={LucidIcon.lg} color={palette.accent} />
                </View>
                <LucidProgressBar
                  accessibilityLabel={`${program.title}, ${completed} / ${program.sessions.length} ${copy.sessions}`}
                  value={completed / program.sessions.length}
                />
              </View>
            </View>
          </LucidCard>
        );
      })}
      </View>
      <View accessible accessibilityLabel={content.science.sleepPriority} style={styles.noticeRow}>
        <Ionicons accessibilityElementsHidden importantForAccessibility="no-hide-descendants" name="moon-outline" size={LucidIcon.md} color={palette.accent} />
        <Text style={[styles.notice, { color: palette.textSecondary }]}>{content.science.sleepPriority}</Text>
      </View>
    </LucidScreen>
  );
}

const styles = StyleSheet.create({
  destinations: { gap: LucidSpace.lg },
  destination: {
    minHeight: 224,
    overflow: 'hidden',
    padding: 0,
    borderRadius: LucidRadius.xl,
  },
  destinationContent: { minHeight: 224, flex: 1, justifyContent: 'space-between', padding: LucidSpace.lg },
  statusStack: { alignItems: 'flex-start', gap: LucidSpace.xs },
  statusRow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: LucidSpace.xs, borderRadius: LucidRadius.full, paddingHorizontal: LucidSpace.sm, paddingVertical: LucidSpace.xs },
  statusDot: { width: 6, height: 6, borderRadius: LucidRadius.full },
  status: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.overline[0], lineHeight: LucidType.overline[1], textTransform: 'uppercase', letterSpacing: 1.2 },
  suggestedRow: { alignSelf: 'flex-start', borderRadius: LucidRadius.full, paddingHorizontal: LucidSpace.sm, paddingVertical: LucidSpace.xs },
  suggested: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.overline[0], lineHeight: LucidType.overline[1], letterSpacing: 0.4 },
  destinationBottom: { gap: LucidSpace.md },
  destinationTitleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: LucidSpace.md },
  destinationCopy: { flex: 1, gap: 2 },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: LucidType.h2[0], lineHeight: LucidType.h2[1] },
  expanded: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  noticeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: LucidSpace.sm, paddingHorizontal: LucidSpace.sm },
  notice: { flex: 1, fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
});
