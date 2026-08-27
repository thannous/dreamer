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
import {
  getLucidPersonalizedPlan,
  type LucidPlanPrimaryAction,
  type LucidRecommendedTechnique,
} from '@/lib/lucid/personalization';
import { evaluateLucidSafetyPolicyFromState } from '@/lib/lucid/safety';

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
  en: {
    eyebrow: 'Programs',
    title: 'Choose your path',
    sessions: 'sessions',
    completed: 'completed',
    active: 'in progress',
    paused: 'paused',
    notStarted: 'ready',
    suggested: 'Suggested starting point',
    unavailable: 'Unavailable for now',
    why: 'Why?',
    wbtbBeginnerWarning: 'Interrupts sleep; approach gradually.',
    whyReasons: {
      prudent_defaults: 'A cautious MILD start matches your current profile.',
      weak_recall: 'Recent mornings show little dream recall, so recall comes first.',
      beginner_weak_recall: 'As a beginner with weak recall, dream memory comes before night techniques.',
      first_lucid_mild: 'Enough recall is in place for a first lucid attempt with guided MILD.',
      frequent_lucidity_ssild: 'SSILD is the suggested next practice for more frequent lucidity.',
      recall_goal: 'Your chosen goal is stronger dream recall.',
      sleep_recovery: 'Recent sleep looks strained, so interruptions stay paused.',
      repeated_signal_wakeups: 'Night signals woke you twice recently, so cues are reduced or paused.',
      policy_recovery: 'Safety recovery is active, so night interruptions stay off.',
      policy_reduced: 'Safety reduced intensity is active for night practice.',
    },
  },
  fr: {
    eyebrow: 'Programmes',
    title: 'Choisissez votre chemin',
    sessions: 'séances',
    completed: 'terminé',
    active: 'en cours',
    paused: 'en pause',
    notStarted: 'prêt',
    suggested: 'Point de départ suggéré',
    unavailable: 'Indisponible pour le moment',
    why: 'Pourquoi ?',
    wbtbBeginnerWarning: 'Interrompt le sommeil ; à aborder progressivement.',
    whyReasons: {
      prudent_defaults: 'Un départ MILD prudent correspond à votre profil actuel.',
      weak_recall: 'Les matins récents montrent peu de rappel, donc le rappel passe d’abord.',
      beginner_weak_recall: 'Débutant avec un rappel faible : la mémoire des rêves passe avant les techniques de nuit.',
      first_lucid_mild: 'Le rappel suffit pour un premier essai lucide avec MILD guidé.',
      frequent_lucidity_ssild: 'SSILD est la pratique suggérée pour une lucidité plus fréquente.',
      recall_goal: 'Votre objectif choisi est un meilleur rappel des rêves.',
      sleep_recovery: 'Le sommeil récent paraît fragile, donc les interruptions restent en pause.',
      repeated_signal_wakeups: 'Les signaux vous ont réveillé deux fois récemment, donc ils sont réduits ou en pause.',
      policy_recovery: 'Le mode récupération de sécurité est actif, donc les interruptions restent coupées.',
      policy_reduced: 'L’intensité réduite de sécurité s’applique à la pratique de nuit.',
    },
  },
  es: {
    eyebrow: 'Programas',
    title: 'Elige tu camino',
    sessions: 'sesiones',
    completed: 'completado',
    active: 'en curso',
    paused: 'en pausa',
    notStarted: 'listo',
    suggested: 'Punto de partida sugerido',
    unavailable: 'No disponible por ahora',
    why: '¿Por qué?',
    wbtbBeginnerWarning: 'Interrumpe el sueño; empieza gradualmente.',
    whyReasons: {
      prudent_defaults: 'Un inicio prudente con MILD encaja con tu perfil actual.',
      weak_recall: 'Las mañanas recientes muestran poco recuerdo, así que el recuerdo va primero.',
      beginner_weak_recall: 'Como principiante con poco recuerdo, la memoria onírica va antes que las técnicas nocturnas.',
      first_lucid_mild: 'Hay recuerdo suficiente para un primer intento lúcido con MILD guiado.',
      frequent_lucidity_ssild: 'SSILD es la práctica sugerida para una lucidez más frecuente.',
      recall_goal: 'Tu objetivo elegido es un mejor recuerdo de los sueños.',
      sleep_recovery: 'El sueño reciente parece frágil, así que las interrupciones siguen en pausa.',
      repeated_signal_wakeups: 'Las señales te despertaron dos veces recientemente, así que se reducen o pausan.',
      policy_recovery: 'La recuperación de seguridad está activa, así que las interrupciones siguen apagadas.',
      policy_reduced: 'La intensidad reducida de seguridad se aplica a la práctica nocturna.',
    },
  },
  de: {
    eyebrow: 'Programme',
    title: 'Wähle deinen Weg',
    sessions: 'Einheiten',
    completed: 'abgeschlossen',
    active: 'läuft',
    paused: 'pausiert',
    notStarted: 'bereit',
    suggested: 'Empfohlener Ausgangspunkt',
    unavailable: 'Zurzeit nicht verfügbar',
    why: 'Warum?',
    wbtbBeginnerWarning: 'Unterbricht den Schlaf; langsam herantasten.',
    whyReasons: {
      prudent_defaults: 'Ein vorsichtiger MILD-Start passt zu deinem aktuellen Profil.',
      weak_recall: 'Die letzten Morgen zeigen wenig Traumerinnerung, deshalb kommt Erinnerung zuerst.',
      beginner_weak_recall: 'Als Anfänger mit schwacher Erinnerung kommt Traumgedächtnis vor Nachttechniken.',
      first_lucid_mild: 'Die Erinnerung reicht für einen ersten Klartraumversuch mit geführtem MILD.',
      frequent_lucidity_ssild: 'SSILD ist die vorgeschlagene Praxis für häufigere Klarträume.',
      recall_goal: 'Dein gewähltes Ziel ist eine stärkere Traumerinnerung.',
      sleep_recovery: 'Der letzte Schlaf wirkt belastet, deshalb bleiben Unterbrechungen pausiert.',
      repeated_signal_wakeups: 'Nachtsignale haben dich kürzlich zweimal geweckt, deshalb werden sie reduziert oder pausiert.',
      policy_recovery: 'Die Sicherheits-Erholung ist aktiv, deshalb bleiben Unterbrechungen aus.',
      policy_reduced: 'Die reduzierte Sicherheitsintensität gilt für die Nachtpraxis.',
    },
  },
  it: {
    eyebrow: 'Programmi',
    title: 'Scegli il tuo percorso',
    sessions: 'sessioni',
    completed: 'completato',
    active: 'in corso',
    paused: 'in pausa',
    notStarted: 'pronto',
    suggested: 'Punto di partenza suggerito',
    unavailable: 'Non disponibile per ora',
    why: 'Perché?',
    wbtbBeginnerWarning: 'Interrompe il sonno; procedi gradualmente.',
    whyReasons: {
      prudent_defaults: 'Un avvio MILD prudente corrisponde al tuo profilo attuale.',
      weak_recall: 'Le mattine recenti mostrano poco ricordo, quindi il ricordo viene prima.',
      beginner_weak_recall: 'Da principiante con ricordo debole, la memoria dei sogni viene prima delle tecniche notturne.',
      first_lucid_mild: 'C’è ricordo sufficiente per un primo tentativo lucido con MILD guidato.',
      frequent_lucidity_ssild: 'SSILD è la pratica suggerita per una lucidità più frequente.',
      recall_goal: 'Il tuo obiettivo scelto è un ricordo dei sogni più forte.',
      sleep_recovery: 'Il sonno recente sembra affaticato, quindi le interruzioni restano in pausa.',
      repeated_signal_wakeups: 'I segnali ti hanno svegliato due volte di recente, quindi sono ridotti o in pausa.',
      policy_recovery: 'Il recupero di sicurezza è attivo, quindi le interruzioni restano spente.',
      policy_reduced: 'L’intensità ridotta di sicurezza si applica alla pratica notturna.',
    },
  },
} as const;

