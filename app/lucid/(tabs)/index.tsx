import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  LucidButton,
  LucidCard,
  LucidMetric,
  LucidPill,
  LucidProgressBar,
  LucidScreen,
  LucidSectionHeader,
} from '@/components/lucid/LucidUI';
import { getLucidPalette } from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import { useLucidNow } from '@/hooks/useLucidNow';
import { buildLucidWeeklyReview } from '@/lib/lucid/progress';

const COPY = {
  en: { eyebrow: 'Today', greeting: 'Train awareness, protect sleep', daily: 'Your next practice', noProgram: 'Choose a guided program to begin with a clear, gentle routine.', browse: 'Browse programs', reality: 'Reality check', realityBody: 'Pause. Ask how you arrived here, then test carefully.', doCheck: 'Do a mindful check', morning: 'Morning review', morningBody: 'Record preparation and outcome without judging the night.', log: 'Log last night', week: 'This week', attempts: 'attempts', recall: 'recall', lucid: 'lucid', coach: 'Offline coach', session: 'Session', of: 'of', continue: 'Continue session', synced: 'Synced', local: 'Saved locally', protect_sleep: 'Your notes suggest protecting sleep first. Skip disruptive techniques tonight.', start_first_session: 'Start gently with the first MILD session.', complete_preparation: 'A short, complete preparation is the most useful next step.', strengthen_recall: 'Focus on recall and write a few fragments on waking.', repeat_best_method: 'Repeat the method that has worked best for you.', keep_routine: 'Your routine is consistent. Keep it simple this week.', try_another_method: 'There is not enough signal yet; try another method without changing sleep length.' },
  fr: { eyebrow: 'Aujourd’hui', greeting: 'Entraînez l’attention, protégez le sommeil', daily: 'Votre prochaine pratique', noProgram: 'Choisissez un programme guidé pour commencer avec une routine claire et douce.', browse: 'Voir les programmes', reality: 'Test de réalité', realityBody: 'Faites une pause. Demandez-vous comment vous êtes arrivé ici, puis testez avec attention.', doCheck: 'Faire un test conscient', morning: 'Bilan du matin', morningBody: 'Notez la préparation et le résultat, sans juger la nuit.', log: 'Noter la nuit passée', week: 'Cette semaine', attempts: 'essais', recall: 'rappel', lucid: 'lucides', coach: 'Coach hors ligne', session: 'Séance', of: 'sur', continue: 'Continuer la séance', synced: 'Synchronisé', local: 'Enregistré localement', protect_sleep: 'Vos notes suggèrent de protéger le sommeil en priorité. Évitez les techniques perturbatrices ce soir.', start_first_session: 'Commencez doucement par la première séance MILD.', complete_preparation: 'Une préparation courte et complète est la prochaine étape la plus utile.', strengthen_recall: 'Concentrez-vous sur le rappel et notez quelques fragments au réveil.', repeat_best_method: 'Répétez la méthode qui vous a le mieux convenu.', keep_routine: 'Votre routine est régulière. Gardez-la simple cette semaine.', try_another_method: 'Le signal est encore faible ; essayez une autre méthode sans réduire votre sommeil.' },
  es: { eyebrow: 'Hoy', greeting: 'Entrena la atención, protege el sueño', daily: 'Tu próxima práctica', noProgram: 'Elige un programa guiado para empezar con una rutina clara y suave.', browse: 'Ver programas', reality: 'Prueba de realidad', realityBody: 'Pausa. Pregunta cómo llegaste aquí y comprueba con atención.', doCheck: 'Hacer una prueba consciente', morning: 'Revisión matinal', morningBody: 'Registra preparación y resultado sin juzgar la noche.', log: 'Registrar anoche', week: 'Esta semana', attempts: 'intentos', recall: 'recuerdo', lucid: 'lúcidos', coach: 'Coach sin conexión', session: 'Sesión', of: 'de', continue: 'Continuar sesión', synced: 'Sincronizado', local: 'Guardado localmente', protect_sleep: 'Tus notas sugieren proteger primero el sueño.', start_first_session: 'Empieza suavemente con la primera sesión MILD.', complete_preparation: 'Una preparación breve y completa es el siguiente paso útil.', strengthen_recall: 'Concéntrate en recordar y anota algunos fragmentos al despertar.', repeat_best_method: 'Repite el método que mejor te ha funcionado.', keep_routine: 'Tu rutina es constante. Mantenla sencilla esta semana.', try_another_method: 'Aún hay poca señal; prueba otro método sin reducir el sueño.' },
  de: { eyebrow: 'Heute', greeting: 'Achtsamkeit trainieren, Schlaf schützen', daily: 'Deine nächste Übung', noProgram: 'Wähle ein geführtes Programm für eine klare, sanfte Routine.', browse: 'Programme ansehen', reality: 'Realitätscheck', realityBody: 'Halte inne. Frage, wie du hierherkamst, und prüfe aufmerksam.', doCheck: 'Bewusst prüfen', morning: 'Morgenrückblick', morningBody: 'Notiere Vorbereitung und Ergebnis ohne Bewertung.', log: 'Letzte Nacht notieren', week: 'Diese Woche', attempts: 'Versuche', recall: 'Erinnerung', lucid: 'klar', coach: 'Offline-Coach', session: 'Einheit', of: 'von', continue: 'Einheit fortsetzen', synced: 'Synchronisiert', local: 'Lokal gespeichert', protect_sleep: 'Deine Notizen sprechen dafür, zuerst den Schlaf zu schützen.', start_first_session: 'Beginne sanft mit der ersten MILD-Einheit.', complete_preparation: 'Eine kurze, vollständige Vorbereitung ist der beste nächste Schritt.', strengthen_recall: 'Konzentriere dich auf Erinnerung und notiere morgens Fragmente.', repeat_best_method: 'Wiederhole die Methode, die am besten funktionierte.', keep_routine: 'Deine Routine ist stabil. Halte sie diese Woche einfach.', try_another_method: 'Noch wenig Signal: Teste eine andere Methode, ohne Schlaf zu kürzen.' },
  it: { eyebrow: 'Oggi', greeting: 'Allena l’attenzione, proteggi il sonno', daily: 'La tua prossima pratica', noProgram: 'Scegli un programma guidato per iniziare con una routine chiara e delicata.', browse: 'Vedi programmi', reality: 'Test di realtà', realityBody: 'Fermati. Chiediti come sei arrivato qui e verifica con attenzione.', doCheck: 'Fare un test consapevole', morning: 'Bilancio mattutino', morningBody: 'Registra preparazione e risultato senza giudicare la notte.', log: 'Registra la notte', week: 'Questa settimana', attempts: 'tentativi', recall: 'ricordo', lucid: 'lucidi', coach: 'Coach offline', session: 'Sessione', of: 'di', continue: 'Continua sessione', synced: 'Sincronizzato', local: 'Salvato localmente', protect_sleep: 'Le tue note suggeriscono di proteggere prima il sonno.', start_first_session: 'Inizia con calma dalla prima sessione MILD.', complete_preparation: 'Una preparazione breve e completa è il prossimo passo utile.', strengthen_recall: 'Concentrati sul ricordo e annota alcuni frammenti al risveglio.', repeat_best_method: 'Ripeti il metodo che ha funzionato meglio.', keep_routine: 'La tua routine è costante. Mantienila semplice questa settimana.', try_another_method: 'Ci sono ancora pochi dati; prova un altro metodo senza ridurre il sonno.' },
} as const;

