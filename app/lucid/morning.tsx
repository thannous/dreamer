import * as Haptics from 'expo-haptics';
import { type Href, router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { LucidButton, LucidCard, LucidChoiceCard, LucidIconAction, LucidIconTile, LucidPill, LucidScreen } from '@/components/lucid/LucidUI';
import { getLucidPalette, LucidPress, LucidRadius, LucidSpace, LucidType } from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import { useLucidNow } from '@/hooks/useLucidNow';
import { resolvePreviousNightTechniqueLink } from '@/lib/lucid/morningCapture';
import type {
  LucidDreamCaptureMode,
  LucidExperimentResult,
  LucidNightCueOutcome,
  LucidPersonalFactor,
  LucidTechnique,
} from '@/lib/lucid/model';
import { closeLucidRoute, LUCID_HOME_HREF } from '@/lib/lucid/routes';

const FACTORS: LucidPersonalFactor[] = ['stress', 'alcohol', 'caffeine_late', 'exercise', 'screen_late', 'sleep_debt', 'unusual_schedule'];
const CUE_OUTCOMES: readonly LucidNightCueOutcome[] = [
  'not_heard',
  'heard_in_dream',
  'heard_woke',
  'indeterminate',
];
const COPY = {
  en: {
    eyebrow: 'On waking',
    title: 'What remains this morning?',
    screenTitle: 'Morning check-in',
    speak: 'Speak',
    speakHint: 'The first tap asks for the microphone. Recording starts only if you allow it. Audio stays on this device and is not synced.',
    write: 'Write',
    writeHint: 'Type a few words while they are still close.',
    nothing: 'Nothing for now',
    nothingHint: 'Skip capturing now. You can return later.',
    recallTitle: 'Write what remains',
    recallPlaceholder: 'A place, a feeling, a fragment…',
    recallNeeded: 'Add a few words before continuing.',
    cue: 'Did you notice a night cue?',
    cue_not_heard: 'Not heard',
    cue_heard_in_dream: 'Heard in the dream',
    cue_heard_woke: 'Heard and woke me',
    cue_indeterminate: 'Unsure',
    linkedPractice: 'Practice linked',
    linkedPracticeHint: 'From a completed program practice, not a technique you reported just now.',
    details: 'Add optional details',
    detailsTitle: 'Optional details',
    detailsHint: 'Skip anything you do not want to answer.',
    detailsDone: 'Back to recap',
    unset: 'Leave unset',
    technique: 'Which practice did you try?',
    prep: 'How long did you prepare?',
    minutes: 'minutes',
    result: 'What do you remember about lucidity?',
    none: 'No lucidity',
    pre_lucid: 'Almost lucid',
    lucid: 'Lucid',
    recall: 'How much of the scene remains?',
    lucidity: 'How aware did you feel?',
    sleep: 'How did your sleep feel?',
    factors: 'Anything to keep in mind?',
    notes: 'A few neutral details',
    placeholder: 'Optional',
    outOf: 'out of',
    save: 'Save morning capture',
    saved: 'Saved offline',
    incomplete: 'Choose an answer to continue.',
    next: 'Continue',
    back: 'Back',
    step: 'Step',
    of: 'of',
    summary: 'Your morning capture',
    nothingSummary: 'Nothing captured for now',
    context: 'Optional context',
    noNotes: 'No additional note',
    skipped: 'Not answered',
    stress: 'Stress',
    alcohol: 'Alcohol',
    caffeine_late: 'Late caffeine',
    exercise: 'Exercise',
    screen_late: 'Late screen',
    sleep_debt: 'Sleep debt',
    unusual_schedule: 'Unusual schedule',
  },
  fr: {
    eyebrow: 'Au réveil',
    title: 'Que reste-t-il ce matin ?',
    screenTitle: 'Point du matin',
    speak: 'Parler',
    speakHint: 'Le premier tap demande le micro. L’enregistrement commence seulement si tu l’autorises. L’audio reste sur cet appareil et n’est pas synchronisé.',
    write: 'Écrire',
    writeHint: 'Notez quelques mots tant qu’ils sont encore proches.',
    nothing: 'Rien pour l’instant',
    nothingHint: 'Ne rien capturer maintenant. Vous pourrez y revenir.',
    recallTitle: 'Écrivez ce qui reste',
    recallPlaceholder: 'Un lieu, une sensation, un fragment…',
    recallNeeded: 'Ajoutez quelques mots avant de continuer.',
    cue: 'Avez-vous remarqué un signal nocturne ?',
    cue_not_heard: 'Non entendue',
    cue_heard_in_dream: 'Entendue dans le rêve',
    cue_heard_woke: 'Entendue et m’a réveillé·e',
    cue_indeterminate: 'Incertain',
    linkedPractice: 'Pratique liée',
    linkedPracticeHint: 'D’une pratique de programme déjà réalisée, pas d’une technique que vous venez de déclarer.',
    details: 'Ajouter des détails facultatifs',
    detailsTitle: 'Détails facultatifs',
    detailsHint: 'Passez tout ce que vous ne souhaitez pas renseigner.',
    detailsDone: 'Retour au récapitulatif',
    unset: 'Laisser vide',
    technique: 'Quelle pratique avez-vous essayée ?',
    prep: 'Combien de temps avez-vous préparé ?',
    minutes: 'minutes',
    result: 'Que retenez-vous de la lucidité ?',
    none: 'Pas de lucidité',
    pre_lucid: 'Presque lucide',
    lucid: 'Lucide',
    recall: 'Que reste-t-il de la scène ?',
    lucidity: 'À quel point étiez-vous conscient·e ?',
    sleep: 'Comment votre sommeil vous a-t-il semblé ?',
    factors: 'Quel contexte retenir ?',
    notes: 'Quelques détails neutres',
    placeholder: 'Facultatif',
    outOf: 'sur',
    save: 'Enregistrer la capture',
    saved: 'Enregistré hors ligne',
    incomplete: 'Choisissez une réponse pour continuer.',
    next: 'Continuer',
    back: 'Retour',
    step: 'Étape',
    of: 'sur',
    summary: 'Votre capture du matin',
    nothingSummary: 'Rien capturé pour l’instant',
    context: 'Contexte facultatif',
    noNotes: 'Aucune note supplémentaire',
    skipped: 'Non renseigné',
    stress: 'Stress',
    alcohol: 'Alcool',
    caffeine_late: 'Caféine tardive',
    exercise: 'Exercice',
    screen_late: 'Écran tardif',
    sleep_debt: 'Dette de sommeil',
    unusual_schedule: 'Horaire inhabituel',
  },
  es: {
    eyebrow: 'Al despertar',
    title: '¿Qué queda esta mañana?',
    screenTitle: 'Revisión de la mañana',
    speak: 'Hablar',
    speakHint: 'El primer toque pide el micrófono. La grabación empieza solo si lo permites. El audio permanece en este dispositivo y no se sincroniza.',
    write: 'Escribir',
    writeHint: 'Anota unas palabras mientras siguen cerca.',
    nothing: 'Nada por ahora',
    nothingHint: 'No capturar ahora. Puedes volver más tarde.',
    recallTitle: 'Escribe lo que queda',
    recallPlaceholder: 'Un lugar, una sensación, un fragmento…',
    recallNeeded: 'Añade unas palabras antes de continuar.',
    cue: '¿Notaste una señal nocturna?',
    cue_not_heard: 'No la oí',
    cue_heard_in_dream: 'La oí en el sueño',
    cue_heard_woke: 'La oí y me despertó',
    cue_indeterminate: 'No estoy seguro',
    linkedPractice: 'Práctica vinculada',
    linkedPracticeHint: 'De una práctica de programa ya hecha, no de una técnica que acabas de indicar.',
    details: 'Añadir detalles opcionales',
    detailsTitle: 'Detalles opcionales',
    detailsHint: 'Omite lo que no quieras responder.',
    detailsDone: 'Volver al resumen',
    unset: 'Dejar en blanco',
    technique: '¿Qué práctica probaste?',
    prep: '¿Cuánto te preparaste?',
    minutes: 'minutos',
    result: '¿Qué recuerdas sobre la lucidez?',
    none: 'Sin lucidez',
    pre_lucid: 'Casi lúcido',
    lucid: 'Lúcido',
    recall: '¿Cuánto queda de la escena?',
    lucidity: '¿Qué tan consciente te sentiste?',
    sleep: '¿Cómo sentiste el sueño?',
    factors: '¿Algo que tener en cuenta?',
    notes: 'Algunos detalles neutrales',
    placeholder: 'Opcional',
    outOf: 'de',
    save: 'Guardar captura',
    saved: 'Guardado sin conexión',
    incomplete: 'Elige una respuesta para continuar.',
    next: 'Continuar',
    back: 'Atrás',
    step: 'Paso',
    of: 'de',
    summary: 'Tu captura de la mañana',
    nothingSummary: 'Nada capturado por ahora',
    context: 'Contexto opcional',
    noNotes: 'Sin nota adicional',
    skipped: 'Sin respuesta',
    stress: 'Estrés',
    alcohol: 'Alcohol',
    caffeine_late: 'Cafeína tardía',
    exercise: 'Ejercicio',
    screen_late: 'Pantalla tardía',
    sleep_debt: 'Deuda de sueño',
    unusual_schedule: 'Horario inusual',
  },
  de: {
    eyebrow: 'Beim Aufwachen',
    title: 'Was bleibt heute Morgen?',
    screenTitle: 'Morgen-Check-in',
    speak: 'Sprechen',
    speakHint: 'Der erste Tipp fragt nach dem Mikrofon. Die Aufnahme startet nur, wenn du zustimmst. Das Audio bleibt auf diesem Gerät und wird nicht synchronisiert.',
    write: 'Schreiben',
    writeHint: 'Schreib ein paar Worte, solange sie nah sind.',
    nothing: 'Jetzt nichts',
    nothingHint: 'Jetzt nichts festhalten. Du kannst später zurückkommen.',
    recallTitle: 'Schreib auf, was bleibt',
    recallPlaceholder: 'Ein Ort, ein Gefühl, ein Fragment…',
    recallNeeded: 'Füge ein paar Worte hinzu, bevor du weitergehst.',
    cue: 'Hast du ein Nachtsignal bemerkt?',
    cue_not_heard: 'Nicht gehört',
    cue_heard_in_dream: 'Im Traum gehört',
    cue_heard_woke: 'Gehört und aufgewacht',
    cue_indeterminate: 'Unsicher',
    linkedPractice: 'Übung verknüpft',
    linkedPracticeHint: 'Aus einer abgeschlossenen Programmübung, nicht aus einer gerade angegebenen Technik.',
    details: 'Optionale Details hinzufügen',
    detailsTitle: 'Optionale Details',
    detailsHint: 'Überspringe, was du nicht beantworten möchtest.',
    detailsDone: 'Zurück zur Übersicht',
    unset: 'Offen lassen',
    technique: 'Welche Übung hast du ausprobiert?',
    prep: 'Wie lange hast du dich vorbereitet?',
    minutes: 'Minuten',
    result: 'Was merkst du zur Klarheit?',
    none: 'Keine Klarheit',
    pre_lucid: 'Fast klar',
    lucid: 'Klar',
    recall: 'Wie viel von der Szene bleibt?',
    lucidity: 'Wie bewusst hast du dich gefühlt?',
    sleep: 'Wie hat sich dein Schlaf angefühlt?',
    factors: 'Gibt es etwas zu beachten?',
    notes: 'Einige neutrale Details',
    placeholder: 'Optional',
    outOf: 'von',
    save: 'Morgennotiz speichern',
    saved: 'Offline gespeichert',
    incomplete: 'Wähle eine Antwort, um fortzufahren.',
    next: 'Weiter',
    back: 'Zurück',
    step: 'Schritt',
    of: 'von',
    summary: 'Deine Morgennotiz',
    nothingSummary: 'Jetzt nichts festgehalten',
    context: 'Optionaler Kontext',
    noNotes: 'Keine zusätzliche Notiz',
    skipped: 'Nicht beantwortet',
    stress: 'Stress',
    alcohol: 'Alkohol',
    caffeine_late: 'Spätes Koffein',
    exercise: 'Bewegung',
    screen_late: 'Später Bildschirm',
    sleep_debt: 'Schlafdefizit',
    unusual_schedule: 'Ungewöhnlicher Rhythmus',
  },
  it: {
    eyebrow: 'Al risveglio',
    title: 'Cosa resta stamattina?',
    screenTitle: 'Check-in del mattino',
    speak: 'Parlare',
    speakHint: 'Il primo tap chiede il microfono. La registrazione inizia solo se lo consenti. L’audio resta su questo dispositivo e non viene sincronizzato.',
    write: 'Scrivere',
    writeHint: 'Annota poche parole mentre sono ancora vicine.',
    nothing: 'Niente per ora',
    nothingHint: 'Non catturare ora. Potrai tornarci più tardi.',
    recallTitle: 'Scrivi ciò che resta',
    recallPlaceholder: 'Un luogo, una sensazione, un frammento…',
    recallNeeded: 'Aggiungi qualche parola prima di continuare.',
    cue: 'Hai notato un segnale notturno?',
    cue_not_heard: 'Non udito',
    cue_heard_in_dream: 'Udito nel sogno',
    cue_heard_woke: 'Udito e mi ha svegliato',
    cue_indeterminate: 'Incerto',
    linkedPractice: 'Pratica collegata',
    linkedPracticeHint: 'Da una pratica di programma già svolta, non da una tecnica che hai appena indicato.',
    details: 'Aggiungi dettagli facoltativi',
    detailsTitle: 'Dettagli facoltativi',
    detailsHint: 'Salta ciò che non vuoi indicare.',
    detailsDone: 'Torna al riepilogo',
    unset: 'Lascia vuoto',
    technique: 'Quale pratica hai provato?',
    prep: 'Per quanto tempo ti sei preparato?',
    minutes: 'minuti',
    result: 'Cosa ricordi della lucidità?',
    none: 'Nessuna lucidità',
    pre_lucid: 'Quasi lucido',
    lucid: 'Lucido',
    recall: 'Quanto resta della scena?',
    lucidity: 'Quanto ti sei sentito consapevole?',
    sleep: 'Come hai percepito il sonno?',
    factors: 'Qualcosa da tenere a mente?',
    notes: 'Alcuni dettagli neutrali',
    placeholder: 'Facoltativo',
    outOf: 'su',
    save: 'Salva cattura',
    saved: 'Salvato offline',
    incomplete: 'Scegli una risposta per continuare.',
    next: 'Continua',
    back: 'Indietro',
    step: 'Passo',
    of: 'di',
    summary: 'La tua cattura del mattino',
    nothingSummary: 'Niente catturato per ora',
    context: 'Contesto facoltativo',
    noNotes: 'Nessuna nota aggiuntiva',
    skipped: 'Non indicato',
    stress: 'Stress',
    alcohol: 'Alcol',
    caffeine_late: 'Caffeina tardiva',
    exercise: 'Esercizio',
    screen_late: 'Schermo tardivo',
    sleep_debt: 'Debito di sonno',
    unusual_schedule: 'Orario insolito',
  },
} as const;

type MorningStep = 'capture' | 'text' | 'cue' | 'summary' | 'details';
type LocalCopy = (typeof COPY)[keyof typeof COPY];

function formatLinkedDate(dateKey: string, locale: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day))
  );
}

