import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Alert, Platform, StyleSheet, Text, View } from 'react-native';

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
import type {
  LucidRealityCheckContext,
  LucidRealityCheckMethod,
  LucidRealityCheckOutcome,
} from '@/lib/lucid/model';
import { closeLucidRoute, LUCID_HOME_HREF } from '@/lib/lucid/routes';

const METHODS: LucidRealityCheckMethod[] = [
  'nose_breathing',
  'finger_count',
  'text_reread',
  'memory_trace',
];
const CONTEXTS: LucidRealityCheckContext[] = [
  'scheduled',
  'transition',
  'emotion',
  'dream_sign',
  'spontaneous',
];
const OUTCOMES: LucidRealityCheckOutcome[] = ['awake', 'dreaming', 'uncertain'];
const STEP_COUNT = 3;

const COPY = {
  en: {
    eyebrow: 'Mindful pause', title: 'Is this a dream?', subtitle: 'Slow down for a moment. Evidence matters more than the answer you expect.', guide: 'Lucid guide', progress: 'Reality-check progress', step: 'Step', of: 'of', complete: 'complete', current: 'current', upcoming: 'upcoming', previous: 'Previous step', observe: 'Observe', name: 'Name', verify: 'Verify', observePrompt: 'Choose one stable detail to test', observeBody: 'Carry out the check slowly. Look for evidence instead of the answer you expect.', observeAction: 'I observed carefully', namePrompt: 'Name what interrupted autopilot', nameBody: 'Choose the real context that prompted this pause.', nameAction: 'Continue to verification', verifyPrompt: 'Verify what happened', verifyBody: 'Answer plainly, without trying to produce a dream-like anomaly.', method: 'Choose a check', context: 'What prompted it?', outcome: 'What did you notice?', awake: 'Awake', dreaming: 'Dreaming', uncertain: 'Unsure', mindful: 'I paused and genuinely questioned the moment', save: 'Save reality check', saved: 'Check saved', incomplete: 'Still to answer:', confirm: 'Confirmation', nose_breathing: 'Pinch nose and breathe', finger_count: 'Count your fingers twice', text_reread: 'Read, look away, read again', memory_trace: 'Trace the last few minutes', scheduled: 'Scheduled reminder', transition: 'Place or activity change', emotion: 'Strong emotion', dream_sign: 'Personal dream sign', spontaneous: 'Spontaneous thought', chooseSign: 'Which confirmed sign?', noConfirmedSign: 'Confirm a dream sign in your Journal first.',
  },
  fr: {
    eyebrow: 'Pause consciente', title: 'Est-ce un rêve ?', subtitle: 'Ralentissez un instant. Les indices comptent plus que la réponse attendue.', guide: 'Guide lucide', progress: 'Progression du test de réalité', step: 'Étape', of: 'sur', complete: 'terminée', current: 'en cours', upcoming: 'à venir', previous: 'Étape précédente', observe: 'Observer', name: 'Nommer', verify: 'Vérifier', observePrompt: 'Choisissez un détail stable à tester', observeBody: 'Effectuez le test lentement. Cherchez un indice plutôt que la réponse attendue.', observeAction: 'J’ai observé attentivement', namePrompt: 'Nommez ce qui a interrompu le pilote automatique', nameBody: 'Choisissez le contexte réel qui a déclenché cette pause.', nameAction: 'Continuer vers la vérification', verifyPrompt: 'Vérifiez ce qui s’est passé', verifyBody: 'Répondez simplement, sans chercher à provoquer une anomalie onirique.', method: 'Choisissez un test', context: 'Qu’est-ce qui l’a déclenché ?', outcome: 'Qu’avez-vous observé ?', awake: 'Éveillé', dreaming: 'En rêve', uncertain: 'Incertain', mindful: 'J’ai réellement pris le temps de questionner ce moment', save: 'Enregistrer le test', saved: 'Test enregistré', incomplete: 'À renseigner :', confirm: 'Confirmation', nose_breathing: 'Pincer le nez et respirer', finger_count: 'Compter deux fois ses doigts', text_reread: 'Lire, détourner le regard, relire', memory_trace: 'Retracer les dernières minutes', scheduled: 'Rappel planifié', transition: 'Changement de lieu ou d’activité', emotion: 'Émotion forte', dream_sign: 'Signe onirique personnel', spontaneous: 'Pensée spontanée', chooseSign: 'Quel signe confirmé ?', noConfirmedSign: 'Confirme d’abord un signe onirique dans ton Journal.',
  },
  es: {
    eyebrow: 'Pausa consciente', title: '¿Es esto un sueño?', subtitle: 'Reduce el ritmo un instante. Las pruebas importan más que la respuesta esperada.', guide: 'Guía lúcida', progress: 'Progreso de la prueba de realidad', step: 'Paso', of: 'de', complete: 'completado', current: 'actual', upcoming: 'próximo', previous: 'Paso anterior', observe: 'Observar', name: 'Nombrar', verify: 'Verificar', observePrompt: 'Elige un detalle estable para comprobar', observeBody: 'Haz la prueba despacio. Busca evidencias en lugar de la respuesta que esperas.', observeAction: 'He observado con atención', namePrompt: 'Nombra qué interrumpió el piloto automático', nameBody: 'Elige el contexto real que provocó esta pausa.', nameAction: 'Continuar a la verificación', verifyPrompt: 'Verifica qué ocurrió', verifyBody: 'Responde con sencillez, sin intentar provocar una anomalía onírica.', method: 'Elige una prueba', context: '¿Qué la provocó?', outcome: '¿Qué notaste?', awake: 'Despierto', dreaming: 'Soñando', uncertain: 'Inseguro', mindful: 'Me detuve y cuestioné realmente el momento', save: 'Guardar prueba', saved: 'Prueba guardada', incomplete: 'Falta responder:', confirm: 'Confirmación', nose_breathing: 'Tapar la nariz y respirar', finger_count: 'Contar los dedos dos veces', text_reread: 'Leer, apartar la vista y releer', memory_trace: 'Reconstruir los últimos minutos', scheduled: 'Recordatorio programado', transition: 'Cambio de lugar o actividad', emotion: 'Emoción fuerte', dream_sign: 'Señal onírica personal', spontaneous: 'Pensamiento espontáneo', chooseSign: '¿Qué señal confirmada?', noConfirmedSign: 'Confirma primero una señal onírica en tu Diario.',
  },
  de: {
    eyebrow: 'Bewusste Pause', title: 'Ist das ein Traum?', subtitle: 'Werde einen Moment langsamer. Hinweise zählen mehr als die erwartete Antwort.', guide: 'Klartraum-Guide', progress: 'Fortschritt des Realitätschecks', step: 'Schritt', of: 'von', complete: 'abgeschlossen', current: 'aktuell', upcoming: 'als Nächstes', previous: 'Vorheriger Schritt', observe: 'Beobachten', name: 'Benennen', verify: 'Überprüfen', observePrompt: 'Wähle ein stabiles Detail zum Prüfen', observeBody: 'Führe den Test langsam aus. Suche nach Hinweisen statt nach der erwarteten Antwort.', observeAction: 'Ich habe aufmerksam beobachtet', namePrompt: 'Benenne, was den Autopiloten unterbrochen hat', nameBody: 'Wähle den tatsächlichen Kontext, der diese Pause ausgelöst hat.', nameAction: 'Weiter zur Überprüfung', verifyPrompt: 'Überprüfe, was geschehen ist', verifyBody: 'Antworte schlicht, ohne eine traumartige Abweichung erzwingen zu wollen.', method: 'Test wählen', context: 'Was war der Auslöser?', outcome: 'Was hast du bemerkt?', awake: 'Wach', dreaming: 'Träumend', uncertain: 'Unsicher', mindful: 'Ich habe den Moment wirklich hinterfragt', save: 'Realitätscheck speichern', saved: 'Check gespeichert', incomplete: 'Noch offen:', confirm: 'Bestätigung', nose_breathing: 'Nase zuhalten und atmen', finger_count: 'Finger zweimal zählen', text_reread: 'Lesen, wegsehen, erneut lesen', memory_trace: 'Letzte Minuten nachvollziehen', scheduled: 'Geplante Erinnerung', transition: 'Orts- oder Aktivitätswechsel', emotion: 'Starke Emotion', dream_sign: 'Persönliches Traumzeichen', spontaneous: 'Spontaner Gedanke', chooseSign: 'Welches bestätigte Zeichen?', noConfirmedSign: 'Bestätige zuerst ein Traumzeichen im Journal.',
  },
  it: {
    eyebrow: 'Pausa consapevole', title: 'È un sogno?', subtitle: 'Rallenta per un momento. Gli indizi contano più della risposta attesa.', guide: 'Guida lucida', progress: 'Avanzamento del test di realtà', step: 'Passaggio', of: 'di', complete: 'completato', current: 'attuale', upcoming: 'successivo', previous: 'Passaggio precedente', observe: 'Osservare', name: 'Nominare', verify: 'Verificare', observePrompt: 'Scegli un dettaglio stabile da verificare', observeBody: 'Esegui il test lentamente. Cerca indizi invece della risposta che ti aspetti.', observeAction: 'Ho osservato con attenzione', namePrompt: 'Nomina ciò che ha interrotto il pilota automatico', nameBody: 'Scegli il contesto reale che ha attivato questa pausa.', nameAction: 'Continua alla verifica', verifyPrompt: 'Verifica cosa è successo', verifyBody: 'Rispondi con semplicità, senza cercare di provocare un’anomalia onirica.', method: 'Scegli un test', context: 'Cosa lo ha attivato?', outcome: 'Cosa hai notato?', awake: 'Sveglio', dreaming: 'In sogno', uncertain: 'Incerto', mindful: 'Mi sono fermato e ho davvero messo in dubbio il momento', save: 'Salva test', saved: 'Test salvato', incomplete: 'Ancora da indicare:', confirm: 'Conferma', nose_breathing: 'Chiudi il naso e respira', finger_count: 'Conta le dita due volte', text_reread: 'Leggi, distogli lo sguardo, rileggi', memory_trace: 'Ripercorri gli ultimi minuti', scheduled: 'Promemoria programmato', transition: 'Cambio di luogo o attività', emotion: 'Emozione forte', dream_sign: 'Segnale onirico personale', spontaneous: 'Pensiero spontaneo', chooseSign: 'Quale segnale confermato?', noConfirmedSign: 'Conferma prima un segnale onirico nel Diario.',
  },
} as const;

