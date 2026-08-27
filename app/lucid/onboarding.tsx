import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import {
  LucidOnboardingBackdrop,
  LucidOnboardingStage,
} from '@/components/lucid/LucidOnboardingBackdrop';
import {
  LucidSegmentedProgress,
} from '@/components/lucid/LucidOnboardingChoices';
import {
  LucidButton,
  LucidCard,
  LucidChoiceCard,
  LucidIconAction,
  LucidOverline,
  LucidScreen,
} from '@/components/lucid/LucidUI';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import { getLucidPalette, LucidIcon, LucidRadius, LucidSpace, LucidType } from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import type {
  LucidExperienceLevel,
  LucidGoal,
  LucidWakeSensitivity,
} from '@/lib/lucid/model';
import { isLucidLocalTime } from '@/lib/lucid/model';
import { getLucidPersonalizedPlan } from '@/lib/lucid/personalization';
import { evaluateLucidSafetyPolicyFromState } from '@/lib/lucid/safety';
import type { ThemeAmbience } from '@/lib/themeAmbience';

const STEP_COUNT = 4;

const LOCAL = {
  en: {
    step: 'Step', bed: 'Bedtime', wake: 'Wake time', timePickerHint: 'Opens the system time picker.',
  },
  fr: {
    step: 'Étape', bed: 'Coucher', wake: 'Réveil', timePickerHint: 'Ouvre le sélecteur d’heure du système.',
  },
  es: {
    step: 'Paso', bed: 'Hora de dormir', wake: 'Hora de despertar', timePickerHint: 'Abre el selector de hora del sistema.',
  },
  de: {
    step: 'Schritt', bed: 'Schlafenszeit', wake: 'Aufstehzeit', timePickerHint: 'Öffnet die Zeitauswahl des Systems.',
  },
  it: {
    step: 'Passaggio', bed: 'Ora di dormire', wake: 'Ora di sveglia', timePickerHint: 'Apre il selettore dell’ora di sistema.',
  },
} as const;