export default function LucidMorningScreen() {
  const { content, addExperiment, state } = useLucidTrainer();
  const now = useLucidNow();
  const copy = COPY[content.locale];
  const [captureMode, setCaptureMode] = useState<LucidDreamCaptureMode | null>(null);
  const [recallText, setRecallText] = useState('');
  const [cueOutcome, setCueOutcome] = useState<LucidNightCueOutcome | null>(null);
  const [technique, setTechnique] = useState<LucidTechnique | null>(null);
  const [preparationMinutes, setPreparationMinutes] = useState<number | null>(null);
  const [result, setResult] = useState<LucidExperimentResult | null>(null);
  const [lucidityLevel, setLucidityLevel] = useState<number | null>(null);
  const [recallLevel, setRecallLevel] = useState<number | null>(null);
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);
  const [factors, setFactors] = useState<LucidPersonalFactor[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<MorningStep>('capture');
  const autoLink = useMemo(
    () =>
      state
        ? resolvePreviousNightTechniqueLink(state.progress, now, state.preferences.timeZone)
        : null,
    [now, state]
  );
  const stepNumber =
    step === 'capture'
      ? 1
      : step === 'text'
        ? 2
        : step === 'cue'
          ? captureMode === 'nothing_for_now'
            ? 2
            : 3
          : captureMode === 'nothing_for_now'
            ? 3
            : 4;
  const stepCount = captureMode === 'nothing_for_now' ? 3 : captureMode ? 4 : 3;
  const trimmedRecall = recallText.trim();
  const answerReady =
    step === 'capture'
      ? captureMode !== null
      : step === 'text'
        ? trimmedRecall.length > 0
        : step === 'cue'
          ? cueOutcome !== null
          : true;
  const close = () => closeLucidRoute(router, LUCID_HOME_HREF);
  const goBack = () => {
    if (step === 'capture') close();
    else if (step === 'text') setStep('capture');
    else if (step === 'cue') setStep(captureMode === 'nothing_for_now' ? 'capture' : 'text');
    else if (step === 'summary') setStep('cue');
    else setStep('summary');
  };
  const goNext = () => {
    if (!answerReady) return;
    if (step === 'capture') {
      if (captureMode === 'nothing_for_now') setStep('cue');
      else if (captureMode === 'write') setStep('text');
      return;
    }
    if (step === 'text') setStep('cue');
    if (step === 'cue') setStep('summary');
  };
  const chooseCapture = (mode: LucidDreamCaptureMode) => {
    if (mode === 'speak') {
      router.push('/lucid/morning-voice?autoStart=1' as Href);
      return;
    }
    setCaptureMode(mode);
    if (mode === 'write') {
      setStep('text');
      return;
    }
    setRecallText('');
    setStep('cue');
  };
  const toggleFactor = (factor: LucidPersonalFactor) =>
    setFactors((items) => (items.includes(factor) ? items.filter((item) => item !== factor) : [...items, factor]));
  const selectResult = (value: LucidExperimentResult) => {
    setResult(value);
    if (value !== 'pre_lucid' && value !== 'lucid') setLucidityLevel(null);
  };
  const save = async () => {
    if (captureMode === null || cueOutcome === null) return;
    if (captureMode !== 'nothing_for_now' && trimmedRecall.length === 0) return;
    setSaving(true);
    try {
      await addExperiment({
        technique,
        preparationMinutes,
        result,
        lucidityLevel: result === 'pre_lucid' || result === 'lucid' ? lucidityLevel : null,
        recallLevel,
        sleepQuality,
        factors,
        notes: notes.trim() || undefined,
        captureMode,
        ...(captureMode === 'nothing_for_now' ? {} : { recallText: trimmedRecall }),
        cueOutcome,
      });
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(copy.saved, content.morningReview.saveOfflineNote, [{ text: content.chrome.common.done, onPress: close }]);
    } finally {
      setSaving(false);
    }
  };
  return (
    <LucidScreen
      eyebrow={step === 'details' ? copy.detailsTitle : `${copy.step} ${stepNumber} ${copy.of} ${stepCount}`}
      title={step === 'summary' ? (captureMode === 'nothing_for_now' ? copy.nothingSummary : copy.summary) : step === 'details' ? copy.detailsTitle : copy.screenTitle}
      subtitle={step === 'details' ? copy.detailsHint : undefined}
      trailing={<LucidIconAction label={step === 'capture' ? content.chrome.common.cancel : copy.back} icon={step === 'capture' ? 'close' : 'arrow-back'} onPress={goBack} />}
      testID="lucid-morning"
    >
      {autoLink && (step === 'summary' || step === 'details' || step === 'cue') ? (
        <LinkedPracticeBanner
          copy={copy}
          locale={content.locale}
          techniqueTitle={content.programs[autoLink.technique].title}
          practiceDate={autoLink.practiceDate}
        />
      ) : null}
      {step === 'capture' ? (
        <ChoiceStep
          title={copy.title}
          groupLabel={copy.title}
          choices={[
            { label: copy.speak, description: copy.speakHint, selected: false, onPress: () => chooseCapture('speak'), icon: 'mic', testID: 'lucid-morning-speak' },
            { label: copy.write, description: copy.writeHint, selected: captureMode === 'write', onPress: () => chooseCapture('write'), icon: 'create', testID: 'lucid-morning-write' },
            { label: copy.nothing, description: copy.nothingHint, selected: captureMode === 'nothing_for_now', onPress: () => chooseCapture('nothing_for_now'), icon: 'pause', testID: 'lucid-morning-nothing' },
          ]}
        />
      ) : null}
      {step === 'text' ? (
        <RecallStep
          copy={copy}
          value={recallText}
          onChange={setRecallText}
        />
      ) : null}
      {step === 'cue' ? (
        <ChoiceStep
          title={copy.cue}
          groupLabel={copy.cue}
          choices={CUE_OUTCOMES.map((item) => ({
            label: copy[`cue_${item}`],
            selected: cueOutcome === item,
            onPress: () => setCueOutcome(item),
            icon: item === 'not_heard' ? 'volume-mute' : item === 'heard_in_dream' ? 'moon' : item === 'heard_woke' ? 'alert' : 'help',
            testID: `lucid-morning-cue-${item}`,
          }))}
        />
      ) : null}
      {step === 'details' ? (
        <DetailsStep
          copy={copy}
          content={content}
          technique={technique}
          preparationMinutes={preparationMinutes}
          result={result}
          recallLevel={recallLevel}
          lucidityLevel={lucidityLevel}
          sleepQuality={sleepQuality}
          factors={factors}
          notes={notes}
          onTechnique={setTechnique}
          onClearTechnique={() => setTechnique(null)}
          onPreparation={setPreparationMinutes}
          onClearPreparation={() => setPreparationMinutes(null)}
          onResult={selectResult}
          onClearResult={() => {
            setResult(null);
            setLucidityLevel(null);
          }}
          onRecallLevel={setRecallLevel}
          onClearRecallLevel={() => setRecallLevel(null)}
          onLucidityLevel={setLucidityLevel}
          onClearLucidityLevel={() => setLucidityLevel(null)}
          onSleepQuality={setSleepQuality}
          onClearSleepQuality={() => setSleepQuality(null)}
          onToggleFactor={toggleFactor}
          onNotesChange={setNotes}
        />
      ) : null}
      {step === 'summary' ? (
        <Summary
          copy={copy}
          content={content}
          captureMode={captureMode}
          recallText={trimmedRecall}
          cueOutcome={cueOutcome}
          technique={technique}
          preparationMinutes={preparationMinutes}
          result={result}
          recallLevel={recallLevel}
          lucidityLevel={lucidityLevel}
          sleepQuality={sleepQuality}
          factors={factors}
          notes={notes}
        />
      ) : null}
      {step === 'summary' ? (
        <>
          <LucidButton label={copy.details} variant="secondary" icon="add" onPress={() => setStep('details')} testID="lucid-morning-details" />
          <LucidButton label={copy.save} icon="checkmark" loading={saving} onPress={() => void save()} testID="lucid-morning-save" />
        </>
      ) : step === 'details' ? (
        <LucidButton label={copy.detailsDone} icon="arrow-back" variant="secondary" onPress={() => setStep('summary')} testID="lucid-morning-details-done" />
      ) : (
        <LucidButton
          label={copy.next}
          icon="arrow-forward"
          disabled={!answerReady}
          disabledReason={step === 'text' ? copy.recallNeeded : copy.incomplete}
          onPress={goNext}
          testID="lucid-morning-next"
        />
      )}
    </LucidScreen>
  );
}

