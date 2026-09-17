import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { LucidGuideOrb } from '@/components/lucid/LucidGuideOrb';
import {
  LucidButton,
  LucidCard,
  LucidChoiceCard,
  LucidIconAction,
  LucidIconTile,
  LucidScreen,
} from '@/components/lucid/LucidUI';
import { PressableScale } from '@/components/motion/PressableScale';
import {
  getLucidPalette,
  LucidIcon,
  LucidRadius,
  LucidSpace,
  LucidType,
} from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import {
  MAX_LUCID_REALITY_CHECK_RESPONSE_LENGTH,
  persistLucidMindfulPauseTrigger,
  type LucidMindfulPauseTrigger,
  type LucidRealityCheckMethod,
  type LucidRealityCheckOutcome,
} from '@/lib/lucid/model';
import { closeLucidRoute, LUCID_HOME_HREF } from '@/lib/lucid/routes';

export const LUCID_MINDFUL_HOLD_DURATION_MS = 2_000;

export function getLucidMindfulHoldTransitionDuration(
  reduceMotion: boolean,
  holdActive: boolean,
): `${number}ms` {
  return holdActive && !reduceMotion ? `${LUCID_MINDFUL_HOLD_DURATION_MS}ms` : '0ms';
}

const METHODS: LucidRealityCheckMethod[] = [
  'nose_breathing',
  'finger_count',
  'text_reread',
  'memory_trace',
];
const TRIGGERS = [
  'scheduled',
  'transition',
  'emotion',
  'unusual_event',
  'dream_sign',
] as const satisfies readonly LucidMindfulPauseTrigger[];
const OUTCOMES: LucidRealityCheckOutcome[] = ['awake', 'dreaming', 'uncertain'];
const STEP_COUNT = 5;

const EN_COPY = {
  eyebrow: 'Mindful pause',
  title: 'Is this a dream?',
  subtitle: 'Interrupt autopilot for about twenty seconds. Notice evidence before choosing an answer.',
  guide: 'Lucid guide',
  progress: 'Mindful-pause progress',
  step: 'Step',
  of: 'of',
  complete: 'complete',
  current: 'current',
  upcoming: 'upcoming',
  previous: 'Previous step',
  stop: 'Stop',
  observe: 'Observe',
  retrace: 'Retrace',
  test: 'Test',
  intend: 'Intend',
  stopPrompt: 'Hold for two seconds',
  stopBody: 'Keep your finger down long enough to leave autopilot. No answer has been chosen for you.',
  holdAction: 'Hold to stop',
  holdHint: 'Keep holding for two seconds. Releasing early resets the hold.',
  accessibleAlternative: 'Use accessible alternative',
  holdComplete: 'Pause complete',
  continueObserve: 'Continue to observation',
  observePrompt: 'Could any detail here be impossible?',
  observeBody: 'Write only what you notice, then name the anchor that brought you here.',
  observedDetail: 'Observed detail',
  observedPlaceholder: 'For example: the clock, light, text…',
  context: 'What anchored this pause?',
  continueRetrace: 'Continue to reconstruction',
  retracePrompt: 'How did you arrive here?',
  retraceBody: 'Reconstruct the last transition in one short sentence.',
  arrivalPath: 'Path to this moment',
  arrivalPlaceholder: 'I left… then…',
  continueTest: 'Continue to the test',
  testPrompt: 'Perform one test slowly',
  testBody: 'Choose the test, perform it, then record only what happened.',
  method: 'Choose a check',
  outcome: 'What did you notice?',
  awake: 'Awake',
  dreaming: 'Dreaming',
  uncertain: 'Unsure',
  continueIntention: 'Continue to intention',
  intendPrompt: 'Prepare the next dream',
  intendBody: 'Form one simple if–then intention connected to what you noticed.',
  nextDreamIntention: 'Next-dream intention',
  intentionPlaceholder: 'If I notice this again, I will…',
  mindful: 'I genuinely paused before answering.',
  save: 'Save mindful pause',
  saved: 'Pause saved',
  incomplete: 'Still to answer:',
  nose_breathing: 'Pinch nose and breathe',
  finger_count: 'Count your fingers twice',
  text_reread: 'Read, look away, read again',
  memory_trace: 'Trace the last few minutes',
  transition: 'Place or activity change',
  emotion: 'Strong emotion',
  scheduled: 'Scheduled reminder',
  unusual_event: 'Unusual event',
  dream_sign: 'Confirmed dream sign',
  chooseSign: 'Which confirmed sign?',
  noConfirmedSign: 'Confirm a dream sign in your Journal first.',
} as const;