const FLOW = {
  en: {
    intentionTitle: 'Choose your intention', intentionSubtitle: 'Two answers shape your first week.', goalLabel: 'Goal', experienceLabel: 'Experience', chooseIntention: 'Choose a goal and your experience to continue.',
    sleepTitle: 'Protect your sleep first', sleepSubtitle: 'Use your usual times. Nothing is enabled at night during onboarding.', notSet: 'Not set', sensitivityLabel: 'Do awakenings make it hard to fall asleep again?', sensitiveTitle: 'Yes, my sleep is sensitive', sensitiveDescription: 'Keep the first week gentle and avoid night interruptions.', notSensitiveTitle: 'No, usually not', notSensitiveDescription: 'Night features still stay off until you explicitly enable them.', chooseSleep: 'Set both times and choose your wake sensitivity.',
    weekTitle: 'Your first week', weekSubtitle: 'This plan comes from your answers and the current sleep-safety rules.', morningTitle: 'Morning capture', morningDetail: 'A short dream note after waking, for 7 days.', trainingTitle: 'Daytime practice', trainingDetail: (days: number) => `${days} attentive sessions this week.`, ritualTitle: 'Bedtime ritual', restrictionsTitle: 'Night safeguards', reasonLabel: 'Why this plan', reasonPrudent: 'A gentle baseline while the app learns from your observations.', reasonRecall: 'Dream recall comes before adding more demanding techniques.', reasonReduced: 'Your sleep sensitivity keeps this first week low intensity.', reasonRecovery: 'Sleep protection temporarily replaces lucid-dream techniques.', ritualRecall: 'A calm intention and a morning recall habit.', ritualMild: 'A short MILD intention before sleep.', ritualSsild: 'A light SSILD practice before sleep.', ritualQuiet: 'No night technique while sleep recovers.', wbtbAllowed: 'WBTB can be considered later, never required.', wbtbBlocked: 'WBTB is unavailable for this plan.', signalsAllowed: 'Audio cues can be considered later with explicit consent.', signalsBlocked: 'Night audio stays unavailable.',
    localTitle: 'Ready, without an account', localSubtitle: 'You can start now. Optional capabilities are explained only when you use them.', localStorageTitle: 'Local by default', localStorageDetail: 'Your training and dream notes stay on this device unless you choose sync.', noAccountTitle: 'No account required', noAccountDetail: 'The complete first week works without signing in.', permissionsTitle: 'Permissions at first use', permissionsDetail: 'Notifications, audio, microphone and cloud sync are requested only when the related feature is opened.', finish: 'Create my first week', saveError: 'Your choices could not be saved. Try again.',
  },
  fr: {
    intentionTitle: 'Choisissez votre intention', intentionSubtitle: 'Deux réponses façonnent votre première semaine.', goalLabel: 'Objectif', experienceLabel: 'Expérience', chooseIntention: 'Choisissez un objectif et votre expérience pour continuer.',
    sleepTitle: 'Protégez d’abord votre sommeil', sleepSubtitle: 'Indiquez vos horaires habituels. Rien n’est activé la nuit pendant l’onboarding.', notSet: 'Non défini', sensitivityLabel: 'Les réveils vous empêchent-ils de vous rendormir facilement ?', sensitiveTitle: 'Oui, mon sommeil est sensible', sensitiveDescription: 'La première semaine restera douce, sans interruption nocturne.', notSensitiveTitle: 'Non, généralement pas', notSensitiveDescription: 'Les fonctions nocturnes restent désactivées jusqu’à votre accord explicite.', chooseSleep: 'Indiquez les deux horaires et votre sensibilité aux réveils.',
    weekTitle: 'Votre première semaine', weekSubtitle: 'Ce plan vient de vos réponses et des règles actuelles de protection du sommeil.', morningTitle: 'Capture du matin', morningDetail: 'Une note de rêve courte au réveil, pendant 7 jours.', trainingTitle: 'Pratique en journée', trainingDetail: (days: number) => `${days} séances attentives cette semaine.`, ritualTitle: 'Rituel du coucher', restrictionsTitle: 'Protections nocturnes', reasonLabel: 'Pourquoi ce plan', reasonPrudent: 'Une base douce pendant que l’app apprend de vos observations.', reasonRecall: 'Le souvenir des rêves passe avant les techniques plus exigeantes.', reasonReduced: 'Votre sensibilité au réveil maintient une intensité légère.', reasonRecovery: 'La protection du sommeil remplace temporairement les techniques lucides.', ritualRecall: 'Une intention calme et une habitude de rappel au réveil.', ritualMild: 'Une courte intention MILD avant le sommeil.', ritualSsild: 'Une pratique SSILD légère avant le sommeil.', ritualQuiet: 'Aucune technique nocturne pendant la récupération.', wbtbAllowed: 'Le WBTB pourra être envisagé plus tard, jamais imposé.', wbtbBlocked: 'Le WBTB est indisponible pour ce plan.', signalsAllowed: 'Les signaux audio pourront être envisagés avec un accord explicite.', signalsBlocked: 'L’audio nocturne reste indisponible.',
    localTitle: 'Prêt, sans compte', localSubtitle: 'Vous pouvez commencer. Les fonctions facultatives sont expliquées seulement au moment de les utiliser.', localStorageTitle: 'Local par défaut', localStorageDetail: 'Votre entraînement et vos notes restent sur cet appareil, sauf si vous choisissez la synchronisation.', noAccountTitle: 'Aucun compte requis', noAccountDetail: 'La première semaine complète fonctionne sans connexion.', permissionsTitle: 'Permissions au premier usage', permissionsDetail: 'Notifications, audio, microphone et cloud sont demandés uniquement à l’ouverture de la fonction associée.', finish: 'Créer ma première semaine', saveError: 'Vos choix n’ont pas pu être enregistrés. Réessayez.',
  },
  es: {
    intentionTitle: 'Elige tu intención', intentionSubtitle: 'Dos respuestas dan forma a tu primera semana.', goalLabel: 'Objetivo', experienceLabel: 'Experiencia', chooseIntention: 'Elige un objetivo y tu experiencia para continuar.',
    sleepTitle: 'Protege primero tu sueño', sleepSubtitle: 'Usa tus horarios habituales. Nada se activa por la noche durante la configuración.', notSet: 'Sin definir', sensitivityLabel: '¿Te cuesta volver a dormir después de despertarte?', sensitiveTitle: 'Sí, mi sueño es sensible', sensitiveDescription: 'La primera semana será suave y sin interrupciones nocturnas.', notSensitiveTitle: 'No, normalmente no', notSensitiveDescription: 'Las funciones nocturnas seguirán apagadas hasta que las actives expresamente.', chooseSleep: 'Indica ambos horarios y tu sensibilidad al despertar.',
    weekTitle: 'Tu primera semana', weekSubtitle: 'Este plan usa tus respuestas y las reglas actuales de protección del sueño.', morningTitle: 'Registro matinal', morningDetail: 'Una nota breve del sueño al despertar, durante 7 días.', trainingTitle: 'Práctica diurna', trainingDetail: (days: number) => `${days} sesiones atentas esta semana.`, ritualTitle: 'Ritual al acostarte', restrictionsTitle: 'Protecciones nocturnas', reasonLabel: 'Por qué este plan', reasonPrudent: 'Una base suave mientras la app aprende de tus observaciones.', reasonRecall: 'Recordar los sueños va antes que las técnicas más exigentes.', reasonReduced: 'Tu sensibilidad al despertar mantiene baja la intensidad.', reasonRecovery: 'Proteger el sueño reemplaza temporalmente las técnicas lúcidas.', ritualRecall: 'Una intención tranquila y un hábito de recuerdo matinal.', ritualMild: 'Una breve intención MILD antes de dormir.', ritualSsild: 'Una práctica SSILD ligera antes de dormir.', ritualQuiet: 'Sin técnica nocturna durante la recuperación.', wbtbAllowed: 'WBTB podrá considerarse más adelante, nunca es obligatorio.', wbtbBlocked: 'WBTB no está disponible en este plan.', signalsAllowed: 'Las señales de audio podrán considerarse con consentimiento explícito.', signalsBlocked: 'El audio nocturno sigue sin estar disponible.',
    localTitle: 'Listo, sin cuenta', localSubtitle: 'Puedes empezar ahora. Las funciones opcionales se explican solo cuando las usas.', localStorageTitle: 'Local por defecto', localStorageDetail: 'Tu entrenamiento y tus notas permanecen en este dispositivo salvo que elijas sincronizar.', noAccountTitle: 'No necesitas cuenta', noAccountDetail: 'La primera semana completa funciona sin iniciar sesión.', permissionsTitle: 'Permisos al primer uso', permissionsDetail: 'Notificaciones, audio, micrófono y nube se solicitan solo al abrir la función relacionada.', finish: 'Crear mi primera semana', saveError: 'No se pudieron guardar tus elecciones. Inténtalo de nuevo.',
  },
  de: {
    intentionTitle: 'Wähle deine Absicht', intentionSubtitle: 'Zwei Antworten gestalten deine erste Woche.', goalLabel: 'Ziel', experienceLabel: 'Erfahrung', chooseIntention: 'Wähle ein Ziel und deine Erfahrung, um fortzufahren.',
    sleepTitle: 'Schütze zuerst deinen Schlaf', sleepSubtitle: 'Nutze deine üblichen Zeiten. Während der Einführung wird nachts nichts aktiviert.', notSet: 'Nicht festgelegt', sensitivityLabel: 'Fällt dir das Wiedereinschlafen nach dem Aufwachen schwer?', sensitiveTitle: 'Ja, mein Schlaf ist empfindlich', sensitiveDescription: 'Die erste Woche bleibt sanft und vermeidet nächtliche Unterbrechungen.', notSensitiveTitle: 'Nein, normalerweise nicht', notSensitiveDescription: 'Nachtfunktionen bleiben aus, bis du sie ausdrücklich aktivierst.', chooseSleep: 'Lege beide Zeiten und deine Aufwachempfindlichkeit fest.',
    weekTitle: 'Deine erste Woche', weekSubtitle: 'Dieser Plan basiert auf deinen Antworten und den aktuellen Schlafschutzregeln.', morningTitle: 'Morgendliche Notiz', morningDetail: 'Sieben Tage lang eine kurze Traumnotiz nach dem Aufwachen.', trainingTitle: 'Übung am Tag', trainingDetail: (days: number) => `${days} aufmerksame Übungen in dieser Woche.`, ritualTitle: 'Abendritual', restrictionsTitle: 'Schutz in der Nacht', reasonLabel: 'Warum dieser Plan', reasonPrudent: 'Ein sanfter Einstieg, während die App aus deinen Beobachtungen lernt.', reasonRecall: 'Traumerinnerung kommt vor anspruchsvolleren Techniken.', reasonReduced: 'Deine Aufwachempfindlichkeit hält die Intensität niedrig.', reasonRecovery: 'Schlafschutz ersetzt vorübergehend Klartraumtechniken.', ritualRecall: 'Eine ruhige Absicht und morgendliche Traumerinnerung.', ritualMild: 'Eine kurze MILD-Absicht vor dem Schlafen.', ritualSsild: 'Eine leichte SSILD-Übung vor dem Schlafen.', ritualQuiet: 'Keine Nachttechnik während der Erholung.', wbtbAllowed: 'WBTB kann später erwogen werden, ist aber nie Pflicht.', wbtbBlocked: 'WBTB ist für diesen Plan nicht verfügbar.', signalsAllowed: 'Audiosignale können später mit ausdrücklicher Zustimmung erwogen werden.', signalsBlocked: 'Nacht-Audio bleibt nicht verfügbar.',
    localTitle: 'Bereit, ohne Konto', localSubtitle: 'Du kannst jetzt starten. Optionale Funktionen werden erst bei ihrer Nutzung erklärt.', localStorageTitle: 'Standardmäßig lokal', localStorageDetail: 'Training und Traumnotizen bleiben auf diesem Gerät, sofern du keine Synchronisierung wählst.', noAccountTitle: 'Kein Konto nötig', noAccountDetail: 'Die vollständige erste Woche funktioniert ohne Anmeldung.', permissionsTitle: 'Berechtigungen bei erster Nutzung', permissionsDetail: 'Mitteilungen, Audio, Mikrofon und Cloud werden erst beim Öffnen der jeweiligen Funktion angefragt.', finish: 'Meine erste Woche erstellen', saveError: 'Deine Auswahl konnte nicht gespeichert werden. Versuche es erneut.',
  },
  it: {
    intentionTitle: 'Scegli la tua intenzione', intentionSubtitle: 'Due risposte danno forma alla tua prima settimana.', goalLabel: 'Obiettivo', experienceLabel: 'Esperienza', chooseIntention: 'Scegli un obiettivo e la tua esperienza per continuare.',
    sleepTitle: 'Proteggi prima il sonno', sleepSubtitle: 'Usa i tuoi orari abituali. Durante l’onboarding non viene attivato nulla di notte.', notSet: 'Non impostato', sensitivityLabel: 'Dopo un risveglio fai fatica a riaddormentarti?', sensitiveTitle: 'Sì, il mio sonno è sensibile', sensitiveDescription: 'La prima settimana resterà delicata e senza interruzioni notturne.', notSensitiveTitle: 'No, di solito no', notSensitiveDescription: 'Le funzioni notturne restano disattivate finché non le abiliti esplicitamente.', chooseSleep: 'Imposta entrambi gli orari e la sensibilità ai risvegli.',
    weekTitle: 'La tua prima settimana', weekSubtitle: 'Questo piano usa le tue risposte e le regole attuali di protezione del sonno.', morningTitle: 'Nota del mattino', morningDetail: 'Una breve nota del sogno al risveglio, per 7 giorni.', trainingTitle: 'Pratica diurna', trainingDetail: (days: number) => `${days} sessioni attente questa settimana.`, ritualTitle: 'Rituale serale', restrictionsTitle: 'Protezioni notturne', reasonLabel: 'Perché questo piano', reasonPrudent: 'Una base delicata mentre l’app impara dalle tue osservazioni.', reasonRecall: 'Il ricordo dei sogni precede le tecniche più impegnative.', reasonReduced: 'La sensibilità ai risvegli mantiene bassa l’intensità.', reasonRecovery: 'Proteggere il sonno sostituisce temporaneamente le tecniche lucide.', ritualRecall: 'Un’intenzione calma e l’abitudine al ricordo mattutino.', ritualMild: 'Una breve intenzione MILD prima di dormire.', ritualSsild: 'Una pratica SSILD leggera prima di dormire.', ritualQuiet: 'Nessuna tecnica notturna durante il recupero.', wbtbAllowed: 'WBTB potrà essere valutato più avanti, mai imposto.', wbtbBlocked: 'WBTB non è disponibile per questo piano.', signalsAllowed: 'I segnali audio potranno essere valutati con consenso esplicito.', signalsBlocked: 'L’audio notturno resta non disponibile.',
    localTitle: 'Pronto, senza account', localSubtitle: 'Puoi iniziare subito. Le funzioni opzionali vengono spiegate solo quando le usi.', localStorageTitle: 'Locale per impostazione predefinita', localStorageDetail: 'Allenamento e note restano su questo dispositivo, salvo tua scelta di sincronizzarli.', noAccountTitle: 'Nessun account richiesto', noAccountDetail: 'La prima settimana completa funziona senza accesso.', permissionsTitle: 'Permessi al primo utilizzo', permissionsDetail: 'Notifiche, audio, microfono e cloud vengono richiesti solo aprendo la funzione collegata.', finish: 'Crea la mia prima settimana', saveError: 'Non è stato possibile salvare le scelte. Riprova.',
  },
} as const;