function LinkedPracticeBanner({
  copy,
  locale,
  techniqueTitle,
  practiceDate,
}: {
  copy: LocalCopy;
  locale: string;
  techniqueTitle: string;
  practiceDate: string;
}) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  return (
    <LucidCard accent="amber" accessibilityLabel={`${copy.linkedPractice}: ${techniqueTitle} · ${formatLinkedDate(practiceDate, locale)}. ${copy.linkedPracticeHint}`} testID="lucid-morning-auto-link">
      <Text style={[styles.bannerTitle, { color: palette.text }]}>
        {`${copy.linkedPractice}: ${techniqueTitle} · ${formatLinkedDate(practiceDate, locale)}`}
      </Text>
      <Text style={[styles.bannerHint, { color: palette.textSecondary }]}>{copy.linkedPracticeHint}</Text>
    </LucidCard>
  );
}

function ChoiceStep({
  title,
  groupLabel,
  choices,
  unsetLabel,
  onClear,
  unsetTestID,
}: {
  title: string;
  groupLabel: string;
  choices: {
    label: string;
    description?: string;
    selected: boolean;
    onPress: () => void;
    icon: 'mic' | 'create' | 'pause' | 'moon' | 'sparkles' | 'alarm' | 'time' | 'cloudy-night' | 'volume-mute' | 'alert' | 'help';
    testID?: string;
  }[];
  unsetLabel?: string;
  onClear?: () => void;
  unsetTestID?: string;
}) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  return (
    <View style={styles.step}>
      <View style={styles.prompt}>
        <LucidIconTile icon="sunny" tone="amber" size="lg" />
        <Text accessibilityRole="header" style={[styles.promptTitle, { color: palette.text }]}>{title}</Text>
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel={groupLabel} style={styles.choiceList}>
        {choices.map((choice) => (
          <LucidChoiceCard
            key={choice.testID ?? choice.label}
            title={choice.label}
            description={choice.description}
            selected={choice.selected}
            onPress={choice.onPress}
            icon={choice.icon}
            testID={choice.testID}
          />
        ))}
      </View>
      {unsetLabel && onClear ? (
        <UnsetControl label={unsetLabel} fieldTitle={title} onPress={onClear} testID={unsetTestID} />
      ) : null}
    </View>
  );
}