const COPY = {
  en: EN_COPY,
  fr: {
    ...EN_COPY,
    eyebrow: 'Pause consciente', title: 'Est-ce un rêve ?', subtitle: 'Interrompez le pilote automatique pendant une vingtaine de secondes. Observez avant de conclure.', guide: 'Guide lucide', progress: 'Progression de la pause consciente', step: 'Étape', of: 'sur', complete: 'terminée', current: 'en cours', upcoming: 'à venir', previous: 'Étape précédente', stop: 'S’arrêter', observe: 'Observer', retrace: 'Retracer', test: 'Tester', intend: 'Intention', stopPrompt: 'Maintenez pendant deux secondes', stopBody: 'Gardez le doigt posé assez longtemps pour quitter le pilote automatique. Aucune réponse n’est choisie pour vous.', holdAction: 'Maintenir pour s’arrêter', holdHint: 'Maintenez deux secondes. Relâcher trop tôt réinitialise le maintien.', accessibleAlternative: 'Utiliser l’alternative accessible', holdComplete: 'Pause terminée', continueObserve: 'Continuer vers l’observation', observePrompt: 'Un détail pourrait-il être impossible ?', observeBody: 'Écrivez seulement ce que vous remarquez, puis nommez l’ancrage qui vous a amené ici.', observedDetail: 'Détail observé', observedPlaceholder: 'Par exemple : l’horloge, la lumière, un texte…', context: 'Quel ancrage a déclenché cette pause ?', continueRetrace: 'Continuer vers la reconstruction', retracePrompt: 'Comment êtes-vous arrivé ici ?', retraceBody: 'Reconstruisez la dernière transition en une phrase courte.', arrivalPath: 'Chemin vers cet instant', arrivalPlaceholder: 'J’ai quitté… puis…', continueTest: 'Continuer vers le test', testPrompt: 'Effectuez lentement un test', testBody: 'Choisissez le test, réalisez-le, puis notez seulement ce qui s’est passé.', method: 'Choisissez un test', outcome: 'Qu’avez-vous observé ?', awake: 'Éveillé', dreaming: 'En rêve', uncertain: 'Incertain', continueIntention: 'Continuer vers l’intention', intendPrompt: 'Préparez le prochain rêve', intendBody: 'Formez une intention simple « si… alors… » liée à votre observation.', nextDreamIntention: 'Intention pour le prochain rêve', intentionPlaceholder: 'Si je remarque cela à nouveau, je…', mindful: 'J’ai réellement fait une pause avant de répondre.', save: 'Enregistrer la pause', saved: 'Pause enregistrée', incomplete: 'À renseigner :', nose_breathing: 'Pincer le nez et respirer', finger_count: 'Compter deux fois ses doigts', text_reread: 'Lire, détourner le regard, relire', memory_trace: 'Retracer les dernières minutes', transition: 'Changement de lieu ou d’activité', emotion: 'Émotion forte', scheduled: 'Rappel planifié', unusual_event: 'Événement inhabituel', dream_sign: 'Signe onirique confirmé', chooseSign: 'Quel signe confirmé ?', noConfirmedSign: 'Confirmez d’abord un signe onirique dans votre Journal.',
  },
  es: {
    ...EN_COPY,
    eyebrow: 'Pausa consciente', title: '¿Es esto un sueño?', subtitle: 'Interrumpe el piloto automático unos veinte segundos. Observa antes de concluir.', guide: 'Guía lúcida', progress: 'Progreso de la pausa consciente', step: 'Paso', of: 'de', complete: 'completado', current: 'actual', upcoming: 'próximo', previous: 'Paso anterior', stop: 'Detenerse', observe: 'Observar', retrace: 'Reconstruir', test: 'Comprobar', intend: 'Intención', stopPrompt: 'Mantén pulsado dos segundos', stopBody: 'Mantén el dedo el tiempo suficiente para salir del piloto automático. No hay ninguna respuesta elegida.', holdAction: 'Mantener para detenerse', holdHint: 'Mantén dos segundos. Soltar antes reinicia la espera.', accessibleAlternative: 'Usar alternativa accesible', holdComplete: 'Pausa completada', continueObserve: 'Continuar a la observación', observePrompt: '¿Podría ser imposible algún detalle?', observeBody: 'Escribe solo lo que notas y nombra el anclaje que te trajo aquí.', observedDetail: 'Detalle observado', observedPlaceholder: 'Por ejemplo: el reloj, la luz, un texto…', context: '¿Qué ancló esta pausa?', continueRetrace: 'Continuar a la reconstrucción', retracePrompt: '¿Cómo llegaste aquí?', retraceBody: 'Reconstruye la última transición en una frase corta.', arrivalPath: 'Camino hasta este momento', arrivalPlaceholder: 'Salí de… y luego…', continueTest: 'Continuar a la prueba', testPrompt: 'Realiza una prueba despacio', testBody: 'Elige la prueba, hazla y registra solo lo ocurrido.', method: 'Elige una prueba', outcome: '¿Qué notaste?', awake: 'Despierto', dreaming: 'Soñando', uncertain: 'Inseguro', continueIntention: 'Continuar a la intención', intendPrompt: 'Prepara el próximo sueño', intendBody: 'Forma una intención sencilla «si… entonces…» conectada con lo observado.', nextDreamIntention: 'Intención para el próximo sueño', intentionPlaceholder: 'Si vuelvo a notar esto, voy a…', mindful: 'Me detuve de verdad antes de responder.', save: 'Guardar pausa', saved: 'Pausa guardada', incomplete: 'Falta responder:', nose_breathing: 'Tapar la nariz y respirar', finger_count: 'Contar los dedos dos veces', text_reread: 'Leer, apartar la vista y releer', memory_trace: 'Reconstruir los últimos minutos', transition: 'Cambio de lugar o actividad', emotion: 'Emoción fuerte', scheduled: 'Recordatorio programado', unusual_event: 'Suceso inusual', dream_sign: 'Señal onírica confirmada', chooseSign: '¿Qué señal confirmada?', noConfirmedSign: 'Confirma primero una señal onírica en tu Diario.',
  },
  de: {
    ...EN_COPY,
    eyebrow: 'Bewusste Pause', title: 'Ist das ein Traum?', subtitle: 'Unterbrich den Autopiloten etwa zwanzig Sekunden. Beobachte, bevor du entscheidest.', guide: 'Klartraum-Guide', progress: 'Fortschritt der bewussten Pause', step: 'Schritt', of: 'von', complete: 'abgeschlossen', current: 'aktuell', upcoming: 'als Nächstes', previous: 'Vorheriger Schritt', stop: 'Anhalten', observe: 'Beobachten', retrace: 'Zurückverfolgen', test: 'Prüfen', intend: 'Absicht', stopPrompt: 'Zwei Sekunden gedrückt halten', stopBody: 'Halte den Finger lange genug, um den Autopiloten zu verlassen. Keine Antwort ist vorausgewählt.', holdAction: 'Zum Anhalten halten', holdHint: 'Zwei Sekunden halten. Frühes Loslassen setzt den Vorgang zurück.', accessibleAlternative: 'Barrierefreie Alternative nutzen', holdComplete: 'Pause abgeschlossen', continueObserve: 'Weiter zur Beobachtung', observePrompt: 'Könnte hier ein Detail unmöglich sein?', observeBody: 'Schreibe nur auf, was dir auffällt, und benenne den Anker.', observedDetail: 'Beobachtetes Detail', observedPlaceholder: 'Zum Beispiel: Uhr, Licht, Text…', context: 'Was hat diese Pause verankert?', continueRetrace: 'Weiter zur Rekonstruktion', retracePrompt: 'Wie bist du hierher gekommen?', retraceBody: 'Rekonstruiere den letzten Übergang in einem kurzen Satz.', arrivalPath: 'Weg zu diesem Moment', arrivalPlaceholder: 'Ich verließ… dann…', continueTest: 'Weiter zum Test', testPrompt: 'Führe einen Test langsam aus', testBody: 'Wähle den Test, führe ihn aus und notiere nur das Ergebnis.', method: 'Test wählen', outcome: 'Was hast du bemerkt?', awake: 'Wach', dreaming: 'Träumend', uncertain: 'Unsicher', continueIntention: 'Weiter zur Absicht', intendPrompt: 'Bereite den nächsten Traum vor', intendBody: 'Forme eine einfache Wenn-dann-Absicht passend zu deiner Beobachtung.', nextDreamIntention: 'Absicht für den nächsten Traum', intentionPlaceholder: 'Wenn ich das wieder bemerke, werde ich…', mindful: 'Ich habe vor der Antwort wirklich innegehalten.', save: 'Pause speichern', saved: 'Pause gespeichert', incomplete: 'Noch offen:', nose_breathing: 'Nase zuhalten und atmen', finger_count: 'Finger zweimal zählen', text_reread: 'Lesen, wegsehen, erneut lesen', memory_trace: 'Letzte Minuten nachvollziehen', transition: 'Orts- oder Aktivitätswechsel', emotion: 'Starkes Gefühl', scheduled: 'Geplante Erinnerung', unusual_event: 'Ungewöhnliches Ereignis', dream_sign: 'Bestätigtes Traumzeichen', chooseSign: 'Welches bestätigte Zeichen?', noConfirmedSign: 'Bestätige zuerst ein Traumzeichen im Journal.',
  },
  it: {
    ...EN_COPY,
    eyebrow: 'Pausa consapevole', title: 'È un sogno?', subtitle: 'Interrompi il pilota automatico per circa venti secondi. Osserva prima di concludere.', guide: 'Guida lucida', progress: 'Avanzamento della pausa consapevole', step: 'Passaggio', of: 'di', complete: 'completato', current: 'attuale', upcoming: 'successivo', previous: 'Passaggio precedente', stop: 'Fermarsi', observe: 'Osservare', retrace: 'Ricostruire', test: 'Verificare', intend: 'Intenzione', stopPrompt: 'Tieni premuto per due secondi', stopBody: 'Tieni il dito abbastanza a lungo da uscire dal pilota automatico. Nessuna risposta è preselezionata.', holdAction: 'Tieni premuto per fermarti', holdHint: 'Tieni premuto due secondi. Rilasciare prima azzera l’attesa.', accessibleAlternative: 'Usa alternativa accessibile', holdComplete: 'Pausa completata', continueObserve: 'Continua all’osservazione', observePrompt: 'Un dettaglio potrebbe essere impossibile?', observeBody: 'Scrivi solo ciò che noti e indica l’ancora che ti ha portato qui.', observedDetail: 'Dettaglio osservato', observedPlaceholder: 'Per esempio: orologio, luce, testo…', context: 'Cosa ha ancorato questa pausa?', continueRetrace: 'Continua alla ricostruzione', retracePrompt: 'Come sei arrivato qui?', retraceBody: 'Ricostruisci l’ultima transizione in una frase breve.', arrivalPath: 'Percorso fino a questo momento', arrivalPlaceholder: 'Ho lasciato… poi…', continueTest: 'Continua al test', testPrompt: 'Esegui lentamente un test', testBody: 'Scegli il test, eseguilo e registra solo ciò che è successo.', method: 'Scegli un test', outcome: 'Cosa hai notato?', awake: 'Sveglio', dreaming: 'In sogno', uncertain: 'Incerto', continueIntention: 'Continua all’intenzione', intendPrompt: 'Prepara il prossimo sogno', intendBody: 'Forma una semplice intenzione «se… allora…» collegata a ciò che hai notato.', nextDreamIntention: 'Intenzione per il prossimo sogno', intentionPlaceholder: 'Se lo noto di nuovo, allora…', mindful: 'Mi sono davvero fermato prima di rispondere.', save: 'Salva pausa', saved: 'Pausa salvata', incomplete: 'Ancora da indicare:', nose_breathing: 'Chiudi il naso e respira', finger_count: 'Conta le dita due volte', text_reread: 'Leggi, distogli lo sguardo, rileggi', memory_trace: 'Ripercorri gli ultimi minuti', transition: 'Cambio di luogo o attività', emotion: 'Emozione forte', scheduled: 'Promemoria programmato', unusual_event: 'Evento insolito', dream_sign: 'Segnale onirico confermato', chooseSign: 'Quale segnale confermato?', noConfirmedSign: 'Conferma prima un segnale onirico nel Diario.',
  },
} as const;

