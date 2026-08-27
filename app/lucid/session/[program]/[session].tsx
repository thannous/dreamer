import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { LucidButton, LucidIconAction, LucidOverline, LucidPill, LucidProgressBar, LucidScreen } from '@/components/lucid/LucidUI';
import { getLucidPalette, LucidIcon, LucidRadius, LucidSpace, LucidType } from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import type { LucidTechnique } from '@/lib/lucid/model';
import { closeLucidRoute } from '@/lib/lucid/routes';
import {
  canUseLucidWbtb,
  evaluateLucidSafetyPolicyFromState,
  evaluateLucidSessionAccess,
} from '@/lib/lucid/safety';

const COPY = {
  en: { guided: 'Guided practice', step: 'Step', reflect: 'After the practice', caution: 'Keep in mind', complete: 'Complete session', done: 'Session completed', invalid: 'Session unavailable', locked: 'This session opens after the previous one. The calendar is only a suggestion.', backToProgram: 'Back to program', stepsChecked: 'Steps checked:', progress: 'Practice progress' },
  fr: { guided: 'Pratique guidée', step: 'Étape', reflect: 'Après la pratique', caution: 'À garder en tête', complete: 'Terminer la séance', done: 'Séance terminée', invalid: 'Séance indisponible', locked: "Cette séance s'ouvre après la précédente. Le calendrier n’est qu’une suggestion.", backToProgram: 'Retour au programme', stepsChecked: 'Étapes cochées :', progress: 'Progression de la pratique' },
  es: { guided: 'Práctica guiada', step: 'Paso', reflect: 'Después de la práctica', caution: 'Ten en cuenta', complete: 'Completar sesión', done: 'Sesión completada', invalid: 'Sesión no disponible', locked: 'Esta sesión se abre después de la anterior. El calendario es solo una sugerencia.', backToProgram: 'Volver al programa', stepsChecked: 'Pasos marcados:', progress: 'Progreso de la práctica' },
  de: { guided: 'Geführte Übung', step: 'Schritt', reflect: 'Nach der Übung', caution: 'Beachte', complete: 'Einheit abschließen', done: 'Einheit abgeschlossen', invalid: 'Einheit nicht verfügbar', locked: 'Diese Einheit öffnet sich nach der vorherigen. Der Kalender ist nur ein Vorschlag.', backToProgram: 'Zurück zum Programm', stepsChecked: 'Abgehakte Schritte:', progress: 'Übungsfortschritt' },
  it: { guided: 'Pratica guidata', step: 'Passaggio', reflect: 'Dopo la pratica', caution: 'Da ricordare', complete: 'Completa sessione', done: 'Sessione completata', invalid: 'Sessione non disponibile', locked: 'Questa sessione si apre dopo la precedente. Il calendario è solo un suggerimento.', backToProgram: 'Torna al programma', stepsChecked: 'Passi spuntati:', progress: 'Progresso della pratica' },
} as const;

