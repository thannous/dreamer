import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import {
  LucidButton,
  LucidCard,
  LucidIconAction,
  LucidPill,
  LucidProgressBar,
  LucidScreen,
  LucidSectionHeader,
} from '@/components/lucid/LucidUI';
import { getLucidPalette } from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import { useLucidNow } from '@/hooks/useLucidNow';
import {
  buildLucidProgramCalendar,
  getLucidLocalDateKey,
  type LucidProgramCalendarStatus,
} from '@/lib/lucid/calendar';
import type { LucidTechnique } from '@/lib/lucid/model';
import { closeLucidRoute } from '@/lib/lucid/routes';

const COPY = {
  en: { program: 'Guided program', evidence: 'Evidence and limits', calendar: 'Practice calendar', calendarHint: 'Missed days stay available. Never shorten sleep to catch up.', calendarPending: 'Dates appear once you start the program.', today: 'Today', available: 'Available', upcoming: 'Planned', plan: 'Program plan', session: 'Session', min: 'min', start: 'Start program', resume: 'Resume training', pause: 'Pause program', restart: 'Review program', prerequisites: 'Before you begin', stop: 'Stop rules', complete: 'Completed', unavailable: 'Program unavailable' },
  fr: { program: 'Programme guidé', evidence: 'Preuves et limites', calendar: 'Calendrier de pratique', calendarHint: 'Les jours manqués restent disponibles. Ne réduisez jamais votre sommeil pour rattraper.', calendarPending: 'Les dates apparaîtront au démarrage du programme.', today: 'Aujourd’hui', available: 'Disponible', upcoming: 'Prévu', plan: 'Plan du programme', session: 'Séance', min: 'min', start: 'Commencer le programme', resume: 'Reprendre l’entraînement', pause: 'Mettre en pause', restart: 'Revoir le programme', prerequisites: 'Avant de commencer', stop: 'Quand arrêter', complete: 'Terminé', unavailable: 'Programme indisponible' },
  es: { program: 'Programa guiado', evidence: 'Evidencia y límites', calendar: 'Calendario de práctica', calendarHint: 'Los días perdidos siguen disponibles. Nunca acortes el sueño para recuperar.', calendarPending: 'Las fechas aparecerán al iniciar el programa.', today: 'Hoy', available: 'Disponible', upcoming: 'Planificado', plan: 'Plan del programa', session: 'Sesión', min: 'min', start: 'Iniciar programa', resume: 'Continuar entrenamiento', pause: 'Pausar programa', restart: 'Revisar programa', prerequisites: 'Antes de empezar', stop: 'Cuándo parar', complete: 'Completado', unavailable: 'Programa no disponible' },
  de: { program: 'Geführtes Programm', evidence: 'Evidenz und Grenzen', calendar: 'Übungskalender', calendarHint: 'Verpasste Tage bleiben verfügbar. Verkürze nie den Schlaf zum Aufholen.', calendarPending: 'Die Termine erscheinen, sobald du das Programm startest.', today: 'Heute', available: 'Verfügbar', upcoming: 'Geplant', plan: 'Programmplan', session: 'Einheit', min: 'Min.', start: 'Programm starten', resume: 'Training fortsetzen', pause: 'Programm pausieren', restart: 'Programm ansehen', prerequisites: 'Vor dem Start', stop: 'Stoppregeln', complete: 'Abgeschlossen', unavailable: 'Programm nicht verfügbar' },
  it: { program: 'Programma guidato', evidence: 'Prove e limiti', calendar: 'Calendario di pratica', calendarHint: 'I giorni saltati restano disponibili. Non ridurre mai il sonno per recuperare.', calendarPending: 'Le date compaiono all’avvio del programma.', today: 'Oggi', available: 'Disponibile', upcoming: 'Pianificato', plan: 'Piano del programma', session: 'Sessione', min: 'min', start: 'Inizia programma', resume: 'Continua training', pause: 'Metti in pausa', restart: 'Rivedi programma', prerequisites: 'Prima di iniziare', stop: 'Quando fermarsi', complete: 'Completato', unavailable: 'Programma non disponibile' },
} as const;

function isTechnique(value: string | string[] | undefined): value is LucidTechnique {
  return value === 'mild' || value === 'ssild' || value === 'wbtb';
}