type StepIndex = 0 | 1 | 2 | 3 | 4;

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default function LucidRealityCheckScreen() {
  const params = useLocalSearchParams<{ signId?: string | string[] }>();
  const targetedSignId = firstParam(params.signId);

  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const systemReduceMotion = useReducedMotion();
  const { content, state, activeDreamSigns = [], addRealityCheck } = useLucidTrainer();
  const copy = COPY[content.locale];
  const reduceMotion = systemReduceMotion || (state?.onboarding.accessibility?.reduceMotion ?? false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [step, setStep] = useState<StepIndex>(0);
  const [holdActive, setHoldActive] = useState(false);
  const [mindful, setMindful] = useState(false);
  const [observedDetail, setObservedDetail] = useState('');
  const [arrivalPath, setArrivalPath] = useState('');
  const [nextDreamIntention, setNextDreamIntention] = useState('');
  const [method, setMethod] = useState<LucidRealityCheckMethod | null>(null);
  const targetedDreamSignId = activeDreamSigns.some((sign) => sign.id === targetedSignId)
    ? targetedSignId
    : null;
  const [userChoseAnchor, setUserChoseAnchor] = useState(false);
  const [userTrigger, setUserTrigger] = useState<LucidMindfulPauseTrigger | null>(null);
  const [userSelectedDreamSignId, setUserSelectedDreamSignId] = useState<string | null>(null);
  const trigger = userChoseAnchor
    ? userTrigger
    : targetedDreamSignId
      ? 'dream_sign'
      : null;
  const selectedDreamSignId = userChoseAnchor
    ? userSelectedDreamSignId
    : targetedDreamSignId;
  const [outcome, setOutcome] = useState<LucidRealityCheckOutcome | null>(null);
  const [saving, setSaving] = useState(false);
  const steps = useMemo(() => [copy.stop, copy.observe, copy.retrace, copy.test, copy.intend] as const, [copy]);
  const prompts = useMemo(() => [copy.stopPrompt, copy.observePrompt, copy.retracePrompt, copy.testPrompt, copy.intendPrompt] as const, [copy]);
  const bodies = useMemo(() => [copy.stopBody, copy.observeBody, copy.retraceBody, copy.testBody, copy.intendBody] as const, [copy]);
  const selectedDreamSign = activeDreamSigns.find((sign) => sign.id === selectedDreamSignId);
  const close = () => closeLucidRoute(router, LUCID_HOME_HREF);
  const progressLabel = `${copy.progress}, ${copy.step} ${step + 1} ${copy.of} ${STEP_COUNT}, ${steps[step]}`;

  const clearHoldTimer = useCallback(() => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);
  const completeHold = useCallback(() => {
    clearHoldTimer();
    setHoldActive(false);
    setMindful(true);
    AccessibilityInfo?.announceForAccessibility?.(copy.holdComplete);
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [clearHoldTimer, copy.holdComplete]);
  const beginHold = () => {
    if (mindful || holdActive) return;
    clearHoldTimer();
    setHoldActive(true);
    holdTimer.current = setTimeout(completeHold, LUCID_MINDFUL_HOLD_DURATION_MS);
  };
  const cancelHold = () => {
    if (mindful) return;
    clearHoldTimer();
    setHoldActive(false);
  };

  useEffect(() => clearHoldTimer, [clearHoldTimer]);
  useEffect(() => { AccessibilityInfo?.announceForAccessibility?.(progressLabel); }, [progressLabel]);

  const missing = useMemo(() => {
    if (step === 0) return mindful ? [] : [copy.holdAction];
    if (step === 1) {
      const required: (string | null)[] = [
      observedDetail.trim() ? null : copy.observedDetail,
      trigger ? null : copy.context,
      trigger === 'dream_sign' && !selectedDreamSign ? copy.chooseSign : null,
      ];
      return required.filter((value): value is string => value !== null);
    }
    if (step === 2) return arrivalPath.trim() ? [] : [copy.arrivalPath];
    if (step === 3) {
      const required: (string | null)[] = [method ? null : copy.method, outcome ? null : copy.outcome];
      return required.filter((value): value is string => value !== null);
    }
    return nextDreamIntention.trim() ? [] : [copy.nextDreamIntention];
  }, [arrivalPath, copy, method, mindful, nextDreamIntention, observedDetail, outcome, selectedDreamSign, step, trigger]);

  const save = async () => {
    if (!mindful || !observedDetail.trim() || !arrivalPath.trim() || !nextDreamIntention.trim() || method === null || trigger === null || outcome === null || (trigger === 'dream_sign' && !selectedDreamSign)) return;
    setSaving(true);
    try {
      const persisted = persistLucidMindfulPauseTrigger(trigger);
      await addRealityCheck({
        method, ...persisted, outcome, mindful: true,
        observedDetail: observedDetail.trim(),
        arrivalPath: arrivalPath.trim(),
        nextDreamIntention: nextDreamIntention.trim(),
        ...(trigger === 'dream_sign' && selectedDreamSign ? { dreamSignId: selectedDreamSign.id, dreamSignLabel: selectedDreamSign.label } : {}),
      });
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(copy.saved, content.realityChecks.completionPrompt, [{ text: content.chrome.common.done, onPress: close }]);
    } finally {
      setSaving(false);
    }
  };
  const advance = () => {
    if (missing.length > 0) return;
    if (step === 4) void save();
    else setStep((step + 1) as StepIndex);
  };
  const actionLabels = [copy.continueObserve, copy.continueRetrace, copy.continueTest, copy.continueIntention, copy.save] as const;
  const progressTransition = {
    width: (holdActive || mindful ? '100%' : '0%') as `${number}%`,
    transitionProperty: 'width' as const,
    transitionDuration: getLucidMindfulHoldTransitionDuration(reduceMotion, holdActive),
    transitionTimingFunction: 'linear' as const,
  };

  return (
    <LucidScreen eyebrow={copy.eyebrow} trailing={<LucidIconAction label={content.chrome.common.cancel} icon="close" onPress={close} />} testID="lucid-reality-check" contentStyle={styles.screenContent} footer={
      <View style={styles.footerActions}>
        <LucidButton label={actionLabels[step]} icon={step === 4 ? 'checkmark' : 'arrow-forward'} disabled={missing.length > 0} disabledReason={`${copy.incomplete} ${missing.join(', ')}`} loading={saving} onPress={advance} testID="lucid-reality-save" />
        {step > 0 ? <PressableScale accessibilityRole="button" accessibilityLabel={copy.previous} onPress={() => setStep((step - 1) as StepIndex)} testID="lucid-reality-previous" style={styles.previousAction}><Text style={[styles.previousLabel, { color: palette.textSecondary }]}>{copy.previous}</Text></PressableScale> : null}
      </View>
    }>
      <View style={styles.hero}>
        <LucidGuideOrb accessibilityLabel={copy.guide} active={!saving} reduceMotion={reduceMotion} />
        <View style={styles.guideLabel}><Ionicons name="sparkles" size={LucidIcon.sm} color={palette.accent} /><Text style={[styles.guideText, { color: palette.accent }]}>{copy.guide}</Text></View>
        <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>{copy.title}</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{copy.subtitle}</Text>
      </View>
      <StepRail current={step} labels={steps} progressLabel={progressLabel} copy={copy} />
      <LucidCard accent="accent" style={styles.exerciseCard}>
        <View accessibilityLiveRegion="polite" style={styles.exerciseHeader} testID={`lucid-reality-step-${step + 1}`}>
          <Text style={[styles.stepLabel, { color: palette.accent }]}>{`${copy.step} ${step + 1} · ${steps[step]}`}</Text>
          <Text style={[styles.prompt, { color: palette.text }]}>{prompts[step]}</Text>
          <Text style={[styles.body, { color: palette.textSecondary }]}>{bodies[step]}</Text>
        </View>
        {step === 0 ? <View style={styles.group}>
          <Pressable accessibilityRole="button" accessibilityLabel={copy.holdAction} accessibilityHint={copy.holdHint} accessibilityState={{ selected: mindful }} onPressIn={beginHold} onPressOut={cancelHold} testID="lucid-reality-hold" style={[styles.holdButton, { backgroundColor: palette.surfaceRaised, borderColor: palette.accent }]}>
            <Animated.View pointerEvents="none" style={[styles.holdProgress, { backgroundColor: palette.accentSoft }, progressTransition]} />
            <Text style={[styles.holdLabel, { color: mindful ? palette.accentOn : palette.text }]}>{mindful ? copy.holdComplete : copy.holdAction}</Text>
          </Pressable>
          {!mindful ? <PressableScale accessibilityRole="button" accessibilityLabel={copy.accessibleAlternative} onPress={completeHold} testID="lucid-reality-hold-alternative" style={styles.alternativeAction}><Text style={[styles.previousLabel, { color: palette.textSecondary }]}>{copy.accessibleAlternative}</Text></PressableScale> : <View accessible accessibilityLabel={`${copy.holdComplete}. ${copy.mindful}`} style={[styles.confirmation, { backgroundColor: palette.accentSoft }]}><LucidIconTile icon="sparkles" tone="solid" size="sm" /><Text style={[styles.confirmationText, { color: palette.accentOn }]}>{copy.mindful}</Text></View>}
        </View> : null}
        {step === 1 ? <View style={styles.group}>
          <ShortResponseField label={copy.observedDetail} placeholder={copy.observedPlaceholder} value={observedDetail} onChangeText={setObservedDetail} testID="lucid-reality-observed-detail" />
          <View accessibilityRole="radiogroup" accessibilityLabel={copy.context} style={styles.wrap}>
            {TRIGGERS.map((item) => <LucidPillButton key={item} label={copy[item]} groupLabel={copy.context} selected={trigger === item} onPress={() => { const alreadyChose = userChoseAnchor; setUserChoseAnchor(true); setUserTrigger(item); setUserSelectedDreamSignId(item === 'dream_sign' ? alreadyChose ? userSelectedDreamSignId : targetedDreamSignId : null); }} testID={`lucid-reality-context-${item}`} />)}
            {trigger === 'dream_sign' ? activeDreamSigns.length > 0 ? <View accessibilityRole="radiogroup" accessibilityLabel={copy.chooseSign} style={styles.signChoices}>{activeDreamSigns.map((sign) => <LucidPillButton key={sign.id} label={sign.label} groupLabel={copy.chooseSign} selected={selectedDreamSignId === sign.id} onPress={() => { setUserChoseAnchor(true); setUserTrigger('dream_sign'); setUserSelectedDreamSignId(sign.id); }} testID={`lucid-reality-sign-${sign.id}`} />)}</View> : <Text style={[styles.body, styles.signHint, { color: palette.textSecondary }]}>{copy.noConfirmedSign}</Text> : null}
          </View>
        </View> : null}
        {step === 2 ? <ShortResponseField label={copy.arrivalPath} placeholder={copy.arrivalPlaceholder} value={arrivalPath} onChangeText={setArrivalPath} testID="lucid-reality-arrival-path" /> : null}
        {step === 3 ? <View style={styles.group}>
          <View accessibilityRole="radiogroup" accessibilityLabel={copy.method} style={styles.group}>{METHODS.map((item) => <LucidChoiceCard key={item} title={copy[item]} selected={method === item} onPress={() => setMethod(item)} icon={item === 'nose_breathing' ? 'fitness' : item === 'finger_count' ? 'hand-left' : item === 'text_reread' ? 'text' : 'time'} testID={`lucid-reality-method-${item}`} />)}</View>
          <View accessibilityRole="radiogroup" accessibilityLabel={copy.outcome} style={styles.wrap}>{OUTCOMES.map((item) => <LucidPillButton key={item} label={copy[item]} groupLabel={copy.outcome} selected={outcome === item} onPress={() => setOutcome(item)} testID={`lucid-reality-outcome-${item}`} />)}</View>
        </View> : null}
        {step === 4 ? <ShortResponseField label={copy.nextDreamIntention} placeholder={copy.intentionPlaceholder} value={nextDreamIntention} onChangeText={setNextDreamIntention} testID="lucid-reality-next-intention" /> : null}
      </LucidCard>
    </LucidScreen>
  );
}

function ShortResponseField({ label, placeholder, value, onChangeText, testID }: { label: string; placeholder: string; value: string; onChangeText: (value: string) => void; testID: string }) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  return <View style={styles.fieldGroup}><Text style={[styles.fieldLabel, { color: palette.text }]}>{label}</Text><TextInput accessibilityLabel={label} maxLength={MAX_LUCID_REALITY_CHECK_RESPONSE_LENGTH} multiline onChangeText={(next) => onChangeText(next.slice(0, MAX_LUCID_REALITY_CHECK_RESPONSE_LENGTH))} placeholder={placeholder} placeholderTextColor={palette.textMuted} style={[styles.textInput, { backgroundColor: palette.surfaceRaised, borderColor: palette.borderInteractive, color: palette.text }]} testID={testID} value={value} /></View>;
}

function StepRail({ current, labels, progressLabel, copy }: { current: StepIndex; labels: readonly [string, string, string, string, string]; progressLabel: string; copy: (typeof COPY)[keyof typeof COPY] }) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  return <View accessibilityRole="progressbar" accessibilityLabel={progressLabel} accessibilityValue={{ min: 1, max: STEP_COUNT, now: current + 1 }} style={styles.stepRail}>{labels.map((label, index) => {
    const complete = index < current;
    const selected = index === current;
    const stateLabel = complete ? copy.complete : selected ? copy.current : copy.upcoming;
    return <React.Fragment key={label}><View accessible accessibilityLabel={`${label}, ${stateLabel}`} accessibilityState={{ selected }} style={styles.stepItem}><View style={[styles.stepDot, { backgroundColor: complete || selected ? palette.accent : palette.surfaceRaised, borderColor: complete || selected ? palette.accent : palette.borderInteractive }]}>{complete ? <Ionicons color={palette.backgroundDeep} name="checkmark" size={LucidIcon.sm} /> : <Text style={[styles.stepDotText, { color: selected ? palette.backgroundDeep : palette.textMuted }]}>{index + 1}</Text>}</View><Text style={[styles.stepName, { color: selected ? palette.accent : complete ? palette.text : palette.textMuted }]}>{label}</Text></View>{index < labels.length - 1 ? <View style={[styles.stepLine, { backgroundColor: index < current ? palette.accent : palette.borderInteractive }]} /> : null}</React.Fragment>;
  })}</View>;
}