function isPracticeRecommendation(
  action: LucidPlanPrimaryAction,
  technique: LucidRecommendedTechnique | null
): technique is LucidRecommendedTechnique {
  return (
    (action === 'practice_mild' || action === 'practice_ssild') &&
    (technique === 'mild' || technique === 'ssild')
  );
}

export default function LucidProgramsScreen() {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { state, content } = useLucidTrainer();
  const copy = COPY[content.locale];
  const safetyPolicy = evaluateLucidSafetyPolicyFromState(state);
  const plan = getLucidPersonalizedPlan({
    goal: state!.onboarding.goal,
    experience: state!.onboarding.experience,
    observations: state!.experiments,
    policy: safetyPolicy,
  });
  const hasStartedProgram = state!.progress.some((item) => item.status !== 'not_started');
  const suggestedTechnique = !hasStartedProgram && isPracticeRecommendation(plan.primaryAction, plan.recommendedTechnique)
    ? plan.recommendedTechnique
    : null;
  const wbtbUnavailable = !plan.allowWbtb;
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
        const recommended = suggestedTechnique === id;
        const unavailable = id === 'wbtb' && wbtbUnavailable;
        const hasUsefulStatus =
          progress?.status === 'active' ||
          progress?.status === 'paused' ||
          progress?.status === 'completed';
        const hideReadyBecauseUnavailable = unavailable && !hasUsefulStatus;
        const whyText = recommended ? `${copy.why} ${copy.whyReasons[plan.reasonCode]}` : '';
        const accessibilityLabel = [
          program.title,
          program.expandedName,
          recommended ? copy.suggested : '',
          whyText,
          unavailable ? copy.unavailable : '',
          hideReadyBecauseUnavailable ? '' : status,
          `${completed} / ${program.sessions.length} ${copy.sessions}`,
          program.summary,
          plan.cautionWbtb && id === 'wbtb' ? copy.wbtbBeginnerWarning : '',
        ].filter((part) => part.length > 0).join('. ');
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
                ) : hideReadyBecauseUnavailable ? null : (
                  <View style={[styles.statusRow, { backgroundColor: `${palette.backgroundDeep}CC` }]}>
                    <View style={[styles.statusDot, { backgroundColor: progress?.status === 'active' ? palette.accent : palette.textMuted }]} />
                    <Text style={[styles.status, { color: progress?.status === 'active' ? palette.accent : palette.textSecondary }]}>{status}</Text>
                  </View>
                )}
                {unavailable ? (
                  <View
                    style={[styles.statusRow, { backgroundColor: `${palette.backgroundDeep}CC` }]}
                    testID={`lucid-program-${id}-unavailable`}
                  >
                    <Text style={[styles.status, { color: palette.textSecondary }]}>{copy.unavailable}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.destinationBottom}>
                <View style={styles.destinationTitleRow}>
                  <View style={styles.destinationCopy}>
                    <Text style={[styles.title, { color: palette.text }]}>{program.title}</Text>
                    <Text numberOfLines={1} style={[styles.expanded, { color: palette.textSecondary }]}>{program.expandedName}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={LucidIcon.lg} color={palette.accent} />
                </View>
                {recommended ? (
                  <Text
                    style={[styles.why, { color: palette.textSecondary }]}
                    testID={`lucid-program-${id}-why`}
                  >
                    {whyText}
                  </Text>
                ) : null}
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
  why: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  noticeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: LucidSpace.sm, paddingHorizontal: LucidSpace.sm },
  notice: { flex: 1, fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
});
