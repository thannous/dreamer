import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import {
  LucidButton,
  LucidCard,
  LucidIconAction,
  LucidProgressBar,
  LucidScreen,
} from '@/components/lucid/LucidUI';
import { getLucidPalette, LucidSpace, LucidType } from '@/constants/lucidTheme';
import { useDreamsData } from '@/context/DreamsContext';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import { useLucidDreamRehearsal } from '@/hooks/useLucidDreamRehearsal';
import { useLucidGuidedRitualSound } from '@/hooks/useLucidGuidedRitualSound';
import { useLucidReducedMotion } from '@/hooks/useLucidReducedMotion';
import { useSubscription } from '@/hooks/useSubscription';
import {
  extractLucidDreamSignCandidates,
  getActiveLucidDreamSigns,
} from '@/lib/lucid/dreamSigns';
import {
  getLucidDreamRehearsalProgress,
  selectLucidDreamRehearsalScene,
  type LucidDreamRehearsalScene,
  type LucidDreamRehearsalSession,
} from '@/lib/lucid/dreamRehearsal';
import {
  canStartLucidDreamRehearsal,
  resolveLucidAdditionalDreamRehearsalAccess,
} from '@/lib/lucid/plusEntitlements';
import { closeLucidRoute } from '@/lib/lucid/routes';
import type { LucidDreamRehearsalStorageErrorReason } from '@/services/lucidDreamRehearsalStorage';