export default function LucidProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { state, content, startProgram, pauseProgram } = useLucidTrainer();
  const [busy, setBusy] = useState(false);
  const now = useLucidNow();
  const copy = COPY[content.locale];
  const close = () => closeLucidRoute(router, '/lucid/(tabs)/programs');

  if (!isTechnique(id)) {
    return <LucidScreen title={copy.unavailable} trailing={<LucidIconAction label={content.chrome.common.back} icon="close" onPress={close} />}><LucidButton label={content.chrome.common.back} onPress={close} /></LucidScreen>;
  }

  const program = content.programs[id];
  const progress = state!.progress.find((item) => item.technique === id);
  const completed = progress?.completedExerciseIds.length ?? 0;
  const active = progress?.status === 'active';
  const actionLabel = progress?.status === 'completed' ? copy.restart : progress ? copy.resume : copy.start;
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

  const handleStart = async () => {
    setBusy(true);
    try {
      await startProgram(id);
      const day = progress?.currentDay ?? 1;
      router.push(`/lucid/session/${id}/${day}`);
    } catch {
      Alert.alert(content.chrome.appName, content.chrome.common.error);
    } finally { setBusy(false); }
  };

  return (
    <LucidScreen eyebrow={copy.program} title={program.title} subtitle={program.summary} trailing={<LucidIconAction label={content.chrome.common.back} icon="close" onPress={close} />}>
      <View style={styles.meta}>
        <LucidPill label={program.expandedName} tone="accent" icon="sparkles" />
        <LucidPill label={`${program.sessions.length} ${copy.session.toLowerCase()}`} tone="accent" icon="calendar" />
      </View>
      <LucidProgressBar value={completed / program.sessions.length} />
      <LucidButton label={actionLabel} icon="play" loading={busy} onPress={() => void handleStart()} />
      {active ? <LucidButton label={copy.pause} variant="ghost" icon="pause" onPress={() => void pauseProgram(id)} /> : null}

      <LucidCard accent="accent">
        <LucidPill label={copy.evidence} tone="accent" icon="flask" />
        <Text style={[styles.bodyStrong, { color: palette.text }]}>{program.evidenceNote}</Text>
        <Text style={[styles.body, { color: palette.textSecondary }]}>{content.science.uncertainty}</Text>
      </LucidCard>

      <LucidSectionHeader title={copy.calendar} caption={startedAt !== null ? copy.calendarHint : copy.calendarPending} />
      <View style={styles.calendarGrid}>
        {calendar
          ? calendar.map((entry) => (
              <CalendarDay
                key={entry.session}
                dateKey={entry.dateKey}
                label={
                  entry.status === 'completed'
                    ? copy.complete
                    : entry.status === 'today'
                      ? copy.today
                      : entry.status === 'available'
                        ? copy.available
                        : copy.upcoming
                }
                locale={content.locale}
                session={entry.session}
                status={entry.status}
              />
            ))
          : program.sessions.map((session) => (
              <CalendarDay key={session.id} label={copy.upcoming} locale={content.locale} session={session.session} status="upcoming" />
            ))}
      </View>

      <View style={styles.twoColumn}>
        <LucidCard style={styles.half}>
          <Text style={[styles.cardLabel, { color: palette.text }]}>{copy.prerequisites}</Text>
          {program.prerequisites.map((item) => <Bullet key={item} text={item} color={palette.accent} />)}
        </LucidCard>
        <LucidCard style={styles.half}>
          <Text style={[styles.cardLabel, { color: palette.text }]}>{copy.stop}</Text>
          {program.stopRules.map((item) => <Bullet key={item} text={item} color={palette.amber} />)}
        </LucidCard>
      </View>

      <LucidSectionHeader title={copy.plan} />
      {program.sessions.map((session) => {
        const done = progress?.completedExerciseIds.includes(session.id) ?? false;
        const locked = !done && session.session > (progress?.currentDay ?? 1);
        return (
          <LucidCard key={session.id} onPress={locked ? undefined : () => router.push(`/lucid/session/${id}/${session.session}`)} accessibilityLabel={session.title}>
            <View style={styles.sessionRow}>
              <View style={[styles.sessionNumber, { backgroundColor: done ? palette.accentSoft : palette.surfaceRaised }]}>
                {done ? <Ionicons name="checkmark" size={18} color={palette.accent} /> : <Text style={[styles.sessionNumberText, { color: locked ? palette.textMuted : palette.text }]}>{session.session}</Text>}
              </View>
              <View style={styles.sessionCopy}>
                <Text style={[styles.sessionTitle, { color: locked ? palette.textMuted : palette.text }]}>{session.title}</Text>
                <Text style={[styles.sessionMeta, { color: palette.textSecondary }]}>{session.durationMinutes} {copy.min} · {session.objective}</Text>
              </View>
              <Ionicons name={locked ? 'lock-closed' : 'chevron-forward'} size={19} color={palette.textMuted} />
            </View>
          </LucidCard>
        );
      })}
    </LucidScreen>
  );
}

function Bullet({ text, color }: { text: string; color: string }) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  return <View style={styles.bullet}><View style={[styles.dot, { backgroundColor: color }]} /><Text style={[styles.bulletText, { color: palette.textSecondary }]}>{text}</Text></View>;
}

function CalendarDay({ dateKey, label, locale, session, status }: { dateKey?: string; label: string; locale: string; session: number; status: LucidProgramCalendarStatus }) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const color = status === 'completed' ? palette.accent : status === 'today' ? palette.accent : palette.textSecondary;
  const date = dateKey ? new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric' }).format(new Date(`${dateKey}T12:00:00`)) : '—';
  return (
    <View accessibilityLabel={dateKey ? `${session}, ${label}, ${dateKey}` : `${session}, ${label}`} style={[styles.calendarDay, { backgroundColor: status === 'today' ? palette.accentSoft : palette.surface, borderColor: status === 'completed' ? palette.accent : status === 'today' ? palette.accent : palette.border }]}>
      <Text style={[styles.calendarSession, { color }]}>{session}</Text>
      <Text style={[styles.calendarDate, { color: dateKey ? palette.text : palette.textMuted }]}>{date}</Text>
      <Text numberOfLines={1} style={[styles.calendarStatus, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bodyStrong: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, lineHeight: 22 },
  body: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, lineHeight: 19 },
  twoColumn: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  half: { flex: 1, padding: 14 },
  cardLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13, lineHeight: 18 },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  bulletText: { flex: 1, fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, lineHeight: 16 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sessionNumber: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  sessionNumberText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14 },
  sessionCopy: { flex: 1, gap: 3 },
  sessionTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, lineHeight: 19 },
  sessionMeta: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, lineHeight: 16 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  calendarDay: { minWidth: 86, flexGrow: 1, flexBasis: '22%', borderRadius: 17, borderWidth: 1, padding: 11, gap: 2 },
  calendarSession: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 11 },
  calendarDate: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] },
  calendarStatus: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 9, lineHeight: 13 },
});
