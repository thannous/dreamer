import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { LucidButton, LucidCard, LucidIconAction, LucidPill, LucidProgressBar, LucidScreen } from '@/components/lucid/LucidUI';
import { getLucidPalette } from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import type { LucidTechnique } from '@/lib/lucid/model';
import { closeLucidRoute } from '@/lib/lucid/routes';

const COPY = {
  en: { guided: 'Guided practice', step: 'Step', reflect: 'Reflection', caution: 'Keep in mind', complete: 'Complete session', done: 'Session completed', invalid: 'Session unavailable', stepsChecked: 'Steps checked:' },
  fr: { guided: 'Pratique guidée', step: 'Étape', reflect: 'Réflexion', caution: 'À garder en tête', complete: 'Terminer la séance', done: 'Séance terminée', invalid: 'Séance indisponible', stepsChecked: 'Étapes cochées :' },
  es: { guided: 'Práctica guiada', step: 'Paso', reflect: 'Reflexión', caution: 'Ten en cuenta', complete: 'Completar sesión', done: 'Sesión completada', invalid: 'Sesión no disponible', stepsChecked: 'Pasos marcados:' },
  de: { guided: 'Geführte Übung', step: 'Schritt', reflect: 'Reflexion', caution: 'Beachte', complete: 'Einheit abschließen', done: 'Einheit abgeschlossen', invalid: 'Einheit nicht verfügbar', stepsChecked: 'Abgehakte Schritte:' },
  it: { guided: 'Pratica guidata', step: 'Passaggio', reflect: 'Riflessione', caution: 'Da ricordare', complete: 'Completa sessione', done: 'Sessione completata', invalid: 'Sessione non disponibile', stepsChecked: 'Passi spuntati:' },
} as const;

function isTechnique(value: string | string[] | undefined): value is LucidTechnique {
  return value === 'mild' || value === 'ssild' || value === 'wbtb';
}

function sessionFallback(program: string | string[] | undefined): Href {
  return isTechnique(program) ? `/lucid/program/${program}` : '/lucid/(tabs)/programs';
}

export default function LucidSessionScreen() {
  const params = useLocalSearchParams<{ program: string; session: string }>();
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { state, content, completeProgramSession } = useLucidTrainer();
  const copy = COPY[content.locale];
  const sessionNumber = Number(params.session);
  const valid = isTechnique(params.program) && Number.isInteger(sessionNumber) && sessionNumber >= 1 && sessionNumber <= content.programs[params.program].sessions.length;
  const program = valid && isTechnique(params.program) ? content.programs[params.program] : null;
  const session = program?.sessions[sessionNumber - 1];
  const alreadyDone = !!session && state!.progress.find((item) => item.technique === params.program)?.completedExerciseIds.includes(session.id);
  const [checked, setChecked] = useState<boolean[]>(() => session?.steps.map(() => false) ?? []);
  const [saving, setSaving] = useState(false);
  const progress = useMemo(() => checked.length ? checked.filter(Boolean).length / checked.length : 0, [checked]);
  const close = () => closeLucidRoute(router, sessionFallback(params.program));

  if (!program || !session || !isTechnique(params.program)) {
    return (
      <LucidScreen
        title={copy.invalid}
        trailing={<LucidIconAction label={content.chrome.common.back} icon="close" onPress={close} />}
      >
        <LucidButton label={content.chrome.common.back} onPress={close} />
      </LucidScreen>
    );
  }
  const technique = params.program;

  const finish = async () => {
    setSaving(true);
    try {
      await completeProgramSession(technique, session.id, program.sessions.length);
      Alert.alert(copy.done, session.reflectionPrompt, [{ text: content.chrome.common.done, onPress: close }]);
    } finally { setSaving(false); }
  };

  return (
    <LucidScreen eyebrow={`${program.title} · ${copy.guided}`} title={session.title} subtitle={session.objective} trailing={<LucidIconAction label={content.chrome.common.back} icon="close" onPress={close} />}>
      <View style={styles.meta}><LucidPill label={`${session.durationMinutes} min`} tone="cyan" icon="time" /><LucidPill label={`${session.session} / ${program.sessions.length}`} tone="violet" icon="calendar" /></View>
      <LucidProgressBar value={alreadyDone ? 1 : progress} accessibilityLabel={session.title} />

      {session.steps.map((stepText, index) => {
        const done = alreadyDone || checked[index];
        return (
          <LucidCard key={`${session.id}-${index}`} accent={done ? 'cyan' : 'none'} onPress={() => !alreadyDone && setChecked((values) => values.map((value, itemIndex) => itemIndex === index ? !value : value))} accessibilityLabel={`${copy.step} ${index + 1}: ${stepText}`}>
            <View style={styles.stepRow}>
              <View style={[styles.check, { backgroundColor: done ? palette.cyan : palette.surfaceRaised, borderColor: done ? palette.cyan : palette.borderInteractive }]}>{done ? <Ionicons name="checkmark" size={18} color={palette.backgroundDeep} /> : <Text style={[styles.checkNumber, { color: palette.textSecondary }]}>{index + 1}</Text>}</View>
              <View style={styles.stepCopy}><Text style={[styles.stepLabel, { color: palette.textMuted }]}>{copy.step} {index + 1}</Text><Text style={[styles.stepText, { color: palette.text }]}>{stepText}</Text></View>
            </View>
          </LucidCard>
        );
      })}

      <LucidCard accent="amber"><View style={styles.notice}><Ionicons name="shield-checkmark" size={23} color={palette.amber} /><View style={styles.noticeCopy}><Text style={[styles.noticeLabel, { color: palette.amber }]}>{copy.caution}</Text><Text style={[styles.noticeText, { color: palette.textSecondary }]}>{session.caution}</Text></View></View></LucidCard>
      <LucidCard><Text style={[styles.noticeLabel, { color: palette.accent }]}>{copy.reflect}</Text><Text style={[styles.reflection, { color: palette.text }]}>{session.reflectionPrompt}</Text></LucidCard>
      <LucidButton label={alreadyDone ? copy.done : copy.complete} icon="checkmark-circle" disabled={!alreadyDone && progress < 1} disabledReason={`${copy.stepsChecked} ${checked.filter(Boolean).length} / ${checked.length}`} loading={saving} onPress={() => alreadyDone ? close() : void finish()} testID="lucid-session-complete" />
    </LucidScreen>
  );
}

const styles = StyleSheet.create({
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
  check: { width: 38, height: 38, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  checkNumber: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13 },
  stepCopy: { flex: 1, gap: 4 },
  stepLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' },
  stepText: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 15, lineHeight: 22 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  noticeCopy: { flex: 1, gap: 4 },
  noticeLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  noticeText: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, lineHeight: 19 },
  reflection: { fontFamily: 'Fraunces_500Medium', fontSize: 18, lineHeight: 25 },
});
