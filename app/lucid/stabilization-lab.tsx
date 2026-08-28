import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import {
  LucidButton,
  LucidCard,
  LucidIconAction,
  LucidMetric,
  LucidProgressBar,
  LucidScreen,
} from '@/components/lucid/LucidUI';
import { getLucidPalette, LucidSpace, LucidType } from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import { useLucidGuidedRitualSound } from '@/hooks/useLucidGuidedRitualSound';
import { useLucidStabilizationLab } from '@/hooks/useLucidStabilizationLab';
import {
  LUCID_STABILIZATION_LAB_STEP_COUNT,
  LUCID_STABILIZATION_LAB_STEPS,
  getLucidStabilizationLabCurrentStep,
  type LucidStabilizationLabSession,
  type LucidStabilizationLabStepId,
} from '@/lib/lucid/stabilizationLab';
import type { LucidStabilizationLabStorageErrorReason } from '@/services/lucidStabilizationLabStorage';

const COPY = {
  en: {
    eyebrow: 'Stabilization practice',
    title: 'Stabilization lab',
    subtitle: 'A short local rehearsal to stay calm and oriented after noticing a lucid dream.',
    close: 'Close',
    disclaimer: 'This is practice only. It does not guarantee lucidity, control, or a better night.',
    duration: 'About 4 min 30 sec',
    local: 'Saved on this device. Nothing is sent.',
    loading: 'Loading your lab…',
    retry: 'Try again',
    start: 'Start practice',
    restart: 'Practice again',
    empty: 'Start when you want. The lab never begins on its own.',
    completed: 'This practice is complete. Insights stay on this device.',
    practices: 'Practices',
    completions: 'Completions',
    repeats: 'Repeats',
    progress: (current: number, total: number) => `Step ${current} of ${total}`,
    repeatsCount: (count: number) => `${count} ${count === 1 ? 'repeat' : 'repeats'} on this step`,
    recommended: (seconds: number) => `About ${seconds} sec`,
    finishStep: 'Finish this step',
    finishLab: 'Finish the lab',
    resume: 'Resume',
    repeat: 'Repeat this step',
    pause: 'Pause',
    leave: 'Leave and resume later',
    statusPaused: 'Paused. Resume when you are ready.',
    statusInterrupted: 'Left for later. Resume when you are ready.',
    lastReady: 'Last step finished. You can finish the lab.',
    stepDone: 'Step finished.',
    labDone: 'Practice complete.',
    stepRepeated: 'Step repeated.',
    errors: {
      invalid_scope: 'This lab is not available for the current account.',
      invalid_metadata: 'This practice could not be updated.',
      persistence_failed: 'The lab could not be saved on this device. Try again.',
      storage_full: 'This device is out of storage for the lab.',
    },
    steps: {
      hands: {
        title: 'Look at your hands',
        body: 'Bring both hands into view and notice them as they are now.',
        action: 'Look at your hands until they feel steady.',
      },
      surface: {
        title: 'Touch a surface',
        body: 'Rest a hand on a nearby surface and feel the contact.',
        action: 'Touch one surface slowly.',
      },
      three_details: {
        title: 'Name three details',
        body: 'Notice three concrete details around you. Do not type or save them.',
        action: 'Name three details quietly.',
      },
      intention: {
        title: 'Set an intention',
        body: 'Choose one calm next action. The words stay with you; they are not stored.',
        action: 'Hold one short intention.',
      },
      slow_before_control: {
        title: 'Slow down before control',
        body: 'Wait before trying to change the scene. Orientation comes first.',
        action: 'Slow down before any control.',
      },
    },
  },
  fr: {
    eyebrow: 'Pratique de stabilisation',
    title: 'Laboratoire de stabilisation',
    subtitle: 'Un court exercice local pour rester calme et orienté après avoir remarqué un rêve lucide.',
    close: 'Fermer',
    disclaimer: 'Ceci est un entraînement. Il ne garantit ni lucidité, ni contrôle, ni une meilleure nuit.',
    duration: 'Environ 4 min 30 s',
    local: 'Enregistré sur cet appareil. Rien n’est envoyé.',
    loading: 'Chargement du laboratoire…',
    retry: 'Réessayer',
    start: 'Commencer la pratique',
    restart: 'Recommencer',
    empty: 'Commence quand tu veux. Le laboratoire ne démarre jamais tout seul.',
    completed: 'Cette pratique est terminée. Les Insights restent sur cet appareil.',
    practices: 'Pratiques',
    completions: 'Complétions',
    repeats: 'Répétitions',
    progress: (current: number, total: number) => `Étape ${current} sur ${total}`,
    repeatsCount: (count: number) => `${count} répétition${count > 1 ? 's' : ''} sur cette étape`,
    recommended: (seconds: number) => `Environ ${seconds} s`,
    finishStep: 'Terminer cette étape',
    finishLab: 'Terminer le laboratoire',
    resume: 'Reprendre',
    repeat: 'Répéter cette étape',
    pause: 'Pause',
    leave: 'Quitter et reprendre plus tard',
    statusPaused: 'En pause. Reprends quand tu es prêt.',
    statusInterrupted: 'Laissé pour plus tard. Reprends quand tu es prêt.',
    lastReady: 'Dernière étape terminée. Tu peux terminer le laboratoire.',
    stepDone: 'Étape terminée.',
    labDone: 'Pratique terminée.',
    stepRepeated: 'Étape répétée.',
    errors: {
      invalid_scope: 'Ce laboratoire n’est pas disponible pour le compte actuel.',
      invalid_metadata: 'Cette pratique n’a pas pu être mise à jour.',
      persistence_failed: 'Le laboratoire n’a pas pu être enregistré sur cet appareil. Réessaie.',
      storage_full: 'Cet appareil n’a plus assez d’espace pour le laboratoire.',
    },
    steps: {
      hands: {
        title: 'Regarde tes mains',
        body: 'Amène tes deux mains dans le champ de vision et observe-les telles qu’elles sont.',
        action: 'Regarde tes mains jusqu’à ce qu’elles te semblent stables.',
      },
      surface: {
        title: 'Touche une surface',
        body: 'Pose une main sur une surface proche et sens le contact.',
        action: 'Touche une surface lentement.',
      },
      three_details: {
        title: 'Nomme trois détails',
        body: 'Repère trois détails concrets autour de toi. Ne les saisis pas et ne les enregistre pas.',
        action: 'Nomme trois détails à voix basse.',
      },
      intention: {
        title: 'Pose une intention',
        body: 'Choisis une prochaine action calme. Les mots restent avec toi ; ils ne sont pas stockés.',
        action: 'Garde une intention courte.',
      },
      slow_before_control: {
        title: 'Ralentis avant de contrôler',
        body: 'Attends avant d’essayer de changer la scène. L’orientation vient d’abord.',
        action: 'Ralentis avant tout contrôle.',
      },
    },
  },
  es: {
    eyebrow: 'Práctica de estabilización',
    title: 'Laboratorio de estabilización',
    subtitle: 'Un ensayo local breve para permanecer en calma y orientado tras notar un sueño lúcido.',
    close: 'Cerrar',
    disclaimer: 'Esto es solo práctica. No garantiza lucidez, control ni una mejor noche.',
    duration: 'Unos 4 min 30 s',
    local: 'Guardado en este dispositivo. No se envía nada.',
    loading: 'Cargando el laboratorio…',
    retry: 'Reintentar',
    start: 'Empezar la práctica',
    restart: 'Practicar de nuevo',
    empty: 'Empieza cuando quieras. El laboratorio nunca comienza solo.',
    completed: 'Esta práctica está completa. Los Insights se quedan en este dispositivo.',
    practices: 'Prácticas',
    completions: 'Completadas',
    repeats: 'Repeticiones',
    progress: (current: number, total: number) => `Paso ${current} de ${total}`,
    repeatsCount: (count: number) => `${count} ${count === 1 ? 'repetición' : 'repeticiones'} en este paso`,
    recommended: (seconds: number) => `Unos ${seconds} s`,
    finishStep: 'Terminar este paso',
    finishLab: 'Terminar el laboratorio',
    resume: 'Reanudar',
    repeat: 'Repetir este paso',
    pause: 'Pausa',
    leave: 'Salir y reanudar más tarde',
    statusPaused: 'En pausa. Reanuda cuando estés listo.',
    statusInterrupted: 'Dejado para más tarde. Reanuda cuando estés listo.',
    lastReady: 'Último paso terminado. Puedes terminar el laboratorio.',
    stepDone: 'Paso terminado.',
    labDone: 'Práctica completa.',
    stepRepeated: 'Paso repetido.',
    errors: {
      invalid_scope: 'Este laboratorio no está disponible para la cuenta actual.',
      invalid_metadata: 'No se pudo actualizar esta práctica.',
      persistence_failed: 'No se pudo guardar el laboratorio en este dispositivo. Inténtalo de nuevo.',
      storage_full: 'Este dispositivo no tiene espacio para el laboratorio.',
    },
    steps: {
      hands: {
        title: 'Mira tus manos',
        body: 'Lleva ambas manos a la vista y obsérvalas tal como están ahora.',
        action: 'Mira tus manos hasta que se sientan estables.',
      },
      surface: {
        title: 'Toca una superficie',
        body: 'Apoya una mano en una superficie cercana y siente el contacto.',
        action: 'Toca una superficie despacio.',
      },
      three_details: {
        title: 'Nombra tres detalles',
        body: 'Nota tres detalles concretos a tu alrededor. No los escribas ni los guardes.',
        action: 'Nombra tres detalles en silencio.',
      },
      intention: {
        title: 'Formula una intención',
        body: 'Elige una siguiente acción calmada. Las palabras se quedan contigo; no se almacenan.',
        action: 'Mantén una intención breve.',
      },
      slow_before_control: {
        title: 'Reducir la prisa antes de controlar',
        body: 'Espera antes de intentar cambiar la escena. Primero oriéstate.',
        action: 'Reduce la prisa antes de cualquier control.',
      },
    },
  },
  de: {
    eyebrow: 'Stabilisierungsübung',
    title: 'Stabilisierungslabor',
    subtitle: 'Eine kurze lokale Übung, um nach dem Bemerken eines Klartraums ruhig und orientiert zu bleiben.',
    close: 'Schließen',
    disclaimer: 'Das ist nur Übung. Sie garantiert weder Klarheit, Kontrolle noch eine bessere Nacht.',
    duration: 'Etwa 4 Min. 30 Sek.',
    local: 'Auf diesem Gerät gespeichert. Es wird nichts gesendet.',
    loading: 'Labor wird geladen…',
    retry: 'Erneut versuchen',
    start: 'Übung starten',
    restart: 'Erneut üben',
    empty: 'Starte, wann du willst. Das Labor beginnt nie von selbst.',
    completed: 'Diese Übung ist abgeschlossen. Insights bleiben auf diesem Gerät.',
    practices: 'Übungen',
    completions: 'Abschlüsse',
    repeats: 'Wiederholungen',
    progress: (current: number, total: number) => `Schritt ${current} von ${total}`,
    repeatsCount: (count: number) => `${count} ${count === 1 ? 'Wiederholung' : 'Wiederholungen'} in diesem Schritt`,
    recommended: (seconds: number) => `Etwa ${seconds} Sek.`,
    finishStep: 'Diesen Schritt beenden',
    finishLab: 'Labor beenden',
    resume: 'Fortsetzen',
    repeat: 'Diesen Schritt wiederholen',
    pause: 'Pause',
    leave: 'Verlassen und später fortsetzen',
    statusPaused: 'Pausiert. Setze fort, wenn du bereit bist.',
    statusInterrupted: 'Für später verlassen. Setze fort, wenn du bereit bist.',
    lastReady: 'Letzter Schritt beendet. Du kannst das Labor beenden.',
    stepDone: 'Schritt beendet.',
    labDone: 'Übung abgeschlossen.',
    stepRepeated: 'Schritt wiederholt.',
    errors: {
      invalid_scope: 'Dieses Labor ist für das aktuelle Konto nicht verfügbar.',
      invalid_metadata: 'Diese Übung konnte nicht aktualisiert werden.',
      persistence_failed: 'Das Labor konnte auf diesem Gerät nicht gespeichert werden. Versuche es erneut.',
      storage_full: 'Dieses Gerät hat keinen Speicherplatz für das Labor.',
    },
    steps: {
      hands: {
        title: 'Schau auf deine Hände',
        body: 'Bringe beide Hände ins Blickfeld und nimm sie wahr, wie sie jetzt sind.',
        action: 'Schau auf deine Hände, bis sie sich ruhig anfühlen.',
      },
      surface: {
        title: 'Berühre eine Fläche',
        body: 'Lege eine Hand auf eine nahe Fläche und spüre den Kontakt.',
        action: 'Berühre eine Fläche langsam.',
      },
      three_details: {
        title: 'Nenne drei Details',
        body: 'Nimm drei konkrete Details um dich wahr. Tippe sie nicht ein und speichere sie nicht.',
        action: 'Nenne drei Details leise.',
      },
      intention: {
        title: 'Setze eine Absicht',
        body: 'Wähle eine ruhige nächste Handlung. Die Worte bleiben bei dir; sie werden nicht gespeichert.',
        action: 'Halte eine kurze Absicht.',
      },
      slow_before_control: {
        title: 'Verlangsamen vor Kontrolle',
        body: 'Warte, bevor du versuchst, die Szene zu verändern. Orientierung kommt zuerst.',
        action: 'Verlangsamen vor jeder Kontrolle.',
      },
    },
  },
  it: {
    eyebrow: 'Pratica di stabilizzazione',
    title: 'Laboratorio di stabilizzazione',
    subtitle: 'Una breve prova locale per restare calmo e orientato dopo aver notato un sogno lucido.',
    close: 'Chiudi',
    disclaimer: 'Questa è solo pratica. Non garantisce lucidità, controllo o una notte migliore.',
    duration: 'Circa 4 min 30 s',
    local: 'Salvato su questo dispositivo. Non viene inviato nulla.',
    loading: 'Caricamento del laboratorio…',
    retry: 'Riprova',
    start: 'Inizia la pratica',
    restart: 'Ripratica',
    empty: 'Inizia quando vuoi. Il laboratorio non parte mai da solo.',
    completed: 'Questa pratica è completa. Gli Insights restano su questo dispositivo.',
    practices: 'Pratiche',
    completions: 'Completamenti',
    repeats: 'Ripetizioni',
    progress: (current: number, total: number) => `Passo ${current} di ${total}`,
    repeatsCount: (count: number) => `${count} ${count === 1 ? 'ripetizione' : 'ripetizioni'} su questo passo`,
    recommended: (seconds: number) => `Circa ${seconds} s`,
    finishStep: 'Termina questo passo',
    finishLab: 'Termina il laboratorio',
    resume: 'Riprendi',
    repeat: 'Ripeti questo passo',
    pause: 'Pausa',
    leave: 'Esci e riprendi più tardi',
    statusPaused: 'In pausa. Riprendi quando sei pronto.',
    statusInterrupted: 'Lasciato per dopo. Riprendi quando sei pronto.',
    lastReady: 'Ultimo passo terminato. Puoi terminare il laboratorio.',
    stepDone: 'Passo terminato.',
    labDone: 'Pratica completa.',
    stepRepeated: 'Passo ripetuto.',
    errors: {
      invalid_scope: 'Questo laboratorio non è disponibile per l’account attuale.',
      invalid_metadata: 'Questa pratica non è stata aggiornata.',
      persistence_failed: 'Il laboratorio non è stato salvato su questo dispositivo. Riprova.',
      storage_full: 'Questo dispositivo non ha spazio per il laboratorio.',
    },
    steps: {
      hands: {
        title: 'Guarda le tue mani',
        body: 'Porta entrambe le mani in vista e osservale così come sono ora.',
        action: 'Guarda le tue mani finché non ti sembrano stabili.',
      },
      surface: {
        title: 'Tocca una superficie',
        body: 'Appoggia una mano su una superficie vicina e senti il contatto.',
        action: 'Tocca una superficie lentamente.',
      },
      three_details: {
        title: 'Nomina tre dettagli',
        body: 'Nota tre dettagli concreti intorno a te. Non scriverli e non salvarli.',
        action: 'Nomina tre dettagli a voce bassa.',
      },
      intention: {
        title: 'Formula un’intenzione',
        body: 'Scegli una prossima azione calma. Le parole restano con te; non vengono memorizzate.',
        action: 'Tieni un’intenzione breve.',
      },
      slow_before_control: {
        title: 'Rallenta prima di controllare',
        body: 'Aspetta prima di provare a cambiare la scena. Prima orientati.',
        action: 'Rallenta prima di qualsiasi controllo.',
      },
    },
  },
} as const;

