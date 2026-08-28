import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type AppStateStatus,
} from 'react-native';

import {
  LucidButton,
  LucidCard,
  LucidIconAction,
  LucidProgressBar,
  LucidScreen,
} from '@/components/lucid/LucidUI';
import { getLucidPalette, LucidRadius, LucidSpace, LucidType } from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import { useLucidGuidedRitualSound } from '@/hooks/useLucidGuidedRitualSound';
import { useLucidReducedMotion } from '@/hooks/useLucidReducedMotion';
import { useLucidSsildSensoryLab } from '@/hooks/useLucidSsildSensoryLab';
import { createLucidGuidedRitualPlan } from '@/lib/lucid/guidedRitual';
import { evaluateLucidSafetyPolicyFromState } from '@/lib/lucid/safety';
import type {
  LucidSsildSensoryFocus,
  LucidSsildSensoryLabSession,
  LucidSsildSensoryPhase,
  LucidSsildSensoryVisualState,
} from '@/lib/lucid/ssildSensoryLab';
import type { LucidSsildSensoryLabStorageErrorReason } from '@/services/lucidSsildSensoryLabStorage';

const TICK_MS = 1_000;

const COPY = {
  en: {
    eyebrow: 'SSILD practice',
    title: 'SSILD sensory lab',
    subtitle: 'Notice sight, then sound, then the body. Sleep stays first.',
    close: 'Close',
    disclaimer:
      'This is a local sensory rehearsal. It does not guarantee lucidity and never overrides sleep protection.',
    local: 'Saved on this device. Nothing is sent.',
    loading: 'Loading your lab…',
    retry: 'Try again',
    start: 'Start practice',
    restart: 'Practice again',
    resume: 'Resume',
    pause: 'Pause',
    leave: 'Leave without completing',
    empty: 'Start when you want. The lab never begins on its own.',
    durationFull: 'About 5 min',
    durationReduced: 'About 3 min',
    silent: 'Silent. Text and the current sense are enough.',
    soundReady: 'A quiet cue can mark a change of sense. Text still leads.',
    recoveryTitle: 'Protect sleep instead',
    recoveryBody:
      'Safety recovery is active, so this lab stays closed. Rest comes before SSILD tonight.',
    recoveryAction: 'Back to programs',
    fullPlan: 'Full 5-minute cycle',
    reducedPlan: 'Shortened to protect sleep',
    statusPaused: 'Paused. Resume when you are ready.',
    statusInterrupted: 'Left for later. Resume when you are ready.',
    statusCompleted: 'Practice complete.',
    remaining: (seconds: number) => `${seconds} sec left`,
    progress: (current: number, total: number) => `Sense ${current} of ${total}`,
    liveFocus: {
      settle: 'Settle. Do nothing to create an experience.',
      sight: 'Sight is the current sense.',
      sound: 'Sound is the current sense. The visual object is dimmed.',
      body: 'Body is the current sense. A subtle haptic can confirm it.',
      release: 'Release. Stop checking and let sleep continue.',
    },
    focuses: {
      settle: { title: 'Settle', body: 'Do nothing to create an experience.' },
      sight: { title: 'Sight', body: 'Notice the darkness behind your eyelids.' },
      sound: { title: 'Sound', body: 'Notice the nearest and farthest sound.' },
      body: { title: 'Body', body: 'Notice weight, warmth and contact.' },
      release: { title: 'Release', body: 'Stop checking. Let sleep continue.' },
    },
    cycles: {
      direct: 'Direct cycle',
      slow: 'Slow cycle',
      transition: 'Transition',
    },
    errors: {
      invalid_scope: 'This lab is not available for the current account.',
      invalid_metadata: 'This practice could not be updated.',
      persistence_failed: 'The lab could not be saved on this device. Try again.',
      storage_full: 'This device is out of storage for the lab.',
    },
  },
  fr: {
    eyebrow: 'Pratique SSILD',
    title: 'Laboratoire sensoriel SSILD',
    subtitle: 'Remarquer la vue, puis le son, puis le corps. Le sommeil reste prioritaire.',
    close: 'Fermer',
    disclaimer:
      'Ceci est un exercice sensoriel local. Il ne garantit pas la lucidité et n’annule jamais la protection du sommeil.',
    local: 'Enregistré sur cet appareil. Rien n’est envoyé.',
    loading: 'Chargement du laboratoire…',
    retry: 'Réessayer',
    start: 'Commencer la pratique',
    restart: 'Recommencer',
    resume: 'Reprendre',
    pause: 'Pause',
    leave: 'Quitter sans terminer',
    empty: 'Commence quand tu veux. Le laboratoire ne démarre jamais tout seul.',
    durationFull: 'Environ 5 min',
    durationReduced: 'Environ 3 min',
    silent: 'Silencieux. Le texte et le sens actuel suffisent.',
    soundReady: 'Un signal discret peut marquer un changement de sens. Le texte reste prioritaire.',
    recoveryTitle: 'Protéger le sommeil d’abord',
    recoveryBody:
      'Le mode récupération de sécurité est actif, donc ce laboratoire reste fermé. Le repos passe avant SSILD ce soir.',
    recoveryAction: 'Retour aux programmes',
    fullPlan: 'Cycle complet de 5 minutes',
    reducedPlan: 'Raccourci pour protéger le sommeil',
    statusPaused: 'En pause. Reprends quand tu es prêt.',
    statusInterrupted: 'Laissé pour plus tard. Reprends quand tu es prêt.',
    statusCompleted: 'Pratique terminée.',
    remaining: (seconds: number) => `${seconds} s restantes`,
    progress: (current: number, total: number) => `Sens ${current} sur ${total}`,
    liveFocus: {
      settle: 'S’apaiser. Ne rien produire.',
      sight: 'La vue est le sens actuel.',
      sound: 'Le son est le sens actuel. L’objet visuel est atténué.',
      body: 'Le corps est le sens actuel. Un haptic subtil peut le confirmer.',
      release: 'Relâcher. Cesser de vérifier et laisser le sommeil continuer.',
    },
    focuses: {
      settle: { title: 'S’apaiser', body: 'Ne cherchez à produire aucune expérience.' },
      sight: { title: 'Vue', body: 'Remarquez l’obscurité derrière vos paupières.' },
      sound: { title: 'Ouïe', body: 'Remarquez le son le plus proche puis le plus lointain.' },
      body: { title: 'Corps', body: 'Remarquez le poids, la chaleur et les points de contact.' },
      release: { title: 'Relâcher', body: 'Cessez de vérifier. Laissez le sommeil continuer.' },
    },
    cycles: {
      direct: 'Cycle direct',
      slow: 'Cycle lent',
      transition: 'Transition',
    },
    errors: {
      invalid_scope: 'Ce laboratoire n’est pas disponible pour le compte actuel.',
      invalid_metadata: 'Cette pratique n’a pas pu être mise à jour.',
      persistence_failed: 'Le laboratoire n’a pas pu être enregistré sur cet appareil. Réessaie.',
      storage_full: 'Cet appareil n’a plus assez d’espace pour le laboratoire.',
    },
  },
  es: {
    eyebrow: 'Práctica SSILD',
    title: 'Laboratorio sensorial SSILD',
    subtitle: 'Nota la vista, luego el oído, luego el cuerpo. El sueño sigue primero.',
    close: 'Cerrar',
    disclaimer:
      'Esto es un ensayo sensorial local. No garantiza lucidez y nunca anula la protección del sueño.',
    local: 'Guardado en este dispositivo. No se envía nada.',
    loading: 'Cargando el laboratorio…',
    retry: 'Reintentar',
    start: 'Empezar la práctica',
    restart: 'Practicar de nuevo',
    resume: 'Reanudar',
    pause: 'Pausa',
    leave: 'Salir sin completar',
    empty: 'Empieza cuando quieras. El laboratorio nunca comienza solo.',
    durationFull: 'Unos 5 min',
    durationReduced: 'Unos 3 min',
    silent: 'En silencio. El texto y el sentido actual bastan.',
    soundReady: 'Una señal discreta puede marcar un cambio de sentido. El texto sigue al frente.',
    recoveryTitle: 'Proteger el sueño primero',
    recoveryBody:
      'La recuperación de seguridad está activa, así que este laboratorio permanece cerrado. El descanso va antes que SSILD esta noche.',
    recoveryAction: 'Volver a programas',
    fullPlan: 'Ciclo completo de 5 minutos',
    reducedPlan: 'Acortado para proteger el sueño',
    statusPaused: 'En pausa. Reanuda cuando estés listo.',
    statusInterrupted: 'Dejado para más tarde. Reanuda cuando estés listo.',
    statusCompleted: 'Práctica completa.',
    remaining: (seconds: number) => `${seconds} s restantes`,
    progress: (current: number, total: number) => `Sentido ${current} de ${total}`,
    liveFocus: {
      settle: 'Calma. No produzcas ninguna experiencia.',
      sight: 'La vista es el sentido actual.',
      sound: 'El oído es el sentido actual. El objeto visual está atenuado.',
      body: 'El cuerpo es el sentido actual. Un háptico sutil puede confirmarlo.',
      release: 'Suelta. Deja de comprobar y deja que siga el sueño.',
    },
    focuses: {
      settle: { title: 'Calma', body: 'No intentes producir ninguna experiencia.' },
      sight: { title: 'Vista', body: 'Nota la oscuridad tras los párpados.' },
      sound: { title: 'Oído', body: 'Nota el sonido más cercano y el más lejano.' },
      body: { title: 'Cuerpo', body: 'Nota peso, calor y contacto.' },
      release: { title: 'Suelta', body: 'Deja de comprobar. Permite que siga el sueño.' },
    },
    cycles: {
      direct: 'Ciclo directo',
      slow: 'Ciclo lento',
      transition: 'Transición',
    },
    errors: {
      invalid_scope: 'Este laboratorio no está disponible para la cuenta actual.',
      invalid_metadata: 'No se pudo actualizar esta práctica.',
      persistence_failed: 'No se pudo guardar el laboratorio en este dispositivo. Inténtalo de nuevo.',
      storage_full: 'Este dispositivo no tiene espacio para el laboratorio.',
    },
  },
  de: {
    eyebrow: 'SSILD-Übung',
    title: 'SSILD-Sensoriklabor',
    subtitle: 'Zuerst Sehen, dann Hören, dann den Körper. Schlaf bleibt vorrangig.',
    close: 'Schließen',
    disclaimer:
      'Das ist eine lokale Sinnesübung. Sie garantiert keine Klarheit und hebt den Schlafschutz nie auf.',
    local: 'Auf diesem Gerät gespeichert. Es wird nichts gesendet.',
    loading: 'Labor wird geladen…',
    retry: 'Erneut versuchen',
    start: 'Übung starten',
    restart: 'Erneut üben',
    resume: 'Fortsetzen',
    pause: 'Pause',
    leave: 'Verlassen ohne Abschluss',
    empty: 'Starte, wann du willst. Das Labor beginnt nie von selbst.',
    durationFull: 'Etwa 5 Min.',
    durationReduced: 'Etwa 3 Min.',
    silent: 'Stumm. Text und der aktuelle Sinn reichen.',
    soundReady: 'Ein leises Signal kann den Sinnwechsel markieren. Der Text führt weiter.',
    recoveryTitle: 'Schlaf zuerst schützen',
    recoveryBody:
      'Die Sicherheits-Erholung ist aktiv, deshalb bleibt dieses Labor geschlossen. Ruhe kommt vor SSILD heute Nacht.',
    recoveryAction: 'Zurück zu den Programmen',
    fullPlan: 'Voller 5-Minuten-Zyklus',
    reducedPlan: 'Zum Schutz des Schlafs verkürzt',
    statusPaused: 'Pausiert. Setze fort, wenn du bereit bist.',
    statusInterrupted: 'Für später verlassen. Setze fort, wenn du bereit bist.',
    statusCompleted: 'Übung abgeschlossen.',
    remaining: (seconds: number) => `${seconds} Sek. übrig`,
    progress: (current: number, total: number) => `Sinn ${current} von ${total}`,
    liveFocus: {
      settle: 'Ankommen. Nichts erzeugen.',
      sight: 'Sehen ist der aktuelle Sinn.',
      sound: 'Hören ist der aktuelle Sinn. Das visuelle Objekt ist gedimmt.',
      body: 'Körper ist der aktuelle Sinn. Ein dezentes Haptic kann das bestätigen.',
      release: 'Loslassen. Aufhören zu prüfen und den Schlaf weiterlaufen lassen.',
    },
    focuses: {
      settle: { title: 'Ankommen', body: 'Versuche keine Erfahrung zu erzeugen.' },
      sight: { title: 'Sehen', body: 'Nimm die Dunkelheit hinter den Lidern wahr.' },
      sound: { title: 'Hören', body: 'Nimm den nächsten und fernsten Klang wahr.' },
      body: { title: 'Körper', body: 'Nimm Gewicht, Wärme und Kontakt wahr.' },
      release: { title: 'Loslassen', body: 'Hör auf zu prüfen. Lass den Schlaf weitergehen.' },
    },
    cycles: {
      direct: 'Direkter Zyklus',
      slow: 'Langsamer Zyklus',
      transition: 'Übergang',
    },
    errors: {
      invalid_scope: 'Dieses Labor ist für das aktuelle Konto nicht verfügbar.',
      invalid_metadata: 'Diese Übung konnte nicht aktualisiert werden.',
      persistence_failed: 'Das Labor konnte auf diesem Gerät nicht gespeichert werden. Versuche es erneut.',
      storage_full: 'Dieses Gerät hat keinen Speicherplatz für das Labor.',
    },
  },
  it: {
    eyebrow: 'Pratica SSILD',
    title: 'Laboratorio sensoriale SSILD',
    subtitle: 'Nota la vista, poi il suono, poi il corpo. Il sonno resta prima.',
    close: 'Chiudi',
    disclaimer:
      'Questa è una prova sensoriale locale. Non garantisce lucidità e non sostituisce mai la protezione del sonno.',
    local: 'Salvato su questo dispositivo. Non viene inviato nulla.',
    loading: 'Caricamento del laboratorio…',
    retry: 'Riprova',
    start: 'Inizia la pratica',
    restart: 'Ripratica',
    resume: 'Riprendi',
    pause: 'Pausa',
    leave: 'Esci senza completare',
    empty: 'Inizia quando vuoi. Il laboratorio non parte mai da solo.',
    durationFull: 'Circa 5 min',
    durationReduced: 'Circa 3 min',
    silent: 'In silenzio. Il testo e il senso attuale bastano.',
    soundReady: 'Un segnale discreto può segnare un cambio di senso. Il testo resta in primo piano.',
    recoveryTitle: 'Proteggi prima il sonno',
    recoveryBody:
      'Il recupero di sicurezza è attivo, quindi questo laboratorio resta chiuso. Il riposo viene prima di SSILD stasera.',
    recoveryAction: 'Torna ai programmi',
    fullPlan: 'Ciclo completo di 5 minuti',
    reducedPlan: 'Ridotto per proteggere il sonno',
    statusPaused: 'In pausa. Riprendi quando sei pronto.',
    statusInterrupted: 'Lasciato per dopo. Riprendi quando sei pronto.',
    statusCompleted: 'Pratica completa.',
    remaining: (seconds: number) => `${seconds} s rimanenti`,
    progress: (current: number, total: number) => `Senso ${current} di ${total}`,
    liveFocus: {
      settle: 'Calma. Non produrre alcuna esperienza.',
      sight: 'La vista è il senso attuale.',
      sound: 'L’udito è il senso attuale. L’oggetto visivo è attenuato.',
      body: 'Il corpo è il senso attuale. Un haptic sottile può confermarlo.',
      release: 'Lascia andare. Smetti di controllare e lascia continuare il sonno.',
    },
    focuses: {
      settle: { title: 'Calma', body: 'Non cercare di produrre alcuna esperienza.' },
      sight: { title: 'Vista', body: 'Nota il buio dietro le palpebre.' },
      sound: { title: 'Udito', body: 'Nota il suono più vicino e quello più lontano.' },
      body: { title: 'Corpo', body: 'Nota peso, calore e contatto.' },
      release: { title: 'Lascia andare', body: 'Smetti di controllare. Lascia continuare il sonno.' },
    },
    cycles: {
      direct: 'Ciclo diretto',
      slow: 'Ciclo lento',
      transition: 'Transizione',
    },
    errors: {
      invalid_scope: 'Questo laboratorio non è disponibile per l’account attuale.',
      invalid_metadata: 'Questa pratica non è stata aggiornata.',
      persistence_failed: 'Il laboratorio non è stato salvato su questo dispositivo. Riprova.',
      storage_full: 'Questo dispositivo non ha spazio per il laboratorio.',
    },
  },
} as const;