const COPY = {
  en: {
    eyebrow: 'Scene rehearsal',
    title: 'Rehearse this scene',
    subtitle: 'One chosen dream. One confirmed sign. One next action.',
    close: 'Close',
    local: 'Saved on this device. Nothing is sent.',
    loading: 'Loading this rehearsal…',
    retry: 'Try again',
    missingParams: 'Choose a dream and a confirmed sign from the atlas to start.',
    unmatched: 'This dream and this sign are not linked. Nothing else was chosen.',
    otherSession: 'Another rehearsal is already in progress. Open that exact scene to continue.',
    openCurrent: 'Open the current rehearsal',
    start: 'Start this free scene',
    startPlus: 'Start rehearsal',
    recognize: 'I recognized this sign',
    intend: 'I set the intention',
    complete: 'Finish rehearsal',
    resume: 'Resume',
    leave: 'Leave and resume later',
    statusInterrupted: 'Left for later. Resume when you are ready.',
    statusCompleted: 'This rehearsal is complete. Only a local record was kept.',
    gateTitle: 'You already rehearsed a free scene',
    gateBody: 'The first immersive rehearsal stays complete and local. Extra rehearsals use the same Noctalia Plus entitlement.',
    gateUpgrade: 'See Noctalia Plus',
    gateEscape: 'Not now',
    checkingTitle: 'Checking Plus on this account',
    checkingBody: 'No purchase is assumed while the store status is unknown. You can check again or keep every free tool.',
    checkStatus: 'Check subscription status',
    continueFree: 'Continue free',
    preview: 'Scene',
    emptyScene: 'No title or excerpt was saved for this dream.',
    truncated: 'Excerpt shortened',
    recognizeHint: 'Look for this exact sign in the scene. Do not invent another one.',
    intendHint: 'Hold one lucid intention quietly. The words stay with you and are not stored.',
    progress: (current: number, total: number) => `Step ${current} of ${total}`,
    recognized: 'Sign recognized.',
    intended: 'Intention set.',
    done: 'Rehearsal complete.',
    errors: {
      invalid_scope: 'This rehearsal is not available for the current account.',
      invalid_metadata: 'This rehearsal could not be updated.',
      persistence_failed: 'The rehearsal could not be saved on this device. Try again.',
      storage_full: 'This device is out of storage for the rehearsal.',
    },
  },
  fr: {
    eyebrow: 'Répétition de scène',
    title: 'Répéter cette scène',
    subtitle: 'Un rêve choisi. Un signe confirmé. Une seule prochaine action.',
    close: 'Fermer',
    local: 'Enregistré sur cet appareil. Rien n’est envoyé.',
    loading: 'Chargement de cette répétition…',
    retry: 'Réessayer',
    missingParams: 'Choisis un rêve et un signe confirmé depuis l’atlas pour commencer.',
    unmatched: 'Ce rêve et ce signe ne sont pas liés. Rien d’autre n’a été choisi.',
    otherSession: 'Une autre répétition est déjà en cours. Ouvre exactement cette scène pour continuer.',
    openCurrent: 'Ouvrir la répétition en cours',
    start: 'Commencer la scène gratuite',
    startPlus: 'Commencer la répétition',
    recognize: 'J’ai reconnu ce signe',
    intend: 'J’ai posé l’intention',
    complete: 'Terminer la répétition',
    resume: 'Reprendre',
    leave: 'Quitter et reprendre plus tard',
    statusInterrupted: 'Laissé pour plus tard. Reprends quand tu es prêt.',
    statusCompleted: 'Cette répétition est terminée. Seul un enregistrement local a été conservé.',
    gateTitle: 'Tu as déjà répété une scène gratuite',
    gateBody: 'La première répétition immersive reste complète et locale. Les répétitions suivantes utilisent le même droit Noctalia Plus.',
    gateUpgrade: 'Voir Noctalia Plus',
    gateEscape: 'Pas maintenant',
    checkingTitle: 'Vérification de Plus sur ce compte',
    checkingBody: 'Aucun achat n’est supposé tant que le statut boutique est inconnu. Tu peux revérifier ou garder tous les outils gratuits.',
    checkStatus: 'Vérifier l’abonnement',
    continueFree: 'Continuer gratuitement',
    preview: 'Scène',
    emptyScene: 'Aucun titre ni extrait n’a été enregistré pour ce rêve.',
    truncated: 'Extrait raccourci',
    recognizeHint: 'Cherche exactement ce signe dans la scène. N’en invente pas un autre.',
    intendHint: 'Garde une intention lucide en silence. Les mots restent avec toi et ne sont pas stockés.',
    progress: (current: number, total: number) => `Étape ${current} sur ${total}`,
    recognized: 'Signe reconnu.',
    intended: 'Intention posée.',
    done: 'Répétition terminée.',
    errors: {
      invalid_scope: 'Cette répétition n’est pas disponible pour le compte actuel.',
      invalid_metadata: 'Cette répétition n’a pas pu être mise à jour.',
      persistence_failed: 'La répétition n’a pas pu être enregistrée sur cet appareil. Réessaie.',
      storage_full: 'Cet appareil n’a plus assez d’espace pour la répétition.',
    },
  },
  es: {
    eyebrow: 'Ensayo de escena',
    title: 'Repetir esta escena',
    subtitle: 'Un sueño elegido. Una señal confirmada. Una sola siguiente acción.',
    close: 'Cerrar',
    local: 'Guardado en este dispositivo. No se envía nada.',
    loading: 'Cargando este ensayo…',
    retry: 'Reintentar',
    missingParams: 'Elige un sueño y una señal confirmada en el atlas para empezar.',
    unmatched: 'Este sueño y esta señal no están vinculados. No se eligió nada más.',
    otherSession: 'Ya hay otro ensayo en curso. Abre exactamente esa escena para continuar.',
    openCurrent: 'Abrir el ensayo en curso',
    start: 'Empezar la escena gratuita',
    startPlus: 'Empezar el ensayo',
    recognize: 'Reconocí esta señal',
    intend: 'Formulé la intención',
    complete: 'Terminar el ensayo',
    resume: 'Reanudar',
    leave: 'Salir y reanudar más tarde',
    statusInterrupted: 'Dejado para más tarde. Reanuda cuando estés listo.',
    statusCompleted: 'Este ensayo está completo. Solo se guardó un registro local.',
    gateTitle: 'Ya ensayaste una escena gratuita',
    gateBody: 'El primer ensayo inmersivo sigue completo y local. Los ensayos extra usan el mismo derecho de Noctalia Plus.',
    gateUpgrade: 'Ver Noctalia Plus',
    gateEscape: 'Ahora no',
    checkingTitle: 'Comprobando Plus en esta cuenta',
    checkingBody: 'No se presupone ninguna compra mientras el estado de la tienda sea desconocido. Puedes comprobarlo de nuevo o seguir con lo gratuito.',
    checkStatus: 'Comprobar la suscripción',
    continueFree: 'Seguir gratis',
    preview: 'Escena',
    emptyScene: 'No se guardó título ni extracto para este sueño.',
    truncated: 'Extracto acortado',
    recognizeHint: 'Busca exactamente esta señal en la escena. No inventes otra.',
    intendHint: 'Mantén una intención lúcida en silencio. Las palabras se quedan contigo y no se almacenan.',
    progress: (current: number, total: number) => `Paso ${current} de ${total}`,
    recognized: 'Señal reconocida.',
    intended: 'Intención formulada.',
    done: 'Ensayo completo.',
    errors: {
      invalid_scope: 'Este ensayo no está disponible para la cuenta actual.',
      invalid_metadata: 'No se pudo actualizar este ensayo.',
      persistence_failed: 'No se pudo guardar el ensayo en este dispositivo. Inténtalo de nuevo.',
      storage_full: 'Este dispositivo no tiene espacio para el ensayo.',
    },
  },
  de: {
    eyebrow: 'Szenenprobe',
    title: 'Diese Szene wiederholen',
    subtitle: 'Ein gewählter Traum. Ein bestätigtes Zeichen. Eine nächste Handlung.',
    close: 'Schließen',
    local: 'Auf diesem Gerät gespeichert. Nichts wird gesendet.',
    loading: 'Diese Probe wird geladen…',
    retry: 'Erneut versuchen',
    missingParams: 'Wähle im Atlas einen Traum und ein bestätigtes Zeichen, um zu starten.',
    unmatched: 'Dieser Traum und dieses Zeichen sind nicht verknüpft. Es wurde nichts anderes gewählt.',
    otherSession: 'Eine andere Probe läuft bereits. Öffne genau diese Szene, um fortzufahren.',
    openCurrent: 'Aktuelle Probe öffnen',
    start: 'Kostenlose Szene starten',
    startPlus: 'Probe starten',
    recognize: 'Ich habe dieses Zeichen erkannt',
    intend: 'Ich habe die Absicht gesetzt',
    complete: 'Probe beenden',
    resume: 'Fortsetzen',
    leave: 'Verlassen und später fortsetzen',
    statusInterrupted: 'Für später belassen. Setze fort, wenn du bereit bist.',
    statusCompleted: 'Diese Probe ist abgeschlossen. Es wurde nur ein lokaler Eintrag behalten.',
    gateTitle: 'Du hast bereits eine kostenlose Szene geprobt',
    gateBody: 'Die erste immersive Probe bleibt vollständig und lokal. Weitere Proben nutzen denselben Noctalia-Plus-Anspruch.',
    gateUpgrade: 'Noctalia Plus ansehen',
    gateEscape: 'Nicht jetzt',
    checkingTitle: 'Plus wird für dieses Konto geprüft',
    checkingBody: 'Solange der Store-Status unbekannt ist, wird kein Kauf angenommen. Du kannst erneut prüfen oder alle kostenlosen Werkzeuge behalten.',
    checkStatus: 'Abostatus prüfen',
    continueFree: 'Kostenlos fortfahren',
    preview: 'Szene',
    emptyScene: 'Für diesen Traum wurden weder Titel noch Auszug gespeichert.',
    truncated: 'Auszug gekürzt',
    recognizeHint: 'Suche genau dieses Zeichen in der Szene. Erfinde kein anderes.',
    intendHint: 'Halte eine luzide Absicht still. Die Worte bleiben bei dir und werden nicht gespeichert.',
    progress: (current: number, total: number) => `Schritt ${current} von ${total}`,
    recognized: 'Zeichen erkannt.',
    intended: 'Absicht gesetzt.',
    done: 'Probe abgeschlossen.',
    errors: {
      invalid_scope: 'Diese Probe ist für das aktuelle Konto nicht verfügbar.',
      invalid_metadata: 'Diese Probe konnte nicht aktualisiert werden.',
      persistence_failed: 'Die Probe konnte auf diesem Gerät nicht gespeichert werden. Versuche es erneut.',
      storage_full: 'Auf diesem Gerät ist kein Speicher mehr für die Probe.',
    },
  },
  it: {
    eyebrow: 'Ripetizione della scena',
    title: 'Ripeti questa scena',
    subtitle: 'Un sogno scelto. Un segno confermato. Una sola prossima azione.',
    close: 'Chiudi',
    local: 'Salvato su questo dispositivo. Non viene inviato nulla.',
    loading: 'Caricamento di questa ripetizione…',
    retry: 'Riprova',
    missingParams: 'Scegli un sogno e un segno confermato dall’atlante per iniziare.',
    unmatched: 'Questo sogno e questo segno non sono collegati. Non è stato scelto nient’altro.',
    otherSession: 'Un’altra ripetizione è già in corso. Apri esattamente quella scena per continuare.',
    openCurrent: 'Apri la ripetizione in corso',
    start: 'Inizia la scena gratuita',
    startPlus: 'Inizia la ripetizione',
    recognize: 'Ho riconosciuto questo segno',
    intend: 'Ho posto l’intenzione',
    complete: 'Termina la ripetizione',
    resume: 'Riprendi',
    leave: 'Esci e riprendi più tardi',
    statusInterrupted: 'Lasciata per dopo. Riprendi quando sei pronto.',
    statusCompleted: 'Questa ripetizione è completa. È stato conservato solo un record locale.',
    gateTitle: 'Hai già ripetuto una scena gratuita',
    gateBody: 'La prima ripetizione immersiva resta completa e locale. Le ripetizioni successive usano lo stesso diritto Noctalia Plus.',
    gateUpgrade: 'Vedi Noctalia Plus',
    gateEscape: 'Non ora',
    checkingTitle: 'Verifica di Plus su questo account',
    checkingBody: 'Nessun acquisto è presupposto finché lo stato dello store è sconosciuto. Puoi verificare di nuovo o tenere tutti gli strumenti gratuiti.',
    checkStatus: 'Verifica abbonamento',
    continueFree: 'Continua gratis',
    preview: 'Scena',
    emptyScene: 'Per questo sogno non è stato salvato né titolo né estratto.',
    truncated: 'Estratto accorciato',
    recognizeHint: 'Cerca esattamente questo segno nella scena. Non inventarne un altro.',
    intendHint: 'Tieni un’intenzione lucida in silenzio. Le parole restano con te e non vengono salvate.',
    progress: (current: number, total: number) => `Passo ${current} di ${total}`,
    recognized: 'Segno riconosciuto.',
    intended: 'Intenzione posta.',
    done: 'Ripetizione completa.',
    errors: {
      invalid_scope: 'Questa ripetizione non è disponibile per l’account attuale.',
      invalid_metadata: 'Questa ripetizione non è stata aggiornata.',
      persistence_failed: 'La ripetizione non è stata salvata su questo dispositivo. Riprova.',
      storage_full: 'Questo dispositivo non ha spazio per la ripetizione.',
    },
  },
} as const;