function RecallStep({
  copy,
  value,
  onChange,
}: {
  copy: LocalCopy;
  value: string;
  onChange: (value: string) => void;
}) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  return (
    <View style={styles.step}>
      <View style={styles.prompt}>
        <LucidIconTile icon="create" tone="amber" size="lg" />
        <Text accessibilityRole="header" style={[styles.promptTitle, { color: palette.text }]}>{copy.recallTitle}</Text>
      </View>
      <TextInput
        accessibilityLabel={copy.recallTitle}
        multiline
        maxLength={4000}
        onChangeText={onChange}
        placeholder={copy.recallPlaceholder}
        placeholderTextColor={palette.textMuted}
        style={[styles.notes, { backgroundColor: palette.surface, borderColor: palette.borderInteractive, color: palette.text }]}
        testID="lucid-morning-recall-text"
        textAlignVertical="top"
        value={value}
      />
    </View>
  );
}

function DetailsStep({
  copy,
  content,
  technique,
  preparationMinutes,
  result,
  recallLevel,
  lucidityLevel,
  sleepQuality,
  factors,
  notes,
  onTechnique,
  onClearTechnique,
  onPreparation,
  onClearPreparation,
  onResult,
  onClearResult,
  onRecallLevel,
  onClearRecallLevel,
  onLucidityLevel,
  onClearLucidityLevel,
  onSleepQuality,
  onClearSleepQuality,
  onToggleFactor,
  onNotesChange,
}: {
  copy: LocalCopy;
  content: ReturnType<typeof useLucidTrainer>['content'];
  technique: LucidTechnique | null;
  preparationMinutes: number | null;
  result: LucidExperimentResult | null;
  recallLevel: number | null;
  lucidityLevel: number | null;
  sleepQuality: number | null;
  factors: LucidPersonalFactor[];
  notes: string;
  onTechnique: (value: LucidTechnique) => void;
  onClearTechnique: () => void;
  onPreparation: (value: number) => void;
  onClearPreparation: () => void;
  onResult: (value: LucidExperimentResult) => void;
  onClearResult: () => void;
  onRecallLevel: (value: number) => void;
  onClearRecallLevel: () => void;
  onLucidityLevel: (value: number) => void;
  onClearLucidityLevel: () => void;
  onSleepQuality: (value: number) => void;
  onClearSleepQuality: () => void;
  onToggleFactor: (factor: LucidPersonalFactor) => void;
  onNotesChange: (notes: string) => void;
}) {
  return (
    <View style={styles.step}>
      <ChoiceStep
        title={copy.technique}
        groupLabel={copy.technique}
        unsetLabel={copy.unset}
        onClear={onClearTechnique}
        unsetTestID="lucid-morning-unset-technique"
        choices={(['mild', 'ssild', 'wbtb'] as const).map((item) => ({
          label: content.programs[item].title,
          selected: technique === item,
          onPress: () => onTechnique(item),
          icon: item === 'mild' ? 'moon' : item === 'ssild' ? 'sparkles' : 'alarm',
        }))}
      />
      <ChoiceStep
        title={copy.prep}
        groupLabel={copy.prep}
        unsetLabel={copy.unset}
        onClear={onClearPreparation}
        unsetTestID="lucid-morning-unset-preparation"
        choices={[0, 5, 10, 20, 30].map((value) => ({
          label: `${value} ${copy.minutes}`,
          selected: preparationMinutes === value,
          onPress: () => onPreparation(value),
          icon: 'time',
        }))}
      />
      <ChoiceStep
        title={copy.result}
        groupLabel={copy.result}
        unsetLabel={copy.unset}
        onClear={onClearResult}
        unsetTestID="lucid-morning-unset-result"
        choices={(['none', 'pre_lucid', 'lucid'] as const).map((item) => ({
          label: copy[item],
          selected: result === item,
          onPress: () => onResult(item),
          icon: item === 'none' ? 'cloudy-night' : item === 'pre_lucid' ? 'moon' : 'sparkles',
        }))}
      />
      <Score title={copy.recall} outOf={copy.outOf} unsetLabel={copy.unset} value={recallLevel} onChange={onRecallLevel} onClear={onClearRecallLevel} />
      {result === 'pre_lucid' || result === 'lucid' ? (
        <Score title={copy.lucidity} outOf={copy.outOf} unsetLabel={copy.unset} value={lucidityLevel} onChange={onLucidityLevel} onClear={onClearLucidityLevel} />
      ) : null}
      <Score title={copy.sleep} outOf={copy.outOf} unsetLabel={copy.unset} value={sleepQuality} onChange={onSleepQuality} onClear={onClearSleepQuality} />
      <ContextStep copy={copy} factors={factors} notes={notes} onNotesChange={onNotesChange} onToggleFactor={onToggleFactor} />
    </View>
  );
}