type LabCopy = (typeof COPY)[keyof typeof COPY];

function remainingSeconds(remainingMs: number): number {
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

function errorCopy(
  copy: LabCopy,
  reason: LucidSsildSensoryLabStorageErrorReason | null
): string | null {
  if (!reason) return null;
  return copy.errors[reason];
}

function visualOpacity(visual: LucidSsildSensoryVisualState): number {
  if (visual === 'dim') return 0.38;
  if (visual === 'emphasis') return 1;
  return 0.72;
}

function objectRole(focus: LucidSsildSensoryFocus): 'sight' | 'sound' | 'body' | 'rest' {
  if (focus === 'sight' || focus === 'sound' || focus === 'body') return focus;
  return 'rest';
}

async function playBodyHaptic(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.selectionAsync();
  } catch {
    // Best-effort only.
  }
}

function isForeground(status: AppStateStatus): boolean {
  return status === 'active';
}

export default function LucidSsildSensoryLabScreen() {
  const { content, state, userScope } = useLucidTrainer();
  const { fontScale, width } = useWindowDimensions();
  const compact = width < 380 || fontScale >= 1.3;
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const copy = COPY[content.locale];
  const reduceMotion = useLucidReducedMotion();
  const lab = useLucidSsildSensoryLab({ userScope });
  const safetyPolicy = evaluateLucidSafetyPolicyFromState(state);
  const guidedPlan = useMemo(
    () => createLucidGuidedRitualPlan('ssild', safetyPolicy),
    [safetyPolicy]
  );
  const recoveryBlocked =
    guidedPlan.status !== 'ready' ||
    guidedPlan.mode === 'replacement' ||
    guidedPlan.objective === 'protect_sleep';
  const plannedDurationSeconds =
    !recoveryBlocked && guidedPlan.status === 'ready' ? guidedPlan.totalDurationSeconds : 0;
  const soundAllowed =
    !recoveryBlocked &&
    guidedPlan.status === 'ready' &&
    guidedPlan.soundAllowed &&
    state?.preferences.audioCuesEnabled === true;
  const { playTransition, stop } = useLucidGuidedRitualSound(soundAllowed);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const busyLockRef = useRef(false);
  const tickLockRef = useRef(false);
  const lastAnnouncedPhaseRef = useRef<string | null>(null);
  const lastHapticPhaseRef = useRef<string | null>(null);
  const lastAudioPhaseRef = useRef<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState ?? 'active');
  const pendingBackgroundPauseRef = useRef(false);
  const mountedRef = useRef(true);
  const session = recoveryBlocked ? null : lab.currentSession;
  const phase = recoveryBlocked ? null : lab.phase;
  const plan = recoveryBlocked ? null : lab.plan;
  const controlsBusy = busyAction !== null || lab.isMutating;
  const labRef = useRef(lab);

  const runAction = useCallback(
    async (key: string, work: () => Promise<unknown>) => {
      if (busyLockRef.current || lab.isMutating) return;
      busyLockRef.current = true;
      setBusyAction(key);
      try {
        await work();
      } catch {
        // Storage error is already exposed by the hook.
      } finally {
        busyLockRef.current = false;
        setBusyAction(null);
      }
    },
    [lab]
  );

  useEffect(() => {
    labRef.current = lab;
  }, [lab]);

  const announcePhase = useCallback(
    (nextPhase: LucidSsildSensoryPhase | null) => {
      if (!nextPhase) return;
      const key = `${nextPhase.id}:${nextPhase.a11yStateId}`;
      if (lastAnnouncedPhaseRef.current === key) return;
      lastAnnouncedPhaseRef.current = key;
      setStatusMessage(copy.liveFocus[nextPhase.focus]);
    },
    [copy.liveFocus]
  );

  const cuePhase = useCallback(
    async (
      nextPhase: LucidSsildSensoryPhase | null,
      sessionStatus: LucidSsildSensoryLabSession['status'] | null
    ) => {
      if (!nextPhase || sessionStatus !== 'running') return;
      if (nextPhase.haptic === 'subtle' && lastHapticPhaseRef.current !== nextPhase.id) {
        lastHapticPhaseRef.current = nextPhase.id;
        await playBodyHaptic();
      }
      if (
        nextPhase.audio === 'cue' &&
        soundAllowed &&
        lastAudioPhaseRef.current !== nextPhase.id
      ) {
        lastAudioPhaseRef.current = nextPhase.id;
        await playTransition().catch(() => false);
      }
    },
    [playTransition, soundAllowed]
  );

  useEffect(() => {
    if (!session || session.status !== 'running' || !phase) return;
    announcePhase(phase);
    void cuePhase(phase, session.status);
  }, [announcePhase, cuePhase, phase, session]);

  useEffect(() => {
    if (recoveryBlocked || !session || session.status !== 'running') return;
    let cancelled = false;
    const tickOnce = async () => {
      if (cancelled || tickLockRef.current || lab.isMutating || busyLockRef.current) return;
      tickLockRef.current = true;
      try {
        await lab.tick();
      } catch {
        // Persistence errors stay on the hook.
      } finally {
        tickLockRef.current = false;
      }
    };
    const interval = setInterval(() => {
      void tickOnce();
    }, TICK_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [lab, recoveryBlocked, session]);

  const pauseForBackground = useCallback(async () => {
    pendingBackgroundPauseRef.current = true;
    void stop();
    const current = labRef.current.currentSession;
    if (!current) return;
    if (current.status !== 'running') {
      pendingBackgroundPauseRef.current = false;
      return;
    }
    try {
      await labRef.current.pause();
    } catch {
      // Already completed or persistence failed. Never invent completion here.
    }
    if (labRef.current.currentSession?.status !== 'running') {
      pendingBackgroundPauseRef.current = false;
    }
  }, [stop]);

  useEffect(() => {
    mountedRef.current = true;
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      appStateRef.current = nextState;
      if (!mountedRef.current) return;
      if (isForeground(nextState)) {
        pendingBackgroundPauseRef.current = false;
        return;
      }
      void pauseForBackground();
    });
    return () => {
      mountedRef.current = false;
      subscription.remove();
    };
  }, [pauseForBackground]);

  useEffect(() => {
    if (!pendingBackgroundPauseRef.current) return;
    if (isForeground(appStateRef.current)) {
      pendingBackgroundPauseRef.current = false;
      return;
    }
    if (session?.status === 'running') {
      void pauseForBackground();
    }
  }, [pauseForBackground, session]);

  const loadFailed = Boolean(lab.error) && !session && !lab.isLoading;
  const primaryKey = recoveryBlocked
    ? 'recovery'
    : lab.isLoading
      ? null
      : loadFailed
        ? 'retry'
        : !session || session.status === 'completed' || session.status === 'idle'
          ? 'start'
          : session.status === 'paused' || session.status === 'interrupted'
            ? 'resume'
            : null;
  const primaryLabel =
    primaryKey === 'recovery'
      ? copy.recoveryAction
      : primaryKey === 'retry'
        ? copy.retry
        : primaryKey === 'start'
          ? session?.status === 'completed'
            ? copy.restart
            : copy.start
          : primaryKey === 'resume'
            ? copy.resume
            : null;

  const onPrimaryPress = () => {
    if (primaryKey === 'recovery') {
      router.replace('/lucid/(tabs)/programs' as never);
      return;
    }
    if (primaryKey === 'retry') {
      void runAction('retry', () => lab.refresh());
      return;
    }
    if (primaryKey === 'start') {
      if (guidedPlan.status !== 'ready') return;
      void runAction('start', async () => {
        setStatusMessage('');
        lastAnnouncedPhaseRef.current = null;
        lastHapticPhaseRef.current = null;
        lastAudioPhaseRef.current = null;
        await lab.startNew(guidedPlan);
        if (!mountedRef.current) return;
        if (!isForeground(appStateRef.current) || pendingBackgroundPauseRef.current) {
          pendingBackgroundPauseRef.current = true;
          void stop();
          try {
            await lab.pause();
          } catch {
            // Already completed or persistence failed. Never invent completion here.
          }
          if (labRef.current.currentSession?.status !== 'running') {
            pendingBackgroundPauseRef.current = false;
          }
        }
      });
      return;
    }
    if (primaryKey === 'resume') {
      void runAction('resume', async () => {
        setStatusMessage('');
        await lab.resume();
      });
    }
  };

  const close = async () => {
    if (session?.status === 'running') {
      await runAction('leave', async () => {
        await stop();
        await lab.exit();
        router.back();
      });
      return;
    }
    await stop();
    router.back();
  };

  const errorMessage = errorCopy(copy, lab.error);
  const durationLabel = plannedDurationSeconds === 180 ? copy.durationReduced : copy.durationFull;
  const planLabel = plannedDurationSeconds === 180 ? copy.reducedPlan : copy.fullPlan;
  const objectFocus = phase ? objectRole(phase.focus) : 'rest';
  const objectOpacity = phase ? visualOpacity(phase.visual) : 0.72;

  return (
    <LucidScreen
      eyebrow={copy.eyebrow}
      footer={
        !primaryKey || !primaryLabel ? null : (
          <View style={styles.footer}>
            <LucidButton
              disabled={controlsBusy && busyAction !== primaryKey}
              label={primaryLabel}
              loading={busyAction === primaryKey || lab.isMutating}
              onPress={onPrimaryPress}
              testID="lucid-ssild-lab-primary"
            />
          </View>
        )
      }
      subtitle={copy.subtitle}
      testID="lucid-ssild-lab"
      title={copy.title}
      trailing={<LucidIconAction icon="close" label={copy.close} onPress={() => void close()} />}
    >
      <LucidCard style={compact ? { ...styles.notice, ...styles.noticeCompact } : styles.notice}>
        <Text style={[styles.body, { color: palette.text }]}>{copy.disclaimer}</Text>
        <Text style={[styles.meta, { color: palette.textSecondary }]}>{durationLabel}</Text>
        <Text style={[styles.meta, { color: palette.textSecondary }]}>{copy.local}</Text>
      </LucidCard>

      {recoveryBlocked ? (
        <LucidCard style={styles.notice} testID="lucid-ssild-lab-recovery">
          <Text accessibilityRole="header" style={[styles.stepTitle, { color: palette.text }]}>
            {copy.recoveryTitle}
          </Text>
          <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.recoveryBody}</Text>
        </LucidCard>
      ) : null}

      {lab.isLoading && !recoveryBlocked ? (
        <Text accessibilityLiveRegion="polite" style={[styles.body, { color: palette.textSecondary }]}>
          {copy.loading}
        </Text>
      ) : null}

      {errorMessage && !recoveryBlocked ? (
        <LucidCard style={styles.notice} testID="lucid-ssild-lab-error">
          <Text style={[styles.body, { color: palette.text }]}>{errorMessage}</Text>
        </LucidCard>
      ) : null}

      {!lab.isLoading && !session && !recoveryBlocked ? (
        <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.empty}</Text>
      ) : null}

      {session && phase && plan ? (
        <LucidCard
          style={compact ? { ...styles.stepCard, ...styles.stepCardCompact } : styles.stepCard}
          testID={compact ? 'lucid-ssild-lab-step-compact' : 'lucid-ssild-lab-step'}
        >
          <LucidProgressBar
            accessibilityLabel={copy.progress(session.phaseIndex + 1, session.phaseCount)}
            value={lab.progression}
          />
          <Text style={[styles.meta, { color: palette.textMuted }]}>
            {copy.progress(session.phaseIndex + 1, session.phaseCount)} · {planLabel}
          </Text>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.objectStage}
            testID="lucid-ssild-lab-object"
          >
            <View
              style={[
                styles.objectCore,
                {
                  backgroundColor: palette.surfaceRaised,
                  borderColor: palette.borderInteractive,
                  opacity: objectOpacity,
                },
                objectFocus === 'sight' ? styles.objectSight : null,
                objectFocus === 'sound' ? styles.objectSound : null,
                objectFocus === 'body' ? styles.objectBody : null,
              ]}
            />
            <Text
              style={[styles.meta, { color: palette.textMuted }]}
              testID="lucid-ssild-lab-object-state"
            >
              {copy.focuses[phase.focus].title}
            </Text>
          </View>
          <Text accessibilityRole="header" style={[styles.stepTitle, { color: palette.text }]}>
            {copy.focuses[phase.focus].title}
          </Text>
          <Text style={[styles.body, { color: palette.textSecondary }]}>
            {copy.focuses[phase.focus].body}
          </Text>
          <Text style={[styles.meta, { color: palette.textMuted }]}>
            {copy.cycles[phase.cycle]} · {copy.remaining(remainingSeconds(lab.remainingMs))}
          </Text>
          <Text style={[styles.body, { color: palette.textSecondary }]}>
            {soundAllowed && phase.audio === 'cue' ? copy.soundReady : copy.silent}
          </Text>
          {session.status === 'paused' ? (
            <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.statusPaused}</Text>
          ) : null}
          {session.status === 'interrupted' ? (
            <Text style={[styles.body, { color: palette.textSecondary }]}>
              {copy.statusInterrupted}
            </Text>
          ) : null}
          {session.status === 'completed' ? (
            <Text style={[styles.body, { color: palette.textSecondary }]}>
              {copy.statusCompleted}
            </Text>
          ) : null}
        </LucidCard>
      ) : null}

      {session?.status === 'running' ? (
        <View style={styles.actions}>
          <LucidButton
            disabled={controlsBusy}
            label={copy.pause}
            loading={busyAction === 'pause'}
            onPress={() =>
              void runAction('pause', async () => {
                await stop();
                await lab.pause();
              })
            }
            testID="lucid-ssild-lab-pause"
            variant="ghost"
          />
          <LucidButton
            disabled={controlsBusy}
            label={copy.leave}
            loading={busyAction === 'leave'}
            onPress={() => void close()}
            testID="lucid-ssild-lab-leave"
            variant="ghost"
          />
        </View>
      ) : null}

      {statusMessage ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.body, { color: palette.text }]}
          testID="lucid-ssild-lab-live"
        >
          {statusMessage}
        </Text>
      ) : null}

      {reduceMotion ? (
        <Text accessibilityElementsHidden testID="lucid-ssild-lab-static">
          {copy.focuses.sight.title}
        </Text>
      ) : null}
    </LucidScreen>
  );
}

const styles = StyleSheet.create({
  notice: { gap: LucidSpace.sm },
  noticeCompact: { gap: LucidSpace.xs },
  stepCard: { gap: LucidSpace.sm },
  stepCardCompact: { gap: LucidSpace.xs },
  objectStage: {
    minHeight: 132,
    alignItems: 'center',
    justifyContent: 'center',
    gap: LucidSpace.sm,
  },
  objectCore: {
    width: 88,
    height: 88,
    borderRadius: LucidRadius.xl,
    borderWidth: 1,
  },
  objectSight: {
    width: 104,
    height: 104,
  },
  objectSound: {
    width: 72,
    height: 72,
    borderRadius: LucidRadius.full,
  },
  objectBody: {
    width: 96,
    height: 64,
    borderRadius: LucidRadius.md,
  },
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