type RehearsalCopy = (typeof COPY)[keyof typeof COPY];

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function errorCopy(
  copy: RehearsalCopy,
  reason: LucidDreamRehearsalStorageErrorReason | null
): string | null {
  if (!reason) return null;
  return copy.errors[reason];
}

function matchesScene(session: LucidDreamRehearsalSession, scene: LucidDreamRehearsalScene): boolean {
  return session.dreamId === scene.dreamId && session.signId === scene.signId;
}

async function playRecognitionHaptic(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.selectionAsync();
  } catch {
    // Best-effort only.
  }
}

export default function LucidDreamRehearsalScreen() {
  const params = useLocalSearchParams<{ dreamId?: string | string[]; signId?: string | string[] }>();
  const dreamId = firstParam(params.dreamId);
  const signId = firstParam(params.signId);
  const { dreams, loaded } = useDreamsData();
  const { content, state, userScope, dreamSignCandidates } = useLucidTrainer();
  const { fontScale, width } = useWindowDimensions();
  const compact = width < 380 || fontScale >= 1.3;
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const reduceMotion = useLucidReducedMotion();
  const copy = COPY[content.locale];
  const rehearsal = useLucidDreamRehearsal({ userScope });
  const subscription = useSubscription();
  const soundEnabled = state?.preferences.audioCuesEnabled === true;
  const { playTransition } = useLucidGuidedRitualSound(soundEnabled);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const busyLockRef = useRef(false);

  const confirmedSigns = useMemo(() => {
    const candidates = dreamSignCandidates.length
      ? dreamSignCandidates
      : extractLucidDreamSignCandidates(dreams);
    return getActiveLucidDreamSigns(candidates, state?.dreamSignDecisions ?? []);
  }, [dreamSignCandidates, dreams, state?.dreamSignDecisions]);

  const selection = useMemo(() => {
    if (!dreamId || !signId) return { status: 'missing' as const };
    const result = selectLucidDreamRehearsalScene(dreams, confirmedSigns, dreamId, signId);
    if (result.status !== 'ready') return { status: 'unmatched' as const };
    return result;
  }, [confirmedSigns, dreamId, dreams, signId]);

  const scene = selection.status === 'ready' ? selection.scene : null;
  const session = rehearsal.currentSession;
  const currentForScene = scene && session && matchesScene(session, scene) ? session : null;
  const conflictingSession =
    scene && session && session.status !== 'completed' && !matchesScene(session, scene)
      ? session
      : null;
  const progress = currentForScene ? getLucidDreamRehearsalProgress(currentForScene) : null;
  const progressStep = progress
    ? Math.min(progress.completedActionCount + 1, progress.totalActionCount)
    : null;
  const presentation = reduceMotion ? 'static' : 'motion';
  const controlsBusy = busyAction !== null || rehearsal.isMutating;
  const loading = !loaded || rehearsal.isLoading;
  const rehearsalAccess = resolveLucidAdditionalDreamRehearsalAccess({
    subscriptionStatus: subscription.status,
    loading: subscription.loading,
    requiresAuth: subscription.requiresAuth,
    completionCount: rehearsal.completions.length,
    currentSession: currentForScene,
  });
  const canStartRehearsal = canStartLucidDreamRehearsal(rehearsalAccess);

  const playRecognitionFeedback = async (message: string) => {
    setStatusMessage(message);
    await Promise.all([
      playRecognitionHaptic(),
      playTransition().catch(() => false),
    ]);
  };

  const runAction = async (
    key: string,
    work: () => Promise<unknown>,
    onSuccess?: () => Promise<void> | void
  ) => {
    if (busyLockRef.current || rehearsal.isMutating) return;
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

  const primaryKey = loading
    ? null
    : selection.status !== 'ready'
      ? rehearsal.error
        ? 'retry'
        : null
      : rehearsal.error && !currentForScene && !conflictingSession
        ? 'retry'
      : conflictingSession
        ? 'open-current'
      : !currentForScene || currentForScene.status === 'completed'
        ? rehearsalAccess.status === 'upgrade_required'
          ? 'upgrade'
          : rehearsalAccess.status === 'checking'
            ? 'check'
            : 'start'
        : currentForScene.status === 'interrupted'
          ? 'resume'
          : currentForScene.recognizedAt == null
            ? 'recognize'
            : currentForScene.intentionConfirmedAt == null
              ? 'intend'
              : 'complete';

  const primaryLabel =
    primaryKey === 'retry'
      ? copy.retry
      : primaryKey === 'open-current'
        ? copy.openCurrent
      : primaryKey === 'upgrade'
        ? copy.gateUpgrade
        : primaryKey === 'check'
          ? copy.checkStatus
      : primaryKey === 'start'
        ? rehearsalAccess.status === 'allowed' && rehearsalAccess.reason === 'plus'
          ? copy.startPlus
          : copy.start
        : primaryKey === 'resume'
          ? copy.resume
          : primaryKey === 'recognize'
            ? copy.recognize
            : primaryKey === 'intend'
              ? copy.intend
              : primaryKey === 'complete'
                ? copy.complete
                : null;

  const onPrimaryPress = () => {
    if (primaryKey === 'retry') {
      void runAction('retry', () => rehearsal.refresh());
      return;
    }
    if (primaryKey === 'open-current' && conflictingSession) {
      router.replace(
        `/lucid/dream-rehearsal?dreamId=${encodeURIComponent(conflictingSession.dreamId)}&signId=${encodeURIComponent(conflictingSession.signId)}` as Href
      );
      return;
    }
    if (primaryKey === 'upgrade') {
      router.push('/lucid/subscription?source=dream_rehearsal' as Href);
      return;
    }
    if (primaryKey === 'check') {
      void runAction('check', async () => {
        await subscription.refreshSubscription();
      });
      return;
    }
    if (!scene) return;
    if (primaryKey === 'start') {
      if (!canStartRehearsal) return;
      void runAction('start', async () => {
        setStatusMessage('');
        await rehearsal.start(scene, { kind: 'atlas' }, presentation);
      });
      return;
    }
    if (primaryKey === 'resume') {
      void runAction('resume', async () => {
        setStatusMessage('');
        await rehearsal.resume();
      });
      return;
    }
    if (primaryKey === 'recognize') {
      void runAction(
        'recognize',
        () => rehearsal.recognize(scene.signId),
        () => playRecognitionFeedback(copy.recognized)
      );
      return;
    }
    if (primaryKey === 'intend') {
      void runAction('intend', () => rehearsal.confirmIntention(), () => {
        setStatusMessage(copy.intended);
      });
      return;
    }
    if (primaryKey === 'complete') {
      void runAction('complete', () => rehearsal.complete(), () => {
        setStatusMessage(copy.done);
      });
    }
  };

  const close = async () => {
    if (currentForScene?.status === 'active') {
      await runAction('leave', async () => {
        await rehearsal.interrupt();
        closeLucidRoute(router, '/lucid/dream-atlas');
      });
      return;
    }
    closeLucidRoute(router, '/lucid/dream-atlas');
  };

  const errorMessage = errorCopy(copy, rehearsal.error);
  const selectionMessage =
    selection.status === 'missing'
      ? copy.missingParams
      : selection.status === 'unmatched'
        ? copy.unmatched
        : conflictingSession
          ? copy.otherSession
        : null;

  return (
    <LucidScreen
      eyebrow={copy.eyebrow}
      footer={
        loading || !primaryKey || !primaryLabel ? null : (
          <View style={styles.footer}>
            <LucidButton
              disabled={controlsBusy && busyAction !== primaryKey}
              label={primaryLabel}
              loading={busyAction === primaryKey || rehearsal.isMutating}
              onPress={onPrimaryPress}
              testID="lucid-dream-rehearsal-primary"
            />
          </View>
        )
      }
      subtitle={copy.subtitle}
      testID="lucid-dream-rehearsal"
      title={copy.title}
      trailing={<LucidIconAction icon="close" label={copy.close} onPress={() => void close()} />}
    >
      <LucidCard style={compact ? { ...styles.notice, ...styles.noticeCompact } : styles.notice} testID={compact ? "lucid-dream-rehearsal-notice-compact" : "lucid-dream-rehearsal-notice"}>
        <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.local}</Text>
      </LucidCard>

      {loading ? (
        <Text accessibilityLiveRegion="polite" style={[styles.body, { color: palette.textSecondary }]}>
          {copy.loading}
        </Text>
      ) : null}

      {selectionMessage ? (
        <LucidCard style={styles.notice} testID="lucid-dream-rehearsal-selection-error">
          <Text style={[styles.body, { color: palette.text }]}>{selectionMessage}</Text>
        </LucidCard>
      ) : null}

      {errorMessage ? (
        <LucidCard style={styles.notice} testID="lucid-dream-rehearsal-error">
          <Text style={[styles.body, { color: palette.text }]}>{errorMessage}</Text>
        </LucidCard>
      ) : null}

      {scene ? (
        <LucidCard style={compact ? { ...styles.sceneCard, ...styles.sceneCardCompact } : styles.sceneCard} testID={compact ? "lucid-dream-rehearsal-scene-compact" : "lucid-dream-rehearsal-scene"}>
          <Text style={[styles.label, { color: palette.textMuted }]}>{copy.preview}</Text>
          <Text accessibilityRole="header" style={[styles.sceneTitle, { color: palette.text }]}>
            {scene.title || copy.emptyScene}
          </Text>
          {scene.excerpt ? (
            <Text style={[styles.body, { color: palette.textSecondary }]}>{scene.excerpt}</Text>
          ) : (
            <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.emptyScene}</Text>
          )}
          {scene.excerptTruncated ? (
            <Text style={[styles.meta, { color: palette.textMuted }]}>{copy.truncated}</Text>
          ) : null}
          <Text style={[styles.body, { color: palette.text }]}>{scene.signLabel}</Text>
          <Text style={[styles.meta, { color: palette.textMuted }]}>{scene.category ?? '—'}</Text>
        </LucidCard>
      ) : null}

      {!loading && scene && !conflictingSession && rehearsalAccess.status === 'upgrade_required' ? (
        <LucidCard style={styles.notice} testID="lucid-dream-rehearsal-gate">
          <Text style={[styles.sceneTitle, { color: palette.text }]}>{copy.gateTitle}</Text>
          <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.gateBody}</Text>
          <LucidButton
            label={copy.gateEscape}
            onPress={() => closeLucidRoute(router, '/lucid/dream-atlas')}
            testID="lucid-dream-rehearsal-continue-free"
            variant="secondary"
          />
        </LucidCard>
      ) : null}

      {!loading && scene && !conflictingSession && rehearsalAccess.status === 'checking' ? (
        <LucidCard style={styles.notice} testID="lucid-dream-rehearsal-checking">
          <Text style={[styles.sceneTitle, { color: palette.text }]}>{copy.checkingTitle}</Text>
          <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.checkingBody}</Text>
          <LucidButton
            label={copy.continueFree}
            onPress={() => closeLucidRoute(router, '/lucid/dream-atlas')}
            testID="lucid-dream-rehearsal-continue-free"
            variant="secondary"
          />
        </LucidCard>
      ) : null}

      {currentForScene && progress ? (
        <LucidCard style={styles.stepCard} testID="lucid-dream-rehearsal-step">
          <LucidProgressBar
            accessibilityLabel={copy.progress(progressStep ?? progress.totalActionCount, progress.totalActionCount)}
            value={progress.completedActionCount / progress.totalActionCount}
          />
          <Text style={[styles.meta, { color: palette.textMuted }]}>
            {copy.progress(progressStep ?? progress.totalActionCount, progress.totalActionCount)}
          </Text>
          {currentForScene.recognizedAt == null ? (
            <Text style={[styles.body, { color: palette.text }]}>{copy.recognizeHint}</Text>
          ) : currentForScene.intentionConfirmedAt == null ? (
            <Text style={[styles.body, { color: palette.text }]}>{copy.intendHint}</Text>
          ) : currentForScene.status === 'completed' ? (
            <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.statusCompleted}</Text>
          ) : (
            <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.done}</Text>
          )}
          {currentForScene.status === 'interrupted' ? (
            <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.statusInterrupted}</Text>
          ) : null}
        </LucidCard>
      ) : null}

      <Text accessibilityLiveRegion="polite" style={styles.srOnly}>
        {statusMessage}
      </Text>
    </LucidScreen>
  );
}

const styles = StyleSheet.create({
  notice: { gap: LucidSpace.sm, marginBottom: LucidSpace.md },
  noticeCompact: { marginBottom: LucidSpace.sm },
  body: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.body[0],
    lineHeight: LucidType.body[1],
  },
  label: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
    textTransform: 'uppercase',
  },
  meta: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
  sceneCard: { gap: LucidSpace.sm, marginBottom: LucidSpace.md },
  sceneCardCompact: { marginBottom: LucidSpace.sm },
  sceneTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.h3[0],
    lineHeight: LucidType.h3[1],
  },
  stepCard: { gap: LucidSpace.sm, marginBottom: LucidSpace.md },
  footer: { gap: LucidSpace.sm },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
});