function ContextStep({ copy, factors, notes, onNotesChange, onToggleFactor }: { copy: LocalCopy; factors: LucidPersonalFactor[]; notes: string; onNotesChange: (notes: string) => void; onToggleFactor: (factor: LucidPersonalFactor) => void }) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  return (
    <View style={styles.step}>
      <View style={styles.prompt}>
        <LucidIconTile icon="leaf" tone="neutral" size="lg" />
        <Text accessibilityRole="header" style={[styles.promptTitle, { color: palette.text }]}>{copy.factors}</Text>
      </View>
      <View style={styles.factorList}>
        {FACTORS.map((factor) => (
          <SelectChip key={factor} role="checkbox" label={copy[factor]} selected={factors.includes(factor)} onPress={() => onToggleFactor(factor)} />
        ))}
      </View>
      <Text style={[styles.fieldTitle, { color: palette.text }]}>{copy.notes}</Text>
      <TextInput
        accessibilityLabel={copy.notes}
        multiline
        maxLength={4000}
        onChangeText={onNotesChange}
        placeholder={copy.placeholder}
        placeholderTextColor={palette.textMuted}
        style={[styles.notes, { backgroundColor: palette.surface, borderColor: palette.borderInteractive, color: palette.text }]}
        textAlignVertical="top"
        value={notes}
      />
    </View>
  );
}