export default function LucidOnboardingScreen() {
  const { ambience } = useTheme();
  return <LucidOnboardingContent ambience={ambience} />;
}

function LucidOnboardingContent({ ambience }: { ambience: ThemeAmbience }) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { fontScale, height, width } = useWindowDimensions();
  const { state, content, completeOnboarding, saveOnboardingDraft } = useLucidTrainer();
  const locale = content.locale;
  const legacyCopy = LOCAL[locale];
  const copy = FLOW[locale];
  const initial = state!.onboarding;
  const initialStep = initial.status === 'in_progress'
    ? Math.max(0, Math.min(STEP_COUNT - 1, initial.draftStep ?? 0))
    : 0;
  const [step, setStep] = useState(initialStep);
  const [stepDirection, setStepDirection] = useState<-1 | 1>(1);
  const [goal, setGoal] = useState<LucidGoal | null>(initial.goal);
  const [experience, setExperience] = useState<LucidExperienceLevel | null>(initial.experience);
  const [wakeSensitivity, setWakeSensitivity] = useState<LucidWakeSensitivity | null>(
    initial.wakeSensitivity ?? null
  );
  const [bedtime, setBedtime] = useState<string | null>(
    initial.sleepScheduleConfirmed === true
      ? initial.sleepSchedule.bedtime
      : initial.sleepScheduleDraft?.bedtime ?? null
  );
  const [wakeTime, setWakeTime] = useState<string | null>(
    initial.sleepScheduleConfirmed === true
      ? initial.sleepSchedule.wakeTime
      : initial.sleepScheduleDraft?.wakeTime ?? null
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const draftQueue = useRef<Promise<void>>(Promise.resolve());

  const timeZone = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
  }, []);

  const sleepScheduleReady = bedtime !== null && wakeTime !== null &&
    isLucidLocalTime(bedtime) && isLucidLocalTime(wakeTime);
  const answersReady = goal !== null && experience !== null && wakeSensitivity !== null && sleepScheduleReady;
  const canContinue = step === 0
    ? goal !== null && experience !== null
    : step === 1
      ? sleepScheduleReady && wakeSensitivity !== null
      : answersReady;
  const blockedReason = canContinue
    ? undefined
    : step === 0
      ? copy.chooseIntention
      : copy.chooseSleep;

  const previewPolicy = useMemo(
    () => evaluateLucidSafetyPolicyFromState({
      onboarding: {
        audioSafetyAccepted: initial.audioSafetyAccepted,
        wakeSensitivity,
      },
      experiments: state!.experiments,
    }),
    [initial.audioSafetyAccepted, state, wakeSensitivity]
  );
  const plan = useMemo(
    () => getLucidPersonalizedPlan({
      goal,
      experience,
      observations: state!.experiments,
      policy: previewPolicy,
    }),
    [experience, goal, previewPolicy, state]
  );
  const planRitual = plan.intensity === 'recovery'
    ? copy.ritualQuiet
    : plan.primaryAction === 'strengthen_recall'
      ? copy.ritualRecall
      : plan.recommendedTechnique === 'ssild'
        ? copy.ritualSsild
        : copy.ritualMild;
  const planReason = plan.intensity === 'recovery'
    ? copy.reasonRecovery
    : plan.intensity === 'reduced'
      ? copy.reasonReduced
      : plan.primaryAction === 'strengthen_recall'
        ? copy.reasonRecall
        : copy.reasonPrudent;

  const enqueueDraft = (patch: Parameters<typeof saveOnboardingDraft>[0]) => {
    setSaveError(null);
    const operation = draftQueue.current.then(() => saveOnboardingDraft(patch));
    draftQueue.current = operation.catch(() => undefined);
    return operation;
  };

  const persistSelection = (patch: Parameters<typeof saveOnboardingDraft>[0]) => {
    void enqueueDraft(patch).catch(() => setSaveError(copy.saveError));
  };

  const persistSnapshot = (draftStep: 0 | 1 | 2 | 3) => enqueueDraft({
    goal,
    experience,
    wakeSensitivity,
    draftStep,
    sleepScheduleDraft: { bedtime, wakeTime },
    sleepScheduleConfirmed: sleepScheduleReady,
    ...(sleepScheduleReady
      ? { sleepSchedule: { bedtime, wakeTime, timeZone } }
      : {}),
  });

  const next = async () => {
    if (!canContinue) return;
    setSaving(true);
    setSaveError(null);
    if (step < STEP_COUNT - 1) {
      try {
        const targetStep = (step + 1) as 0 | 1 | 2 | 3;
        await persistSnapshot(targetStep);
        setStepDirection(1);
        setStep(targetStep);
      } catch {
        setSaveError(copy.saveError);
      } finally {
        setSaving(false);
      }
      return;
    }
    if (!goal || !experience || !wakeSensitivity || !sleepScheduleReady) {
      setSaving(false);
      return;
    }
    try {
      await completeOnboarding({
        goal,
        experience,
        wakeSensitivity,
        weeklyTarget: initial.weeklyTarget,
        sleepSchedule: { bedtime, wakeTime, timeZone },
        sleepScheduleConfirmed: true,
        notificationsPermission: initial.notificationsPermission,
        notificationsExplained: initial.notificationsExplained,
        audioSafetyAccepted: initial.audioSafetyAccepted,
        analyticsConsent: initial.analyticsConsent ?? false,
        accessibility: initial.accessibility,
        cloudSyncEnabled: state!.preferences.cloudSyncEnabled,
        noctaliaLinkEnabled: state!.preferences.noctaliaLinkEnabled,
      });
    } catch {
      setSaveError(copy.saveError);
    } finally {
      setSaving(false);
    }
  };

  const back = async () => {
    if (step === 0 || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const targetStep = (step - 1) as 0 | 1 | 2 | 3;
      await persistSnapshot(targetStep);
      setStepDirection(-1);
      setStep(targetStep);
    } catch {
      setSaveError(copy.saveError);
    } finally {
      setSaving(false);
    }
  };

  const updateBedtime = (value: string) => {
    setBedtime(value);
    const ready = wakeTime !== null && isLucidLocalTime(value) && isLucidLocalTime(wakeTime);
    persistSelection({
      draftStep: 1,
      sleepScheduleDraft: { bedtime: value, wakeTime },
      sleepScheduleConfirmed: ready,
      ...(ready ? { sleepSchedule: { bedtime: value, wakeTime, timeZone } } : {}),
    });
  };
  const updateWakeTime = (value: string) => {
    setWakeTime(value);
    const ready = bedtime !== null && isLucidLocalTime(bedtime) && isLucidLocalTime(value);
    persistSelection({
      draftStep: 1,
      sleepScheduleDraft: { bedtime, wakeTime: value },
      sleepScheduleConfirmed: ready,
      ...(ready ? { sleepSchedule: { bedtime, wakeTime: value, timeZone } } : {}),
    });
  };

  const titles = [copy.intentionTitle, copy.sleepTitle, copy.weekTitle, copy.localTitle];
  const reduceMotion = state!.onboarding.accessibility.reduceMotion;
  const reflow = width < 380 || fontScale >= 1.3;
  const stageMinHeight = reflow ? Math.max(720, height - 160) : Math.max(540, height - 250);

  return (
    <LucidScreen
      testID="lucid-onboarding"
      background={<LucidOnboardingBackdrop ambience={ambience} reduceMotion={reduceMotion} step={step} />}
      bottomInset={112}
      contentStyle={styles.screenContent}
      eyebrow={`${legacyCopy.step} ${step + 1} / ${STEP_COUNT}`}
      eyebrowTone="accent"
      scroll
      footer={
        <View style={styles.primaryAction}>
          <LucidButton
            label={step === STEP_COUNT - 1 ? copy.finish : content.chrome.common.continue}
            disabled={!canContinue}
            disabledReason={blockedReason}
            loading={saving}
            onPress={() => void next()}
            icon={step === STEP_COUNT - 1 ? 'sparkles' : 'arrow-forward'}
            testID="lucid-onboarding-continue"
          />
        </View>
      }
    >
      <View style={styles.progressRow}>
        <LucidSegmentedProgress current={step + 1} label={titles[step]} total={STEP_COUNT} />
        {step > 0 ? (
          <LucidIconAction
            icon="arrow-back"
            label={content.chrome.common.back}
            onPress={() => void back()}
            variant="immersive"
          />
        ) : null}
      </View>

      <LucidOnboardingStage
        direction={stepDirection}
        reduceMotion={reduceMotion}
        step={step}
        style={[styles.stage, { minHeight: stageMinHeight }]}
      >
        {step === 0 ? (
          <View style={styles.stepStack}>
            <OnboardingHeader title={copy.intentionTitle} subtitle={copy.intentionSubtitle} />
            <View accessibilityRole="radiogroup" accessibilityLabel={copy.goalLabel} style={styles.choiceGroup}>
              <LucidOverline text={copy.goalLabel} tone="accent" />
              {content.onboarding.goals.map((choice) => (
                <LucidChoiceCard
                  description={choice.description}
                  key={choice.id}
                  onPress={() => {
                    setGoal(choice.id);
                    persistSelection({ goal: choice.id, draftStep: 0 });
                  }}
                  selected={goal === choice.id}
                  testID={`lucid-goal-${choice.id}`}
                  title={choice.title}
                />
              ))}
            </View>
            <View accessibilityRole="radiogroup" accessibilityLabel={copy.experienceLabel} style={styles.choiceGroup}>
              <LucidOverline text={copy.experienceLabel} tone="accent" />
              {content.onboarding.experienceLevels.map((choice) => (
                <LucidChoiceCard
                  description={choice.description}
                  key={choice.id}
                  onPress={() => {
                    setExperience(choice.id);
                    persistSelection({ experience: choice.id, draftStep: 0 });
                  }}
                  selected={experience === choice.id}
                  testID={`lucid-experience-${choice.id}`}
                  title={choice.title}
                />
              ))}
            </View>
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.stepStack}>
            <OnboardingHeader title={copy.sleepTitle} subtitle={copy.sleepSubtitle} />
            <SleepWindowPicker
              bedtime={bedtime}
              bedtimeLabel={legacyCopy.bed}
              cancelLabel={content.chrome.common.cancel}
              doneLabel={content.chrome.common.done}
              locale={locale}
              notSetLabel={copy.notSet}
              onBedtimeChange={updateBedtime}
              onWakeTimeChange={updateWakeTime}
              pickerHint={legacyCopy.timePickerHint}
              reflow={reflow}
              wakeLabel={legacyCopy.wake}
              wakeTime={wakeTime}
            />
            <View accessibilityRole="radiogroup" accessibilityLabel={copy.sensitivityLabel} style={styles.choiceGroup}>
              <LucidOverline text={copy.sensitivityLabel} tone="accent" />
              <LucidChoiceCard
                description={copy.sensitiveDescription}
                onPress={() => {
                  setWakeSensitivity('sensitive');
                  persistSelection({ wakeSensitivity: 'sensitive', draftStep: 1 });
                }}
                selected={wakeSensitivity === 'sensitive'}
                testID="lucid-wake-sensitivity-sensitive"
                title={copy.sensitiveTitle}
              />
              <LucidChoiceCard
                description={copy.notSensitiveDescription}
                onPress={() => {
                  setWakeSensitivity('not_sensitive');
                  persistSelection({ wakeSensitivity: 'not_sensitive', draftStep: 1 });
                }}
                selected={wakeSensitivity === 'not_sensitive'}
                testID="lucid-wake-sensitivity-not_sensitive"
                title={copy.notSensitiveTitle}
              />
            </View>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.stepStack}>
            <OnboardingHeader title={copy.weekTitle} subtitle={copy.weekSubtitle} />
            <LucidCard testID="lucid-onboarding-plan" style={styles.planCard}>
              <PlanRow icon="sunny-outline" title={copy.morningTitle} detail={copy.morningDetail} />
              <PlanRow icon="eye-outline" title={copy.trainingTitle} detail={copy.trainingDetail(initial.weeklyTarget)} />
              <PlanRow icon="moon-outline" title={copy.ritualTitle} detail={planRitual} />
              <PlanRow
                icon="shield-checkmark-outline"
                title={copy.restrictionsTitle}
                detail={`${plan.allowWbtb ? copy.wbtbAllowed : copy.wbtbBlocked} ${plan.allowNightSignals ? copy.signalsAllowed : copy.signalsBlocked}`}
              />
              <View style={[styles.planReason, { borderTopColor: palette.border }]}>
                <LucidOverline text={copy.reasonLabel} tone="amber" />
                <Text style={[styles.planReasonText, { color: palette.textSecondary }]}>{planReason}</Text>
              </View>
            </LucidCard>
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.stepStack} testID="lucid-onboarding-local-first">
            <OnboardingHeader title={copy.localTitle} subtitle={copy.localSubtitle} />
            <LucidCard accessibilityLabel={`${copy.localStorageTitle}. ${copy.localStorageDetail}`}>
              <PlanRow icon="phone-portrait-outline" title={copy.localStorageTitle} detail={copy.localStorageDetail} />
            </LucidCard>
            <LucidCard accessibilityLabel={`${copy.noAccountTitle}. ${copy.noAccountDetail}`}>
              <PlanRow icon="person-outline" title={copy.noAccountTitle} detail={copy.noAccountDetail} />
            </LucidCard>
            <LucidCard accessibilityLabel={`${copy.permissionsTitle}. ${copy.permissionsDetail}`}>
              <PlanRow icon="key-outline" title={copy.permissionsTitle} detail={copy.permissionsDetail} />
            </LucidCard>
          </View>
        ) : null}
      </LucidOnboardingStage>
      {saveError ? (
        <Text accessibilityLiveRegion="assertive" style={[styles.errorText, { color: palette.danger }]}>
          {saveError}
        </Text>
      ) : null}
    </LucidScreen>
  );
}

function OnboardingHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  return (
    <View style={styles.sectionHeader}>
      <Text accessibilityRole="header" style={[styles.immersiveTitle, { color: palette.text }]}>{title}</Text>
      <Text style={[styles.introSubtitle, { color: palette.textSecondary }]}>{subtitle}</Text>
    </View>
  );
}

function PlanRow({
  icon,
  title,
  detail,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  detail: string;
}) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  return (
    <View style={styles.planRow}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.planIcon, { backgroundColor: palette.accentSoft }]}>
        <Ionicons color={palette.accentOn} name={icon} size={LucidIcon.md} />
      </View>
      <View style={styles.planCopy}>
        <Text style={[styles.planTitle, { color: palette.text }]}>{title}</Text>
        <Text style={[styles.planDetail, { color: palette.textSecondary }]}>{detail}</Text>
      </View>
    </View>
  );
}

type SleepTimeField = 'bedtime' | 'wakeTime';

const PICKER_LOCALES = {
  en: 'en_US',
  fr: 'fr_FR',
  es: 'es_ES',
  de: 'de_DE',
  it: 'it_IT',
} as const;

function localTimeToDate(value: string | null, fallback: string) {
  const normalized = isLucidLocalTime(value) ? value : fallback;
  const [hours, minutes] = normalized.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function dateToLocalTime(value: Date) {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

function SleepWindowPicker({
  bedtime,
  bedtimeLabel,
  cancelLabel,
  doneLabel,
  locale,
  notSetLabel,
  onBedtimeChange,
  onWakeTimeChange,
  pickerHint,
  reflow,
  wakeLabel,
  wakeTime,
}: {
  bedtime: string | null;
  bedtimeLabel: string;
  cancelLabel: string;
  doneLabel: string;
  locale: keyof typeof PICKER_LOCALES;
  notSetLabel: string;
  onBedtimeChange: (value: string) => void;
  onWakeTimeChange: (value: string) => void;
  pickerHint: string;
  reflow: boolean;
  wakeLabel: string;
  wakeTime: string | null;
}) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const [activePicker, setActivePicker] = useState<SleepTimeField | null>(null);
  const [pendingTime, setPendingTime] = useState(() => localTimeToDate(bedtime, '22:30'));

  const openPicker = (field: SleepTimeField) => {
    setPendingTime(localTimeToDate(field === 'bedtime' ? bedtime : wakeTime, field === 'bedtime' ? '22:30' : '07:00'));
    setActivePicker(field);
  };

  const commitPendingTime = (date: Date) => {
    if (activePicker === 'bedtime') onBedtimeChange(dateToLocalTime(date));
    if (activePicker === 'wakeTime') onWakeTimeChange(dateToLocalTime(date));
    setActivePicker(null);
  };

  const activeLabel = activePicker === 'bedtime' ? bedtimeLabel : wakeLabel;
  const activePickerTestID = activePicker === 'wakeTime'
    ? 'lucid-sleep-wake-time-picker'
    : 'lucid-sleep-bedtime-picker';

  return (
    <>
      <View style={[styles.sleepWindowControl, reflow && styles.sleepWindowControlReflow]}>
        {!reflow ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.sleepArc,
              {
                borderLeftColor: palette.accentStrong,
                borderRightColor: palette.amber,
                borderTopColor: palette.textSecondary,
              },
            ]}
          />
        ) : null}
        <View style={[styles.timeChoicesRow, reflow && styles.timeChoicesRowReflow]}>
          <SleepTimeChoice
            active={activePicker === 'bedtime'}
            icon="moon-outline"
            label={bedtimeLabel}
            onPress={() => openPicker('bedtime')}
            notSetLabel={notSetLabel}
            pickerHint={pickerHint}
            reflow={reflow}
            testID="lucid-sleep-bedtime"
            tone="accent"
            valid={bedtime === null ? null : isLucidLocalTime(bedtime)}
            value={bedtime}
          />
          <SleepTimeChoice
            active={activePicker === 'wakeTime'}
            icon="sunny-outline"
            label={wakeLabel}
            onPress={() => openPicker('wakeTime')}
            notSetLabel={notSetLabel}
            pickerHint={pickerHint}
            reflow={reflow}
            testID="lucid-sleep-wake-time"
            tone="amber"
            valid={wakeTime === null ? null : isLucidLocalTime(wakeTime)}
            value={wakeTime}
          />
        </View>
      </View>

      {activePicker && Platform.OS === 'android' ? (
        <DateTimePicker
          accentColor={palette.accentStrong}
          display="default"
          is24Hour
          mode="time"
          negativeButton={{ label: cancelLabel }}
          onDismiss={() => setActivePicker(null)}
          onValueChange={(_event, date) => commitPendingTime(date)}
          positiveButton={{ label: doneLabel }}
          presentation="dialog"
          style={styles.nativePickerAnchor}
          testID={activePickerTestID}
          value={pendingTime}
        />
      ) : null}

      <Modal
        accessibilityViewIsModal
        onRequestClose={() => setActivePicker(null)}
        transparent
        visible={activePicker !== null && Platform.OS !== 'android'}
      >
        <View style={styles.pickerModalRoot}>
          <View style={[styles.pickerSheet, { backgroundColor: palette.surface }]}>
            <Text accessibilityRole="header" style={[styles.pickerTitle, { color: palette.text }]}>
              {activeLabel}
            </Text>
            {activePicker ? (
              <DateTimePicker
                accentColor={palette.accentStrong}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                locale={PICKER_LOCALES[locale]}
                mode="time"
                onValueChange={(_event, date) => setPendingTime(date)}
                style={Platform.OS === 'ios' ? styles.pickerSpinner : styles.pickerWebInput}
                testID={activePickerTestID}
                themeVariant="dark"
                value={pendingTime}
              />
            ) : null}
            <View style={styles.pickerActions}>
              <View style={styles.pickerAction}>
                <LucidButton label={cancelLabel} onPress={() => setActivePicker(null)} variant="secondary" />
              </View>
              <View style={styles.pickerAction}>
                <LucidButton label={doneLabel} onPress={() => commitPendingTime(pendingTime)} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function SleepTimeChoice({
  active,
  icon,
  label,
  notSetLabel,
  onPress,
  pickerHint,
  reflow,
  testID,
  tone,
  valid,
  value,
}: {
  active: boolean;
  icon: 'moon-outline' | 'sunny-outline';
  label: string;
  notSetLabel: string;
  onPress: () => void;
  pickerHint: string;
  reflow: boolean;
  testID: string;
  tone: 'accent' | 'amber';
  valid: boolean | null;
  value: string | null;
}) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const toneColor = tone === 'accent' ? palette.accentStrong : palette.amber;
  const toneSurface = tone === 'accent' ? palette.accentSoft : palette.amberSoft;
  const displayValue = value ?? notSetLabel;
  const borderColor = valid === false ? palette.danger : toneColor;
  const valueColor = valid === false ? palette.danger : value === null ? palette.textSecondary : toneColor;

  return (
    <Pressable
      accessibilityHint={pickerHint}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ expanded: active }}
      accessibilityValue={{ text: displayValue }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.timeChoice,
        reflow && styles.timeChoiceReflow,
        reflow && { backgroundColor: palette.overlay, borderColor },
        pressed && styles.timeChoicePressed,
      ]}
      testID={testID}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.timeNodeFrame,
          {
            backgroundColor: toneSurface,
            borderColor,
            opacity: active ? 1 : 0.86,
          },
        ]}
      >
        <View style={[styles.timeNode, { backgroundColor: value === null ? toneSurface : borderColor }]} />
      </View>
      <View style={[styles.timeChoiceCopy, reflow && styles.timeChoiceCopyReflow]}>
        <Ionicons color={toneColor} name={icon} size={LucidIcon.lg} />
        <Text style={[styles.timeValue, { color: valueColor }]}>{displayValue}</Text>
        <Text style={[styles.timeLabel, { color: toneColor }]}>· {label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screenContent: { gap: LucidSpace.md },
  progressRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: LucidSpace.lg },
  stage: { position: 'relative' },
  stepStack: { flex: 1, gap: LucidSpace.xl },
  sectionHeader: { gap: LucidSpace.sm },
  choiceGroup: { gap: LucidSpace.md },
  planCard: { gap: LucidSpace.lg },
  planRow: { flexDirection: 'row', alignItems: 'flex-start', gap: LucidSpace.md },
  planIcon: {
    width: 40,
    height: 40,
    borderRadius: LucidRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planCopy: { flex: 1, gap: LucidSpace.xs },
  planTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.body[0],
    lineHeight: LucidType.body[1],
  },
  planDetail: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.bodySm[0],
    lineHeight: LucidType.bodySm[1],
  },
  planReason: { borderTopWidth: 1, paddingTop: LucidSpace.lg, gap: LucidSpace.sm },
  planReasonText: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: LucidType.bodySm[0],
    lineHeight: LucidType.bodySm[1],
  },
  errorText: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: LucidType.bodySm[0],
    lineHeight: LucidType.bodySm[1],
    textAlign: 'center',
  },
  immersiveTitle: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: LucidType.display[0],
    lineHeight: LucidType.display[1],
    letterSpacing: -0.8,
  },
  introSubtitle: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.bodySm[0],
    lineHeight: LucidType.bodySm[1],
  },
  // L'arc reprend les proportions de la cible 393dp : il s'aplatit avant que
  // ses deux cibles de 52dp ne se touchent, puis disparaît dans le reflow.
  sleepWindowControl: { minHeight: 206, position: 'relative' },
  sleepWindowControlReflow: { minHeight: 0 },
  sleepArc: {
    position: 'absolute',
    top: LucidSpace.md,
    left: 52,
    right: 52,
    height: 84,
    borderTopLeftRadius: LucidRadius.full,
    borderTopRightRadius: LucidRadius.full,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
  },
  timeChoicesRow: {
    position: 'absolute',
    top: 74,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeChoicesRowReflow: {
    position: 'relative',
    top: 0,
    flexDirection: 'column',
    gap: LucidSpace.md,
  },
  timeChoice: {
    width: 104,
    minHeight: 136,
    alignItems: 'center',
    borderRadius: LucidRadius.full,
    paddingVertical: LucidSpace.sm,
  },
  timeChoiceReflow: {
    width: '100%',
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: LucidSpace.md,
    borderWidth: 1,
    paddingHorizontal: LucidSpace.md,
    paddingVertical: LucidSpace.md,
  },
  timeChoicePressed: { opacity: 0.78 },
  timeNodeFrame: {
    width: 44,
    height: 44,
    borderRadius: LucidRadius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeNode: { width: 24, height: 24, borderRadius: LucidRadius.full },
  timeChoiceCopy: { alignItems: 'center', gap: LucidSpace.xs, paddingTop: LucidSpace.sm },
  timeChoiceCopyReflow: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', paddingTop: 0 },
  timeValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.h3[0],
    lineHeight: LucidType.h3[1],
    fontVariant: ['tabular-nums'],
  },
  timeLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.overline[0],
    lineHeight: LucidType.overline[1],
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  nativePickerAnchor: { width: 1, height: 1 },
  pickerModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(3, 11, 16, 0.74)',
  },
  pickerSheet: {
    borderTopLeftRadius: LucidRadius.xl,
    borderTopRightRadius: LucidRadius.xl,
    paddingHorizontal: LucidSpace.gutter,
    paddingTop: LucidSpace.xl,
    paddingBottom: LucidSpace.gutter,
    gap: LucidSpace.lg,
  },
  pickerTitle: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: LucidType.h2[0],
    lineHeight: LucidType.h2[1],
    textAlign: 'center',
  },
  pickerSpinner: { width: '100%', minHeight: 180 },
  pickerWebInput: { width: '100%', minHeight: 54 },
  pickerActions: { flexDirection: 'row', gap: LucidSpace.md },
  pickerAction: { flex: 1 },
  primaryAction: { width: '100%' },
});
