import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useContext, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import {
  buildLucidJourneyDays,
  LucidJourneyMap,
} from '@/components/lucid/LucidJourneyMap';
import { PressableScale } from '@/components/motion';
import {
  LucidButton,
  LucidIconAction,
  LucidOverline,
  LucidPill,
  LucidScreen,
  LucidSectionHeader,
} from '@/components/lucid/LucidUI';
import { getLucidPalette, LucidRadius, LucidSpace, LucidType } from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import { useLucidNow } from '@/hooks/useLucidNow';
import {
  buildLucidProgramCalendar,
  getLucidLocalDateKey,
} from '@/lib/lucid/calendar';
import type { LucidTechnique } from '@/lib/lucid/model';
import { closeLucidRoute } from '@/lib/lucid/routes';

const COPY = {
  en: {
    program: 'Guided program', journey: 'Journey', progress: 'Progress',
    evidence: 'Evidence and limits', limits: 'What the research cannot promise',
    unlockHint: 'Complete the previous session to unlock this one.',
    calendarHint: 'Missed days stay available. Never shorten sleep to catch up.', current: 'Current session',
    available: 'Available', upcoming: 'Planned', session: 'Session', sessions: 'sessions', eachSession: 'per session',
    min: 'min', start: 'Start program', resume: 'Resume training', pause: 'Pause program', restart: 'Review program',
    active: 'Training in progress', paused: 'Program paused', pauseTitle: 'Need a break?',
    pauseBody: 'Pause without losing a session. Your current step will stay ready when you return.',
    pausedBody: 'Your progress is preserved. Resume when your sleep and schedule allow.',
    prerequisites: 'Before you begin', stop: 'When to stop', complete: 'Completed',
    safetyTitle: 'Protect your sleep tonight', unavailable: 'Program unavailable', about: 'Method and safety',
  },
  fr: {
    program: 'Programme guidé', journey: 'Parcours', progress: 'Progression',
    evidence: 'Preuves et limites', limits: 'Ce que la recherche ne peut pas promettre',
    unlockHint: 'Terminez la séance précédente pour débloquer celle-ci.',
    calendarHint: 'Les jours manqués restent disponibles. Ne réduisez jamais votre sommeil pour rattraper.', current: 'Séance actuelle',
    available: 'Disponible', upcoming: 'Prévu', session: 'Séance', sessions: 'séances', eachSession: 'par séance',
    min: 'min', start: 'Commencer le programme', resume: 'Reprendre l’entraînement', pause: 'Mettre en pause', restart: 'Revoir le programme',
    active: 'Entraînement en cours', paused: 'Programme en pause', pauseTitle: 'Besoin de souffler ?',
    pauseBody: 'Mettez en pause sans perdre de séance. Votre étape actuelle restera prête à votre retour.',
    pausedBody: 'Votre progression est conservée. Reprenez lorsque votre sommeil et votre emploi du temps le permettent.',
    prerequisites: 'Avant de commencer', stop: 'Quand arrêter', complete: 'Terminé',
    safetyTitle: 'Ce soir, protégez votre sommeil', unavailable: 'Programme indisponible', about: 'Méthode et sécurité',
  },
  es: {
    program: 'Programa guiado', journey: 'Recorrido', progress: 'Progreso',
    evidence: 'Evidencia y límites', limits: 'Lo que la investigación no puede prometer',
    unlockHint: 'Completa la sesión anterior para desbloquear esta.',
    calendarHint: 'Los días perdidos siguen disponibles. Nunca acortes el sueño para recuperar.', current: 'Sesión actual',
    available: 'Disponible', upcoming: 'Planificado', session: 'Sesión', sessions: 'sesiones', eachSession: 'por sesión',
    min: 'min', start: 'Iniciar programa', resume: 'Continuar entrenamiento', pause: 'Pausar programa', restart: 'Revisar programa',
    active: 'Entrenamiento en curso', paused: 'Programa en pausa', pauseTitle: '¿Necesitas un descanso?',
    pauseBody: 'Pausa sin perder ninguna sesión. Tu etapa actual seguirá lista cuando vuelvas.',
    pausedBody: 'Tu progreso se conserva. Continúa cuando tu descanso y tu horario lo permitan.',
    prerequisites: 'Antes de empezar', stop: 'Cuándo parar', complete: 'Completado',
    safetyTitle: 'Protege tu sueño esta noche', unavailable: 'Programa no disponible', about: 'Método y seguridad',
  },
  de: {
    program: 'Geführtes Programm', journey: 'Pfad', progress: 'Fortschritt',
    evidence: 'Evidenz und Grenzen', limits: 'Was die Forschung nicht versprechen kann',
    unlockHint: 'Schließe die vorherige Einheit ab, um diese freizuschalten.',
    calendarHint: 'Verpasste Tage bleiben verfügbar. Verkürze nie den Schlaf zum Aufholen.', current: 'Aktuelle Einheit',
    available: 'Verfügbar', upcoming: 'Geplant', session: 'Einheit', sessions: 'Einheiten', eachSession: 'pro Einheit',
    min: 'Min.', start: 'Programm starten', resume: 'Training fortsetzen', pause: 'Programm pausieren', restart: 'Programm ansehen',
    active: 'Training läuft', paused: 'Programm pausiert', pauseTitle: 'Brauchst du eine Pause?',
    pauseBody: 'Pausiere, ohne eine Einheit zu verlieren. Dein aktueller Schritt bleibt für die Rückkehr bereit.',
    pausedBody: 'Dein Fortschritt bleibt erhalten. Fahre fort, wenn Schlaf und Zeitplan es erlauben.',
    prerequisites: 'Vor dem Start', stop: 'Wann du aufhören solltest', complete: 'Abgeschlossen',
    safetyTitle: 'Schütze heute Nacht deinen Schlaf', unavailable: 'Programm nicht verfügbar', about: 'Methode und Sicherheit',
  },
  it: {
    program: 'Programma guidato', journey: 'Percorso', progress: 'Progresso',
    evidence: 'Prove e limiti', limits: 'Cosa la ricerca non può promettere',
    unlockHint: 'Completa la sessione precedente per sbloccare questa.',
    calendarHint: 'I giorni saltati restano disponibili. Non ridurre mai il sonno per recuperare.', current: 'Sessione attuale',
    available: 'Disponibile', upcoming: 'Pianificato', session: 'Sessione', sessions: 'sessioni', eachSession: 'per sessione',
    min: 'min', start: 'Inizia programma', resume: 'Continua training', pause: 'Metti in pausa', restart: 'Rivedi programma',
    active: 'Training in corso', paused: 'Programma in pausa', pauseTitle: 'Hai bisogno di una pausa?',
    pauseBody: 'Metti in pausa senza perdere una sessione. La tappa attuale resterà pronta al tuo ritorno.',
    pausedBody: 'I tuoi progressi restano salvati. Riprendi quando il sonno e gli impegni lo permettono.',
    prerequisites: 'Prima di iniziare', stop: 'Quando fermarsi', complete: 'Completato',
    safetyTitle: 'Proteggi il sonno questa notte', unavailable: 'Programma non disponibile', about: 'Metodo e sicurezza',
  },
} as const;