function Summary({
  copy,
  content,
  captureMode,
  recallText,
  cueOutcome,
  technique,
  preparationMinutes,
  result,
  recallLevel,
  lucidityLevel,
  sleepQuality,
  factors,
  notes,
}: {
  copy: LocalCopy;
  content: ReturnType<typeof useLucidTrainer>['content'];
  captureMode: LucidDreamCaptureMode | null;
  recallText: string;
  cueOutcome: LucidNightCueOutcome | null;
  technique: LucidTechnique | null;
  preparationMinutes: number | null;
  result: LucidExperimentResult | null;
  recallLevel: number | null;
  lucidityLevel: number | null;
  sleepQuality: number | null;
  factors: LucidPersonalFactor[];
  notes: string;
}) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const captureLabel =
    captureMode === 'speak' ? copy.speak : captureMode === 'write' ? copy.write : copy.nothing;
  const rows: [string, string][] = [
    [copy.title, captureLabel],
    ...(recallText ? ([[copy.recallTitle, recallText]] as [string, string][]) : []),
    [copy.cue, cueOutcome ? copy[`cue_${cueOutcome}`] : copy.skipped],
  ];
  if (technique) rows.push([copy.technique, content.programs[technique].title]);
  if (preparationMinutes !== null) rows.push([copy.prep, `${preparationMinutes} ${copy.minutes}`]);
  if (result) rows.push([copy.result, copy[result]]);
  if (recallLevel !== null) rows.push([copy.recall, `${recallLevel} / 5`]);
  if ((result === 'pre_lucid' || result === 'lucid') && lucidityLevel !== null) {
    rows.push([copy.lucidity, `${lucidityLevel} / 5`]);
  }
  if (sleepQuality !== null) rows.push([copy.sleep, `${sleepQuality} / 5`]);
  return (
    <LucidCard accent="amber">
      <View style={styles.summaryTop}>
        <LucidIconTile icon="sunny" tone="amber" size="lg" />
      </View>
      {rows.map(([label, value]) => (
        <View key={label} style={[styles.summaryRow, { borderBottomColor: palette.border }]}>
          <Text style={[styles.summaryLabel, { color: palette.textSecondary }]}>{label}</Text>
          <Text style={[styles.summaryValue, { color: palette.text }]}>{value}</Text>
        </View>
      ))}
      {factors.length || notes.trim() ? (
        <View style={styles.summaryContext}>
          {factors.length ? (
            <Text style={[styles.summaryNote, { color: palette.textSecondary }]}>
              {factors.map((factor) => copy[factor]).join(' · ')}
            </Text>
          ) : null}
          {notes.trim() ? <Text style={[styles.summaryNote, { color: palette.textSecondary }]}>{notes.trim()}</Text> : null}
        </View>
      ) : null}
    </LucidCard>
  );
}