const PROGRAM_ART: Readonly<Record<LucidTechnique, number>> = {
  mild: require('../../../../assets/images/lucid/program-mild-destination.png'),
  ssild: require('../../../../assets/images/lucid/program-ssild-destination.png'),
  wbtb: require('../../../../assets/images/lucid/program-wbtb-destination.png'),
};

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
  const programProgress = valid && isTechnique(params.program)
    ? state!.progress.find((item) => item.technique === params.program)
    : undefined;
  const access = evaluateLucidSessionAccess({
    sessionNumber,
    sessionCount: program?.sessions.length ?? 0,
    exerciseId: session?.id,
    progress: programProgress,
  });
  const safetyPolicy = evaluateLucidSafetyPolicyFromState(state);
  const wbtbBlocked =
    isTechnique(params.program) &&
    params.program === 'wbtb' &&
    !canUseLucidWbtb(safetyPolicy) &&
    access.reason !== 'completed';
  const alreadyDone = access.reason === 'completed';
  const [checked, setChecked] = useState<boolean[]>(() => session?.steps.map(() => false) ?? []);
  const [saving, setSaving] = useState(false);
  const progress = useMemo(() => checked.length ? checked.filter(Boolean).length / checked.length : 0, [checked]);
  const close = () => closeLucidRoute(router, sessionFallback(params.program));

  if (!program || !session || !isTechnique(params.program) || !access.allowed || wbtbBlocked) {
    const locked = access.reason === 'sequential_lock';
    return (
      <LucidScreen
        title={copy.invalid}
        subtitle={locked ? copy.locked : undefined}
        trailing={<LucidIconAction label={content.chrome.common.back} icon="close" onPress={close} />}
      >
        <LucidButton
          label={locked ? copy.backToProgram : content.chrome.common.back}
          onPress={close}
          testID="lucid-session-unavailable-back"
        />
      </LucidScreen>
    );
  }
  const technique = params.program;

  const finish = async () => {
    setSaving(true);
    try {
      await completeProgramSession(technique, session.id, session.session, program.sessions.length);
      // Terminer une séance est une validation rare : elle mérite le retour que
      // le corps perçoit sans regarder. Jamais seul — l'alerte reste.
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(copy.done, session.reflectionPrompt, [{ text: content.chrome.common.done, onPress: close }]);
    } finally { setSaving(false); }
  };

  const checkedCount = alreadyDone ? session.steps.length : checked.filter(Boolean).length;

  return (
    <LucidScreen
      testID="lucid-session"
      footer={
        <LucidButton
          label={alreadyDone ? copy.done : copy.complete}
          icon="checkmark-circle"
          disabled={!alreadyDone && progress < 1}
          disabledReason={`${copy.stepsChecked} ${checkedCount} / ${checked.length}`}
          loading={saving}
          onPress={() => alreadyDone ? close() : void finish()}
          testID="lucid-session-complete"
        />
      }
    >
      <View style={styles.hero}>
        <Image
          accessibilityIgnoresInvertColors
          accessible={false}
          cachePolicy="memory-disk"
          contentFit="cover"
          source={PROGRAM_ART[technique]}
          style={StyleSheet.absoluteFill}
          testID="lucid-session-art"
        />
        <LinearGradient
          colors={[`${palette.backgroundDeep}B3`, 'transparent', `${palette.backgroundDeep}8C`, palette.backgroundDeep]}
          locations={[0, 0.28, 0.55, 1]}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroContent}>
          <View style={styles.heroTopRow}>
            <LucidOverline text={`${program.title} · ${copy.guided}`} />
            <LucidIconAction label={content.chrome.common.back} icon="close" onPress={close} />
          </View>
          <View style={styles.heroCopy}>
            <View style={styles.meta}>
              <LucidPill label={`${session.durationMinutes} min`} tone="neutral" icon="time-outline" />
              <LucidPill label={`${session.session} / ${program.sessions.length}`} tone="neutral" icon="calendar-outline" />
            </View>
            <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>{session.title}</Text>
            <Text style={[styles.objective, { color: palette.textSecondary }]}>{session.objective}</Text>
          </View>
        </View>
      </View>

      <View style={styles.progressBlock}>
        <View style={styles.progressCopy}>
          <Text style={[styles.progressLabel, { color: palette.textSecondary }]}>{copy.progress}</Text>
          <Text style={[styles.progressValue, { color: palette.accent }]}>{checkedCount} / {session.steps.length}</Text>
        </View>
        <LucidProgressBar
          value={alreadyDone ? 1 : progress}
          accessibilityLabel={`${copy.progress}, ${checkedCount} / ${session.steps.length}`}
        />
      </View>

      <View accessibilityRole="list" style={[styles.steps, { borderColor: palette.border }]}>
        {session.steps.map((stepText, index) => {
          const done = alreadyDone || checked[index];
          return (
            <PressableScale
              key={`${session.id}-${index}`}
              accessibilityLabel={`${copy.step} ${index + 1}: ${stepText}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: done, disabled: alreadyDone }}
              disabled={alreadyDone}
              onPress={() => setChecked((values) => values.map((value, itemIndex) => itemIndex === index ? !value : value))}
              style={[styles.stepRow, index > 0 && { borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth }]}
              testID={`lucid-session-step-${index + 1}`}
              transitionProperties={['backgroundColor']}
            >
              <View style={[styles.check, { backgroundColor: done ? palette.accent : 'transparent', borderColor: done ? palette.accent : palette.borderInteractive }]}>
                {done ? <Ionicons name="checkmark" size={LucidIcon.sm} color={palette.backgroundDeep} /> : <Text style={[styles.checkNumber, { color: palette.textSecondary }]}>{index + 1}</Text>}
              </View>
              <Text style={[styles.stepText, { color: done ? palette.textSecondary : palette.text }]}>{stepText}</Text>
            </PressableScale>
          );
        })}
      </View>

      <View accessible accessibilityLabel={`${copy.caution}. ${session.caution}`} style={[styles.notice, { backgroundColor: palette.amberSoft }]}>
        <Ionicons accessibilityElementsHidden importantForAccessibility="no-hide-descendants" name="shield-checkmark-outline" size={LucidIcon.md} color={palette.amber} />
        <View style={styles.noticeCopy}>
          <LucidOverline text={copy.caution} tone="amber" />
          <Text style={[styles.noticeText, { color: palette.textSecondary }]}>{session.caution}</Text>
        </View>
      </View>

      {alreadyDone || progress === 1 ? (
        <View style={[styles.reflectionBlock, { borderTopColor: palette.border }]} testID="lucid-session-reflection">
          <LucidOverline text={copy.reflect} tone="accent" />
          <Text style={[styles.reflection, { color: palette.text }]}>{session.reflectionPrompt}</Text>
        </View>
      ) : null}
    </LucidScreen>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 280, borderRadius: LucidRadius.xl, overflow: 'hidden' },
  heroContent: { minHeight: 280, flex: 1, justifyContent: 'space-between', padding: LucidSpace.lg },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: LucidSpace.md },
  heroCopy: { gap: LucidSpace.sm },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: LucidSpace.xs },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: LucidType.h1[0], lineHeight: LucidType.h1[1], letterSpacing: -0.4 },
  objective: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  progressBlock: { gap: LucidSpace.sm, paddingHorizontal: LucidSpace.xs },
  progressCopy: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: LucidSpace.md },
  progressLabel: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  progressValue: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  steps: { borderWidth: StyleSheet.hairlineWidth, borderRadius: LucidRadius.xl, overflow: 'hidden' },
  stepRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: LucidSpace.md, paddingHorizontal: LucidSpace.lg, paddingVertical: LucidSpace.md },
  check: { width: 32, height: 32, borderRadius: LucidRadius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  checkNumber: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  stepText: { flex: 1, fontFamily: 'SpaceGrotesk_500Medium', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: LucidSpace.md, borderRadius: LucidRadius.lg, padding: LucidSpace.md },
  noticeCopy: { flex: 1, gap: LucidSpace.xs },
  noticeText: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  reflectionBlock: { borderTopWidth: StyleSheet.hairlineWidth, gap: LucidSpace.sm, paddingTop: LucidSpace.lg },
  reflection: { fontFamily: 'Fraunces_500Medium', fontSize: LucidType.h3[0], lineHeight: LucidType.h3[1] },
});