type StepIndex = 0 | 1 | 2;

export default function LucidRealityCheckScreen() {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { content, state, activeDreamSigns = [], addRealityCheck } = useLucidTrainer();
  const copy = COPY[content.locale];
  const [step, setStep] = useState<StepIndex>(0);
  // Nothing is pre-answered: a check the user never performed must not be
  // recordable in one tap, least of all its outcome.
  const [method, setMethod] = useState<LucidRealityCheckMethod | null>(null);
  const [context, setContext] = useState<LucidRealityCheckContext | null>(null);
  const [selectedDreamSignId, setSelectedDreamSignId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<LucidRealityCheckOutcome | null>(null);
  const [mindful, setMindful] = useState(false);
  const [saving, setSaving] = useState(false);
  const steps = useMemo(() => [copy.observe, copy.name, copy.verify] as const, [copy]);
  const prompts = useMemo(
    () => [copy.observePrompt, copy.namePrompt, copy.verifyPrompt] as const,
    [copy]
  );
  const bodies = useMemo(
    () => [copy.observeBody, copy.nameBody, copy.verifyBody] as const,
    [copy]
  );
  const selectedDreamSign = activeDreamSigns.find((sign) => sign.id === selectedDreamSignId);
  const missing = ([
    method === null ? copy.method : null,
    context === null ? copy.context : null,
    context === 'dream_sign' && !selectedDreamSign ? copy.chooseSign : null,
    outcome === null ? copy.outcome : null,
    mindful ? null : copy.confirm,
  ] as (string | null)[]).filter((label): label is string => label !== null);
  const close = () => closeLucidRoute(router, LUCID_HOME_HREF);
  const progressLabel = `${copy.progress}, ${copy.step} ${step + 1} ${copy.of} ${STEP_COUNT}, ${steps[step]}`;

  useEffect(() => {
    AccessibilityInfo?.announceForAccessibility?.(progressLabel);
  }, [progressLabel]);

  // Un test de réalité est une validation rare : elle mérite le seul retour que
  // le corps perçoit sans regarder. Jamais l'unique retour — l'alerte reste.
  const save = async () => {
    if (method === null || context === null || outcome === null || !mindful) return;
    setSaving(true);
    try {
      await addRealityCheck({
        method,
        context,
        outcome,
        mindful,
        ...(context === 'dream_sign' && selectedDreamSign
          ? { dreamSignId: selectedDreamSign.id, dreamSignLabel: selectedDreamSign.label }
          : {}),
      });
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      Alert.alert(copy.saved, content.realityChecks.completionPrompt, [
        { text: content.chrome.common.done, onPress: close },
      ]);
    } finally {
      setSaving(false);
    }
  };

  const advance = () => {
    if (step === 0) {
      if (method === null) return;
      setMindful(true);
      setStep(1);
      return;
    }
    if (step === 1) {
      if (context === null || (context === 'dream_sign' && !selectedDreamSign)) return;
      setStep(2);
      return;
    }
    void save();
  };

  const goBack = () => {
    if (step === 0) return;
    if (step === 1) setMindful(false);
    setStep((step - 1) as StepIndex);
  };

  const actionLabel = step === 0 ? copy.observeAction : step === 1 ? copy.nameAction : copy.save;
  const disabled = step === 0
    ? method === null
    : step === 1
      ? context === null || (context === 'dream_sign' && !selectedDreamSign)
      : missing.length > 0;
  const visibleMissing = step === 0
    ? [copy.method]
    : step === 1
      ? context === null
        ? [copy.context]
        : context === 'dream_sign' && !selectedDreamSign
          ? [copy.chooseSign]
          : []
      : missing;

  return (
    <LucidScreen
      eyebrow={copy.eyebrow}
      trailing={<LucidIconAction label={content.chrome.common.cancel} icon="close" onPress={close} />}
      testID="lucid-reality-check"
      contentStyle={styles.screenContent}
      footer={
        <View style={styles.footerActions}>
          <LucidButton
            label={actionLabel}
            icon={step === 2 ? 'checkmark' : 'arrow-forward'}
            disabled={disabled}
            disabledReason={`${copy.incomplete} ${visibleMissing.join(', ')}`}
            loading={saving}
            onPress={advance}
            testID="lucid-reality-save"
          />
          {step > 0 ? (
            <PressableScale
              accessibilityRole="button"
              onPress={goBack}
              testID="lucid-reality-previous"
              style={styles.previousAction}
            >
              <Text style={[styles.previousLabel, { color: palette.textSecondary }]}>{copy.previous}</Text>
            </PressableScale>
          ) : null}
        </View>
      }
    >
      <View style={styles.hero}>
        <LucidGuideOrb
          accessibilityLabel={copy.guide}
          active={!saving}
          reduceMotion={state?.onboarding.accessibility?.reduceMotion ?? false}
        />
        <View style={styles.guideLabel}>
          <Ionicons name="sparkles" size={LucidIcon.sm} color={palette.accent} />
          <Text style={[styles.guideText, { color: palette.accent }]}>{copy.guide}</Text>
        </View>
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

        {step === 0 ? (
          <View accessibilityRole="radiogroup" accessibilityLabel={copy.method} style={styles.group}>
            {METHODS.map((item) => (
              <LucidChoiceCard
                key={item}
                title={copy[item]}
                selected={method === item}
                onPress={() => {
                  setMethod(item);
                  setMindful(false);
                }}
                icon={item === 'nose_breathing' ? 'fitness' : item === 'finger_count' ? 'hand-left' : item === 'text_reread' ? 'text' : 'time'}
                testID={`lucid-reality-method-${item}`}
              />
            ))}
          </View>
        ) : null}

        {step === 1 ? (
          <View accessibilityRole="radiogroup" accessibilityLabel={copy.context} style={styles.wrap}>
            {CONTEXTS.map((item) => (
              <LucidPillButton
                key={item}
                label={copy[item]}
                groupLabel={copy.context}
                selected={context === item}
                onPress={() => {
                  setContext(item);
                  if (item !== 'dream_sign') setSelectedDreamSignId(null);
                }}
                testID={`lucid-reality-context-${item}`}
              />
            ))}
            {context === 'dream_sign' ? (
              activeDreamSigns.length > 0 ? (
                <View accessibilityRole="radiogroup" accessibilityLabel={copy.chooseSign} style={styles.signChoices}>
                  {activeDreamSigns.map((sign) => (
                    <LucidPillButton
                      groupLabel={copy.chooseSign}
                      key={sign.id}
                      label={sign.label}
                      onPress={() => setSelectedDreamSignId(sign.id)}
                      selected={selectedDreamSignId === sign.id}
                      testID={`lucid-reality-sign-${sign.id}`}
                    />
                  ))}
                </View>
              ) : (
                <Text style={[styles.body, styles.signHint, { color: palette.textSecondary }]}>
                  {copy.noConfirmedSign}
                </Text>
              )
            ) : null}
          </View>
        ) : null}

        {step === 2 ? (
          <>
            <View accessibilityRole="radiogroup" accessibilityLabel={copy.outcome} style={styles.wrap}>
              {OUTCOMES.map((item) => (
                <LucidPillButton
                  key={item}
                  label={copy[item]}
                  groupLabel={copy.outcome}
                  selected={outcome === item}
                  onPress={() => setOutcome(item)}
                  testID={`lucid-reality-outcome-${item}`}
                />
              ))}
            </View>
            <View
              accessible
              accessibilityLabel={`${copy.confirm}, ${copy.complete}. ${copy.mindful}`}
              style={[styles.confirmation, { backgroundColor: palette.accentSoft }]}
              testID="lucid-reality-mindful-confirmed"
            >
              <LucidIconTile icon="sparkles" tone="solid" size="sm" />
              <Text style={[styles.confirmationText, { color: palette.accentOn }]}>{copy.mindful}</Text>
            </View>
          </>
        ) : null}
      </LucidCard>
    </LucidScreen>
  );
}

function StepRail({ current, labels, progressLabel, copy }: { current: StepIndex; labels: readonly [string, string, string]; progressLabel: string; copy: (typeof COPY)[keyof typeof COPY] }) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={progressLabel} accessibilityValue={{ min: 1, max: STEP_COUNT, now: current + 1 }} style={styles.stepRail}>
      {labels.map((label, index) => {
        const complete = index < current;
        const selected = index === current;
        const stateLabel = complete ? copy.complete : selected ? copy.current : copy.upcoming;
        return (
          <React.Fragment key={label}>
            <View accessible accessibilityLabel={`${label}, ${stateLabel}`} accessibilityState={{ selected }} style={styles.stepItem}>
              <View
                style={[
                  styles.stepDot,
                  {
                    backgroundColor:
                      complete || selected ? palette.accent : palette.surfaceRaised,
                    borderColor:
                      complete || selected ? palette.accent : palette.borderInteractive,
                  },
                ]}
              >
                {complete ? (
                  <Ionicons
                    color={palette.backgroundDeep}
                    name="checkmark"
                    size={LucidIcon.sm}
                  />
                ) : (
                  <Text style={[styles.stepDotText, { color: selected ? palette.backgroundDeep : palette.textMuted }]}>{index + 1}</Text>
                )}
              </View>
              <Text style={[styles.stepName, { color: selected ? palette.accent : complete ? palette.text : palette.textMuted }]}>{label}</Text>
            </View>
            {index < labels.length - 1 ? <View style={[styles.stepLine, { backgroundColor: index < current ? palette.accent : palette.borderInteractive }]} /> : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

function LucidPillButton({ label, groupLabel, selected, onPress, testID }: { label: string; groupLabel: string; selected: boolean; onPress: () => void; testID: string }) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityLabel={`${groupLabel}, ${label}`}
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      testID={testID}
      transitionProperties={['backgroundColor', 'borderColor']}
      style={[
        styles.pillButton,
        {
          backgroundColor: selected ? palette.accentSoft : palette.surfaceRaised,
          borderColor: selected ? palette.accent : palette.borderInteractive,
        },
      ]}
    >
      <Text style={[styles.pillButtonLabel, { color: selected ? palette.accentOn : palette.textSecondary }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screenContent: { gap: LucidSpace.lg },
  hero: { alignItems: 'center', gap: LucidSpace.sm },
  guideLabel: { flexDirection: 'row', alignItems: 'center', gap: LucidSpace.sm },
  guideText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1], letterSpacing: 0.4 },
  title: { maxWidth: 520, fontFamily: 'Fraunces_600SemiBold', fontSize: LucidType.display[0], lineHeight: LucidType.display[1], letterSpacing: -0.8, textAlign: 'center' },
  subtitle: { maxWidth: 520, fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1], textAlign: 'center' },
  stepRail: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: LucidSpace.xs },
  stepItem: { minWidth: 68, alignItems: 'center', gap: LucidSpace.sm },
  stepDot: { width: 28, height: 28, borderRadius: LucidRadius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepDotText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.overline[0], lineHeight: LucidType.overline[1] },
  stepName: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1], textAlign: 'center' },
  stepLine: { flex: 1, height: 1, marginTop: LucidSpace.md, marginHorizontal: LucidSpace.xs },
  exerciseCard: { gap: LucidSpace.lg },
  exerciseHeader: { gap: LucidSpace.sm },
  stepLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.overline[0], lineHeight: LucidType.overline[1], letterSpacing: 1, textTransform: 'uppercase' },
  prompt: { fontFamily: 'Fraunces_500Medium', fontSize: LucidType.h2[0], lineHeight: LucidType.h2[1] },
  body: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  group: { gap: LucidSpace.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: LucidSpace.sm },
  signChoices: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: LucidSpace.sm },
  signHint: { width: '100%', paddingTop: LucidSpace.xs },
  pillButton: { minHeight: 44, justifyContent: 'center', borderRadius: LucidRadius.lg, borderWidth: 1, paddingHorizontal: LucidSpace.md, paddingVertical: LucidSpace.md },
  pillButtonLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  confirmation: { minHeight: 64, borderRadius: LucidRadius.lg, padding: LucidSpace.md, flexDirection: 'row', alignItems: 'center', gap: LucidSpace.md },
  confirmationText: { flex: 1, fontFamily: 'SpaceGrotesk_500Medium', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  footerActions: { gap: LucidSpace.xs },
  previousAction: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: LucidRadius.lg },
  previousLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
});