function UnsetControl({
  label,
  fieldTitle,
  onPress,
  testID,
}: {
  label: string;
  fieldTitle: string;
  onPress: () => void;
  testID?: string;
}) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${fieldTitle}`}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.unset, { opacity: pressed ? LucidPress.opacity : 1, borderColor: palette.borderInteractive }]}
    >
      <Text style={[styles.unsetText, { color: palette.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

function SelectChip({ label, selected, onPress, role = 'radio' }: { label: string; selected: boolean; onPress: () => void; role?: 'radio' | 'checkbox' }) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? palette.accentSoft : palette.surfaceRaised,
          borderColor: selected ? palette.accent : palette.borderInteractive,
          opacity: pressed ? LucidPress.opacity : 1,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? palette.accentOn : palette.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

function Score({
  title,
  outOf,
  unsetLabel,
  value,
  onChange,
  onClear,
}: {
  title: string;
  outOf: string;
  unsetLabel: string;
  value: number | null;
  onChange: (value: number) => void;
  onClear: () => void;
}) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { fontScale, width } = useWindowDimensions();
  const compact = width < 380 || fontScale >= 1.3;
  return (
    <View style={styles.step}>
      <View style={styles.prompt}>
        <LucidIconTile icon="pulse" tone="accent" size="lg" />
        <Text accessibilityRole="header" style={[styles.promptTitle, { color: palette.text }]}>{title}</Text>
        <LucidPill label={value === null ? unsetLabel : `${value} / 5`} tone={value !== null && value >= 4 ? 'accent' : 'neutral'} />
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel={title} style={[styles.scoreRow, compact && styles.scoreRowCompact]}>
        {[0, 1, 2, 3, 4, 5].map((score) => (
          <Pressable
            key={score}
            accessibilityRole="radio"
            accessibilityLabel={`${title}, ${score} ${outOf} 5`}
            accessibilityState={{ checked: score === value, selected: score === value }}
            onPress={() => onChange(score)}
            style={({ pressed }) => [
              styles.score,
              compact && styles.scoreCompact,
              { backgroundColor: score === value ? palette.accent : palette.surfaceRaised, opacity: pressed ? LucidPress.opacity : 1 },
            ]}
          >
            <Text style={[styles.scoreText, { color: score === value ? palette.backgroundDeep : palette.textSecondary }]}>{score}</Text>
          </Pressable>
        ))}
      </View>
      <UnsetControl label={unsetLabel} fieldTitle={title} onPress={onClear} />
    </View>
  );
}

const styles = StyleSheet.create({
  step: { gap: LucidSpace.lg },
  prompt: { alignItems: 'center', gap: LucidSpace.md, paddingVertical: LucidSpace.lg },
  promptTitle: { fontFamily: 'Fraunces_500Medium', fontSize: LucidType.h2[0], lineHeight: LucidType.h2[1], textAlign: 'center' },
  choiceList: { gap: LucidSpace.sm },
  factorList: { flexDirection: 'row', flexWrap: 'wrap', gap: LucidSpace.sm },
  fieldTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.body[0], lineHeight: LucidType.body[1] },
  chip: { minHeight: 44, justifyContent: 'center', borderRadius: LucidRadius.md, borderWidth: 1, paddingHorizontal: LucidSpace.md, paddingVertical: LucidSpace.sm },
  chipText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.overline[0], lineHeight: LucidType.overline[1] },
  scoreRow: { flexDirection: 'row', gap: LucidSpace.sm },
  scoreRowCompact: { flexWrap: 'wrap' },
  score: { flex: 1, minWidth: 44, minHeight: 52, borderRadius: LucidRadius.lg, alignItems: 'center', justifyContent: 'center' },
  scoreCompact: { flexBasis: '30%' },
  scoreText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.body[0], lineHeight: LucidType.body[1] },
  unset: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: LucidRadius.md, borderWidth: 1, paddingHorizontal: LucidSpace.md },
  unsetText: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  notes: { minHeight: 120, borderRadius: LucidRadius.lg, borderWidth: 1, padding: LucidSpace.lg, fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  bannerTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  bannerHint: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  summaryTop: { alignItems: 'center', gap: LucidSpace.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: LucidSpace.md, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: LucidSpace.sm },
  summaryLabel: { flex: 1, fontFamily: 'SpaceGrotesk_500Medium', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  summaryValue: { flex: 1, fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1], textAlign: 'right' },
  summaryContext: { gap: LucidSpace.sm },
  summaryNote: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
});