export default function LucidTodayScreen() {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { state, content, syncStatus } = useLucidTrainer();
  const copy = COPY[content.locale];
  const active = state!.progress.find((item) => item.status === 'active') ?? state!.progress.find((item) => item.status === 'paused');
  const program = active ? content.programs[active.technique] : null;
  const sessionIndex = active ? Math.min(program!.sessions.length - 1, Math.max(0, active.currentDay - 1)) : 0;
  const now = useLucidNow();
  const week = useMemo(() => {
    const endAt = now + 1;
    return buildLucidWeeklyReview(state!.experiments, { startAt: endAt - 7 * 86400000, endAt });
  }, [now, state]);
  const coaching = copy[week.coaching.action];

  return (
    <LucidScreen testID="lucid-today" eyebrow={copy.eyebrow} title={copy.greeting} subtitle={content.chrome.tagline} trailing={<LucidPill label={syncStatus === 'synced' ? copy.synced : copy.local} tone={syncStatus === 'synced' ? 'cyan' : 'neutral'} icon={syncStatus === 'synced' ? 'cloud-done' : 'phone-portrait'} />}>
      <LucidSectionHeader title={copy.daily} />
      {active && program ? (
        <LucidCard accent="violet">
          <View style={styles.cardTop}>
            <LucidPill label={program.expandedName} tone="violet" />
            <Text style={[styles.sessionLabel, { color: palette.textSecondary }]}>{copy.session} {active.currentDay} {copy.of} {program.sessions.length}</Text>
          </View>
          <Text style={[styles.cardTitle, { color: palette.text }]}>{program.sessions[sessionIndex].title}</Text>
          <Text style={[styles.body, { color: palette.textSecondary }]}>{program.sessions[sessionIndex].objective}</Text>
          <LucidProgressBar value={active.completedExerciseIds.length / program.sessions.length} />
          <LucidButton label={copy.continue} icon="play" onPress={() => router.push(`/lucid/session/${active.technique}/${active.currentDay}`)} />
        </LucidCard>
      ) : (
        <LucidCard accent="violet">
          <View style={[styles.emptyIcon, { backgroundColor: palette.accentSoft }]}><Ionicons name="map" size={28} color={palette.accent} /></View>
          <Text style={[styles.cardTitle, { color: palette.text }]}>{content.programs.mild.title}</Text>
          <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.noProgram}</Text>
          <LucidButton label={copy.browse} icon="arrow-forward" onPress={() => router.push('/lucid/(tabs)/programs')} />
        </LucidCard>
      )}

      <View style={styles.twoColumn}>
        <LucidCard accent="cyan" style={styles.halfCard} onPress={() => router.push('/lucid/reality-check')} accessibilityLabel={copy.doCheck}>
          <Ionicons name="eye" size={25} color={palette.cyan} />
          <Text style={[styles.smallTitle, { color: palette.text }]}>{copy.reality}</Text>
          <Text style={[styles.smallBody, { color: palette.textSecondary }]}>{copy.realityBody}</Text>
          <Text style={[styles.inlineAction, { color: palette.cyan }]}>{copy.doCheck} →</Text>
        </LucidCard>
        <LucidCard accent="amber" style={styles.halfCard} onPress={() => router.push('/lucid/morning')} accessibilityLabel={copy.log}>
          <Ionicons name="sunny" size={25} color={palette.amber} />
          <Text style={[styles.smallTitle, { color: palette.text }]}>{copy.morning}</Text>
          <Text style={[styles.smallBody, { color: palette.textSecondary }]}>{copy.morningBody}</Text>
          <Text style={[styles.inlineAction, { color: palette.amber }]}>{copy.log} →</Text>
        </LucidCard>
      </View>

      <LucidSectionHeader title={copy.week} />
      <View style={styles.metrics}>
        <LucidMetric value={String(week.current.attempts)} label={copy.attempts} />
        <LucidMetric value={week.current.recallRate == null ? '—' : `${Math.round(week.current.recallRate * 100)}%`} label={copy.recall} tone="cyan" />
        <LucidMetric value={String(week.current.lucidDreams)} label={copy.lucid} tone="amber" />
      </View>

      <LucidCard accent="cyan" onPress={() => router.push('/lucid/weekly')} accessibilityLabel={copy.coach}>
        <View style={styles.cardTop}>
          <LucidPill label={copy.coach} tone="cyan" icon="sparkles" />
          <Ionicons name="arrow-forward" color={palette.textMuted} size={19} />
        </View>
        <Text style={[styles.bodyStrong, { color: palette.text }]}>{coaching}</Text>
        <Text style={[styles.smallBody, { color: palette.textSecondary }]}>{content.weeklyReview.coachingNote}</Text>
      </LucidCard>
    </LucidScreen>
  );
}

const styles = StyleSheet.create({
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sessionLabel: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 12 },
  cardTitle: { fontFamily: 'Fraunces_600SemiBold', fontSize: 23, lineHeight: 29 },
  body: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, lineHeight: 21 },
  bodyStrong: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, lineHeight: 23 },
  emptyIcon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  twoColumn: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  halfCard: { flex: 1, padding: 15 },
  smallTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, lineHeight: 20 },
  smallBody: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, lineHeight: 17 },
  inlineAction: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 12, marginTop: 'auto' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