function LucidPillButton({ label, groupLabel, selected, onPress, testID }: { label: string; groupLabel: string; selected: boolean; onPress: () => void; testID: string }) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  return <PressableScale accessibilityRole="radio" accessibilityLabel={`${groupLabel}, ${label}`} accessibilityState={{ selected, checked: selected }} onPress={onPress} testID={testID} transitionProperties={['backgroundColor', 'borderColor']} style={[styles.pillButton, { backgroundColor: selected ? palette.accentSoft : palette.surfaceRaised, borderColor: selected ? palette.accent : palette.borderInteractive }]}><Text style={[styles.pillButtonLabel, { color: selected ? palette.accentOn : palette.textSecondary }]}>{label}</Text></PressableScale>;
}

const styles = StyleSheet.create({
  screenContent: { gap: LucidSpace.lg },
  hero: { alignItems: 'center', gap: LucidSpace.sm },
  guideLabel: { flexDirection: 'row', alignItems: 'center', gap: LucidSpace.sm },
  guideText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1], letterSpacing: 0.4 },
  title: { maxWidth: 520, fontFamily: 'Fraunces_600SemiBold', fontSize: LucidType.display[0], lineHeight: LucidType.display[1], letterSpacing: -0.8, textAlign: 'center' },
  subtitle: { maxWidth: 520, fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1], textAlign: 'center' },
  stepRail: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: LucidSpace.xs },
  stepItem: { flex: 1, minWidth: 42, alignItems: 'center', gap: LucidSpace.xs },
  stepDot: { width: 28, height: 28, borderRadius: LucidRadius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepDotText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.overline[0], lineHeight: LucidType.overline[1] },
  stepName: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1], textAlign: 'center' },
  stepLine: { flex: 0.35, height: 1, marginTop: LucidSpace.md, marginHorizontal: 2 },
  exerciseCard: { gap: LucidSpace.lg },
  exerciseHeader: { gap: LucidSpace.sm },
  stepLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.overline[0], lineHeight: LucidType.overline[1], letterSpacing: 1, textTransform: 'uppercase' },
  prompt: { fontFamily: 'Fraunces_500Medium', fontSize: LucidType.h2[0], lineHeight: LucidType.h2[1] },
  body: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  group: { gap: LucidSpace.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: LucidSpace.sm },
  signChoices: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: LucidSpace.sm },
  signHint: { width: '100%', paddingTop: LucidSpace.xs },
  holdButton: { minHeight: 72, overflow: 'hidden', borderRadius: LucidRadius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: LucidSpace.lg },
  holdProgress: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  holdLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.body[0], lineHeight: LucidType.body[1], textAlign: 'center' },
  alternativeAction: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  fieldGroup: { gap: LucidSpace.sm },
  fieldLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  textInput: { minHeight: 88, borderRadius: LucidRadius.lg, borderWidth: 1, paddingHorizontal: LucidSpace.md, paddingVertical: LucidSpace.md, fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1], textAlignVertical: 'top' },
  pillButton: { minHeight: 44, justifyContent: 'center', borderRadius: LucidRadius.lg, borderWidth: 1, paddingHorizontal: LucidSpace.md, paddingVertical: LucidSpace.md },
  pillButtonLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  confirmation: { minHeight: 64, borderRadius: LucidRadius.lg, padding: LucidSpace.md, flexDirection: 'row', alignItems: 'center', gap: LucidSpace.md },
  confirmationText: { flex: 1, fontFamily: 'SpaceGrotesk_500Medium', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  footerActions: { gap: LucidSpace.xs },
  previousAction: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: LucidRadius.lg },
  previousLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
});