function isTechnique(value: string | string[] | undefined): value is LucidTechnique {
  return value === 'mild' || value === 'ssild' || value === 'wbtb';
}

export default function LucidProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  // LucidScreen normally owns the safe-area contract. This full-bleed MILD
  // treatment intentionally paints behind it, then restores the inset only for
  // its overlaid header. The optional context keeps isolated route renders
  // deterministic without weakening the real-device inset.
  const insets = useContext(SafeAreaInsetsContext);
  const { state, content, startProgram, pauseProgram } = useLucidTrainer();
  const [busy, setBusy] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const now = useLucidNow();
  const copy = COPY[content.locale];
  const close = () => closeLucidRoute(router, '/lucid/(tabs)/programs');

  // This route remains mounted while a session is pushed on top of it. Reset
  // the transient loading state both when it blurs and when it becomes active
  // again, so returning never resurrects a stale ActivityIndicator.
  useFocusEffect(
    useCallback(() => {
      setBusy(false);
      return () => setBusy(false);
    }, [])
  );

  if (!isTechnique(id)) {
    return (
      <LucidScreen
        eyebrow={copy.program}
        title={copy.unavailable}
        trailing={
          <LucidIconAction
            label={content.chrome.common.back}
            icon="arrow-back"
            onPress={close}
          />
        }
      >
        <LucidButton
          label={content.chrome.common.back}
          icon="arrow-back"
          variant="secondary"
          onPress={close}
        />
      </LucidScreen>
    );
  }

  const program = content.programs[id];
  const progress = state!.progress.find((item) => item.technique === id);
  const completed = program.sessions.filter((session) =>
    progress?.completedExerciseIds.includes(session.id)
  ).length;
  const active = progress?.status === 'active';
  const paused = progress?.status === 'paused';
  const statusLabel = active ? copy.active : paused ? copy.paused : progress?.status === 'completed' ? copy.complete : null;
  const actionLabel = progress?.status === 'completed' ? copy.restart : progress ? copy.resume : copy.start;
  const sessionDurations = program.sessions.map((session) => session.durationMinutes);
  const shortestSession = Math.min(...sessionDurations);
  const longestSession = Math.max(...sessionDurations);
  // A program that was never started has no dates. Showing a calendar built on
  // `now` would invent a schedule — and a "today" the user never planned.
  const startedAt = progress?.startedAt ?? null;
  const calendar = startedAt !== null
    ? buildLucidProgramCalendar({
        startDateKey: getLucidLocalDateKey(startedAt),
        todayDateKey: getLucidLocalDateKey(now),
        sessionCount: program.sessions.length,
        weeklyTarget: state!.onboarding.weeklyTarget,
        completedSessionCount: completed,
      })
    : null;
  const currentDay = Math.max(1, Math.min(progress?.currentDay ?? 1, program.sessions.length));
  const currentSession = program.sessions[currentDay - 1];
  const journeyDays = buildLucidJourneyDays({
    sessions: program.sessions,
    completedExerciseIds: progress?.completedExerciseIds ?? [],
    currentDay,
    started: startedAt !== null,
  }).map((day) => {
    const entry = calendar?.find((item) => item.session === day.session.session);
    return {
      ...day,
      dateLabel: entry
        ? new Intl.DateTimeFormat(content.locale, { weekday: 'short', day: 'numeric' }).format(
            new Date(`${entry.dateKey}T12:00:00`)
          )
        : undefined,
    };
  });

  const handleStart = async () => {
    setBusy(true);
    try {
      await startProgram(id);
      const day = progress?.currentDay ?? 1;
      // Commit the visual reset before pushing: the underlying screen may be
      // frozen by the navigator as soon as the session gains focus.
      setBusy(false);
      router.push(`/lucid/session/${id}/${day}`);
    } catch {
      Alert.alert(content.chrome.appName, content.chrome.common.error);
    } finally { setBusy(false); }
  };

  const programMeta = (
    <View style={styles.meta}>
      {statusLabel ? (
        <LucidPill
          label={statusLabel}
          tone={paused ? 'neutral' : 'accent'}
          icon={active ? 'pulse-outline' : paused ? 'pause-outline' : 'checkmark-circle-outline'}
        />
      ) : null}
      <LucidPill
        label={`${program.sessions.length} ${copy.sessions}`}
        tone="neutral"
        icon="calendar-outline"
      />
      <LucidPill
        label={`${shortestSession}–${longestSession} ${copy.min} ${copy.eachSession}`}
        tone="neutral"
        icon="time-outline"
      />
    </View>
  );

  const introduction = (
    <View style={styles.introduction}>
      {startedAt === null ? (
        <Text style={[styles.summary, { color: palette.textSecondary }]}>{program.summary}</Text>
      ) : null}
      {programMeta}
    </View>
  );

  const mildProgramDetails = (
    <View style={styles.programDetails} testID="lucid-program-details">
      <LucidSectionHeader title={program.title} caption={program.expandedName} />
      {programMeta}
    </View>
  );

  const journey = (
    <LucidJourneyMap
      currentSession={currentSession}
      days={journeyDays}
      immersive={id === 'mild'}
      immersiveTopInset={id === 'mild' ? insets?.top ?? 0 : undefined}
      labels={{
        progress: copy.progress,
        session: copy.session,
        completed: copy.complete,
        current: copy.current,
        available: copy.available,
        upcoming: copy.upcoming,
        unlockHint: copy.unlockHint,
        duration: copy.min,
        safetyTitle: copy.safetyTitle,
        safetyBody: copy.calendarHint,
      }}
      primaryActionLabel={actionLabel}
      primaryActionLoading={busy}
      progressValue={completed}
      programLabel={id === 'mild' ? `${copy.journey} ${program.title}` : copy.journey}
      reduceMotion={state?.onboarding.accessibility?.reduceMotion ?? false}
      sessionsEnabled={active || progress?.status === 'completed'}
      started={startedAt !== null}
      trailing={id === 'mild' ? (
        <LucidIconAction
          label={content.chrome.common.back}
          icon="arrow-back"
          onPress={close}
        />
      ) : undefined}
      onPrimaryAction={() => void handleStart()}
      onSessionPress={(session) => router.push(`/lucid/session/${id}/${session.session}`)}
    />
  );

  const immersiveMild = id === 'mild';

  return (
    <LucidScreen
      title={immersiveMild ? undefined : program.title}
      subtitle={immersiveMild ? undefined : program.expandedName}
      trailing={immersiveMild ? undefined : <LucidIconAction label={content.chrome.common.back} icon="arrow-back" onPress={close} />}
      contentStyle={immersiveMild ? styles.immersiveScreenContent : undefined}
      testID="lucid-program-detail"
    >
      {immersiveMild ? (
        journey
      ) : (
        <>
          {introduction}
          {journey}
        </>
      )}

      <View style={[styles.supportingContent, immersiveMild && styles.supportingContentImmersive]}>
        {immersiveMild ? mildProgramDetails : null}

        {active || paused ? (
          <View
            style={[
              styles.trainingState,
              { backgroundColor: palette.surfaceMuted, borderColor: palette.border },
            ]}
          >
            <View style={styles.trainingStateCopy}>
              <LucidPill label={active ? copy.active : copy.paused} tone={active ? 'accent' : 'neutral'} icon={active ? 'pulse-outline' : 'pause-outline'} />
              {!active ? (
                <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.pausedBody}</Text>
              ) : null}
            </View>
            {active ? (
              <LucidButton
                accessibilityHint={copy.pauseBody}
                label={copy.pause}
                variant="ghost"
                icon="pause"
                onPress={() => void pauseProgram(id)}
              />
            ) : null}
          </View>
        ) : null}

        <View style={[styles.disclosure, { borderColor: palette.border }]}>
          <PressableScale
            accessibilityRole="button"
            accessibilityState={{ expanded: aboutExpanded }}
            onPress={() => setAboutExpanded((expanded) => !expanded)}
            style={styles.disclosureButton}
            testID="lucid-program-about-toggle"
          >
            <View style={styles.disclosureTitleRow}>
              <Ionicons name="information-circle-outline" size={22} color={palette.accent} />
              <Text style={[styles.disclosureTitle, { color: palette.text }]}>{copy.about}</Text>
            </View>
            <Ionicons name={aboutExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={palette.textSecondary} />
          </PressableScale>

          {aboutExpanded ? (
            <View style={[styles.disclosureContent, { borderTopColor: palette.border }]} testID="lucid-program-about-content">
              <Text style={[styles.summary, { color: palette.textSecondary }]}>{program.summary}</Text>

              <View style={styles.infoSection}>
                <LucidOverline text={copy.evidence} tone="accent" />
                <Text style={[styles.bodyStrong, { color: palette.text }]}>{program.evidenceNote}</Text>
                <LucidOverline text={copy.limits} />
                <Text style={[styles.body, { color: palette.textSecondary }]}>{content.science.uncertainty}</Text>
              </View>

              <View style={[styles.guardrailSection, { borderTopColor: palette.border }]}>
                <Text accessibilityRole="header" style={[styles.cardLabel, { color: palette.text }]}>{copy.prerequisites}</Text>
                {program.prerequisites.map((item) => <Bullet key={item} text={item} color={palette.accent} />)}
              </View>
              <View style={[styles.guardrailSection, { borderTopColor: palette.border }]}>
                <Text accessibilityRole="header" style={[styles.cardLabel, { color: palette.amber }]}>{copy.stop}</Text>
                {program.stopRules.map((item) => <Bullet key={item} text={item} color={palette.amber} />)}
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </LucidScreen>
  );
}

function Bullet({ text, color }: { text: string; color: string }) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  return <View style={styles.bullet}><View style={[styles.dot, { backgroundColor: color }]} /><Text style={[styles.bulletText, { color: palette.textSecondary }]}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  immersiveScreenContent: {
    paddingTop: 0,
    paddingHorizontal: 0,
    gap: 0,
  },
  introduction: { gap: LucidSpace.sm, paddingBottom: LucidSpace.xs },
  programDetails: { gap: LucidSpace.sm },
  summary: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: LucidSpace.xs },
  supportingContent: { gap: LucidSpace.md, paddingTop: LucidSpace.sm },
  supportingContentImmersive: {
    paddingHorizontal: LucidSpace.gutter,
    paddingTop: LucidSpace.lg,
  },
  trainingState: { borderWidth: StyleSheet.hairlineWidth, borderRadius: LucidRadius.xl, padding: LucidSpace.md, gap: LucidSpace.md },
  trainingStateCopy: { flex: 1, gap: LucidSpace.sm, alignItems: 'flex-start' },
  bodyStrong: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  body: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  disclosure: { borderWidth: StyleSheet.hairlineWidth, borderRadius: LucidRadius.xl, overflow: 'hidden' },
  disclosureButton: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: LucidSpace.md, paddingHorizontal: LucidSpace.lg, paddingVertical: LucidSpace.md },
  disclosureTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: LucidSpace.sm },
  disclosureTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  disclosureContent: { borderTopWidth: StyleSheet.hairlineWidth, padding: LucidSpace.lg, gap: LucidSpace.lg },
  infoSection: { gap: LucidSpace.sm },
  guardrailSection: { borderTopWidth: StyleSheet.hairlineWidth, gap: LucidSpace.md, paddingTop: LucidSpace.lg },
  cardLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: LucidSpace.sm },
  // 6 est le diamètre de la pastille, pas un espacement ; le rayon la ferme.
  dot: { width: 6, height: 6, borderRadius: LucidRadius.full, marginTop: LucidSpace.xs },
  bulletText: { flex: 1, fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.overline[0], lineHeight: LucidType.overline[1] },
});