type LabCopy = (typeof COPY)[keyof typeof COPY];

function isLastStepReady(session: LucidStabilizationLabSession | null): boolean {
  if (!session || session.status !== 'active') return false;
  const step = getLucidStabilizationLabCurrentStep(session);
  return session.stepIndex === session.stepCount - 1 && session.completedStepIds.includes(step.id);
}

function recommendedSeconds(stepId: LucidStabilizationLabStepId): number {
  const step = LUCID_STABILIZATION_LAB_STEPS.find((item) => item.id === stepId);
  return Math.round((step?.recommendedDurationMs ?? 0) / 1000);
}

function errorCopy(copy: LabCopy, reason: LucidStabilizationLabStorageErrorReason | null): string | null {
  if (!reason) return null;
  return copy.errors[reason];
}

async function playSuccessHaptic(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Best-effort only.
  }
}

async function playSelectionHaptic(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.selectionAsync();
  } catch {
    // Best-effort only.
  }
}

export default function LucidStabilizationLabScreen() {
  const { content, state, userScope } = useLucidTrainer();
  const { fontScale, width } = useWindowDimensions();
  const compact = width < 380 || fontScale >= 1.3;
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const copy = COPY[content.locale];
  const lab = useLucidStabilizationLab({ userScope });
  const soundEnabled = state?.preferences.audioCuesEnabled === true;
  const { playTransition } = useLucidGuidedRitualSound(soundEnabled);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const busyLockRef = useRef(false);
  const session = lab.currentSession;
  const currentStep = session ? getLucidStabilizationLabCurrentStep(session) : null;
  const lastReady = isLastStepReady(session);
  const controlsBusy = busyAction !== null || lab.isMutating;

  const playCausalFeedback = async (message: string) => {
    setStatusMessage(message);
    await Promise.all([
      playSuccessHaptic(),
      playTransition().catch(() => false),
    ]);
  };

  const runAction = async (key: string, work: () => Promise<unknown>, onSuccess?: () => Promise<void> | void) => {
    if (busyLockRef.current || lab.isMutating) return;
    busyLockRef.current = true;
    setBusyAction(key);
    try {
      await work();
      await onSuccess?.();
    } catch {
      // Storage error is already exposed by the hook.
    } finally {
      busyLockRef.current = false;
      setBusyAction(null);
    }
  };

  const loadFailed = Boolean(lab.error) && !session && !lab.isLoading;
  const primaryKey = lab.isLoading
    ? null
    : loadFailed
      ? 'retry'
      : !session || session.status === 'completed'
        ? 'start'
        : session.status === 'paused' || session.status === 'interrupted'
          ? 'resume'
          : lastReady
            ? 'complete'
            : 'advance';
  const primaryLabel =
    primaryKey === 'retry'
      ? copy.retry
      : primaryKey === 'start'
        ? lab.insights.completionCount > 0
          ? copy.restart
          : copy.start
        : primaryKey === 'resume'
          ? copy.resume
          : primaryKey === 'complete'
            ? copy.finishLab
            : primaryKey === 'advance'
              ? copy.finishStep
              : null;

  const onPrimaryPress = () => {
    if (primaryKey === 'retry') {
      void runAction('retry', () => lab.refresh());
      return;
    }
    if (primaryKey === 'start') {
      void runAction('start', async () => {
        setStatusMessage('');
        await lab.startNew();
      });
      return;
    }
    if (primaryKey === 'resume') {
      void runAction('resume', async () => {
        setStatusMessage('');
        await lab.resume();
      });
      return;
    }
    if (primaryKey === 'complete') {
      void runAction('complete', () => lab.complete(), () => playCausalFeedback(copy.labDone));
      return;
    }
    if (primaryKey === 'advance') {
      void runAction('advance', () => lab.advance(), () => playCausalFeedback(copy.stepDone));
    }
  };

  const close = async () => {
    if (session?.status === 'active') {
      await runAction('leave', async () => {
        await lab.interrupt();
        router.back();
      });
      return;
    }
    router.back();
  };

  const errorMessage = errorCopy(copy, lab.error);
  const stepCopy = currentStep ? copy.steps[currentStep.id] : null;
  const repeats = currentStep && session ? session.repeatCounts[currentStep.id] : 0;

  return (
    <LucidScreen
      eyebrow={copy.eyebrow}
      footer={
        lab.isLoading || !primaryKey || !primaryLabel ? null : (
          <View style={styles.footer}>
            <LucidButton
              disabled={controlsBusy && busyAction !== primaryKey}
              label={primaryLabel}
              loading={busyAction === primaryKey || lab.isMutating}
              onPress={onPrimaryPress}
              testID="lucid-stabilization-lab-primary"
            />
          </View>
        )
      }
      subtitle={copy.subtitle}
      testID="lucid-stabilization-lab"
      title={copy.title}
      trailing={<LucidIconAction icon="close" label={copy.close} onPress={() => void close()} />}
    >
      <LucidCard style={styles.notice}>
        <Text style={[styles.body, { color: palette.text }]}>{copy.disclaimer}</Text>
        <Text style={[styles.meta, { color: palette.textSecondary }]}>
          {copy.duration}
        </Text>
        <Text style={[styles.meta, { color: palette.textSecondary }]}>{copy.local}</Text>
      </LucidCard>

      <View
        style={[styles.metrics, compact && styles.metricsCompact]}
        testID="lucid-stabilization-lab-metrics"
      >
        <LucidMetric
          label={copy.practices}
          style={compact ? styles.metricCompact : undefined}
          value={String(lab.insights.practiceCount)}
        />
        <LucidMetric
          label={copy.completions}
          style={compact ? styles.metricCompact : undefined}
          value={String(lab.insights.completionCount)}
        />
        <LucidMetric
          label={copy.repeats}
          style={compact ? styles.metricCompact : undefined}
          value={String(lab.insights.repeatCount)}
        />
      </View>

      {lab.isLoading ? (
        <Text accessibilityLiveRegion="polite" style={[styles.body, { color: palette.textSecondary }]}>
          {copy.loading}
        </Text>
      ) : null}

      {errorMessage ? (
        <LucidCard style={styles.notice} testID="lucid-stabilization-lab-error">
          <Text style={[styles.body, { color: palette.text }]}>{errorMessage}</Text>
        </LucidCard>
      ) : null}

      {!lab.isLoading && !session ? (
        <Text style={[styles.body, { color: palette.textSecondary }]}>
          {lab.insights.completionCount > 0 ? copy.completed : copy.empty}
        </Text>
      ) : null}

      {session && currentStep && stepCopy ? (
        <LucidCard style={styles.stepCard} testID="lucid-stabilization-lab-step">
          <LucidProgressBar
            accessibilityLabel={copy.progress(session.stepIndex + 1, LUCID_STABILIZATION_LAB_STEP_COUNT)}
            value={(session.stepIndex + (lastReady ? 1 : 0)) / LUCID_STABILIZATION_LAB_STEP_COUNT}
          />
          <Text style={[styles.meta, { color: palette.textMuted }]}>
            {copy.progress(session.stepIndex + 1, LUCID_STABILIZATION_LAB_STEP_COUNT)}
          </Text>
          <Text accessibilityRole="header" style={[styles.stepTitle, { color: palette.text }]}>
            {stepCopy.title}
          </Text>
          <Text style={[styles.body, { color: palette.textSecondary }]}>{stepCopy.body}</Text>
          <Text style={[styles.body, { color: palette.text }]}>{stepCopy.action}</Text>
          <Text style={[styles.meta, { color: palette.textMuted }]}>
            {copy.recommended(recommendedSeconds(currentStep.id))} · {copy.repeatsCount(repeats)}
          </Text>
          {session.status === 'paused' ? (
            <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.statusPaused}</Text>
          ) : null}
          {session.status === 'interrupted' ? (
            <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.statusInterrupted}</Text>
          ) : null}
          {lastReady ? (
            <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.lastReady}</Text>
          ) : null}
        </LucidCard>
      ) : null}

      {session?.status === 'active' ? (
        <View style={styles.actions}>
          {!lastReady ? (
            <LucidButton
              disabled={controlsBusy}
              label={copy.repeat}
              loading={busyAction === 'repeat'}
              onPress={() =>
                void runAction('repeat', () => lab.repeat(), async () => {
                  setStatusMessage(copy.stepRepeated);
                  await playSelectionHaptic();
                })
              }
              testID="lucid-stabilization-lab-repeat"
              variant="secondary"
            />
          ) : null}
          <LucidButton
            disabled={controlsBusy}
            label={copy.pause}
            loading={busyAction === 'pause'}
            onPress={() => void runAction('pause', () => lab.pause())}
            testID="lucid-stabilization-lab-pause"
            variant="ghost"
          />
          <LucidButton
            disabled={controlsBusy}
            label={copy.leave}
            loading={busyAction === 'leave'}
            onPress={() => void close()}
            testID="lucid-stabilization-lab-leave"
            variant="ghost"
          />
        </View>
      ) : null}

      {statusMessage ? (
        <Text accessibilityLiveRegion="polite" testID="lucid-stabilization-lab-live" style={[styles.body, { color: palette.text }]}>
          {statusMessage}
        </Text>
      ) : null}
    </LucidScreen>
  );
}

const styles = StyleSheet.create({
  notice: { gap: LucidSpace.sm },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: LucidSpace.sm },
  metricsCompact: { flexDirection: 'column' },
  metricCompact: { flexBasis: '100%' },
  stepCard: { gap: LucidSpace.sm },
  actions: { gap: LucidSpace.sm },
  footer: { gap: LucidSpace.sm },
  body: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.body[0],
    lineHeight: LucidType.body[1],
  },
  meta: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
  stepTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.body[0],
    lineHeight: LucidType.body[1],
  },
});
