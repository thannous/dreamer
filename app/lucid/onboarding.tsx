import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import {
  LucidOnboardingBackdrop,
  LucidOnboardingStage,
} from '@/components/lucid/LucidOnboardingBackdrop';
import {
  LucidExperienceSelector,
  LucidGoalSelector,
  LucidMomentPath,
  LucidRhythmSelector,
  LucidSegmentedProgress,
} from '@/components/lucid/LucidOnboardingChoices';
import {
  LucidButton,
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
} from '@/lib/lucid/model';
import { isLucidLocalTime } from '@/lib/lucid/model';
import type { ThemeAmbience } from '@/lib/themeAmbience';

const STEP_COUNT = 5;

const LOCAL = {
  en: {
    step: 'Step', start: 'Start', startTitle: 'Your practice in three moments', introShort: 'Notice by day. Set an intention. Write on waking.', goal: 'Choose your horizon', experience: 'Choose your level', experienceQuestion: 'Where are you starting?', startingPoint: 'Starting point', reminders: 'Practice rhythm', rhythmTitle: 'Find your rhythm', rhythmSubtitle: 'Three days are enough to begin.', recommended: 'Recommended', sleep: 'Your sleep window', bed: 'Bedtime', wake: 'Wake time', invalidTime: 'Use a valid 24-hour time such as 22:30.', chooseOption: 'Pick one option to continue.', finish: 'Create my training', days: 'days / week', dayUnit: 'days', summary: 'Your journey', goalLabel: 'Goal', levelLabel: 'Level', rhythmLabel: 'Rhythm', sleepFirst: 'Your sleep always comes first.', timePickerHint: 'Opens the system time picker.',
    startTitleDisplay: 'Your practice\nin three moments',
    goalShort: { first_lucid_dream: 'First lucid dream', improve_recall: 'Remember my dreams', more_frequent_lucidity: 'More lucid dreams', stabilize_lucidity: 'Stay lucid longer' },
    experienceHints: { beginner: 'I’m starting', occasional: 'I’ve tried before', experienced: 'I have a routine' },
  },
  fr: {
    step: 'Étape', start: 'Commencer', startTitle: 'Votre pratique en trois moments', introShort: 'Observer le jour. Poser une intention. Noter au réveil.', goal: 'Choisissez votre horizon', experience: 'Votre expérience', experienceQuestion: 'D’où partez-vous ?', startingPoint: 'Point de départ', reminders: 'Rythme d’entraînement', rhythmTitle: 'Trouvez votre rythme', rhythmSubtitle: 'Trois jours suffisent pour commencer.', recommended: 'Recommandé', sleep: 'Votre fenêtre de sommeil', bed: 'Coucher', wake: 'Réveil', invalidTime: 'Utilisez une heure valide au format 24 h, par exemple 22:30.', chooseOption: 'Choisissez une option pour continuer.', finish: 'Créer mon entraînement', days: 'jours / semaine', dayUnit: 'jours', summary: 'Votre parcours', goalLabel: 'Objectif', levelLabel: 'Niveau', rhythmLabel: 'Rythme', sleepFirst: 'Votre sommeil passe toujours en premier.', timePickerHint: 'Ouvre le sélecteur d’heure du système.',
    startTitleDisplay: 'Votre pratique\nen trois moments',
    goalShort: { first_lucid_dream: 'Premier rêve lucide', improve_recall: 'Mieux me souvenir', more_frequent_lucidity: 'Plus de rêves lucides', stabilize_lucidity: 'Rester lucide' },
    experienceHints: { beginner: 'Je découvre', occasional: 'J’ai déjà essayé', experienced: 'J’ai une routine' },
  },
  es: {
    step: 'Paso', start: 'Empezar', startTitle: 'Tu práctica en tres momentos', introShort: 'Observa de día. Fija una intención. Anota al despertar.', goal: 'Elige tu horizonte', experience: 'Tu experiencia', experienceQuestion: '¿Desde dónde empiezas?', startingPoint: 'Punto de partida', reminders: 'Ritmo de práctica', rhythmTitle: 'Encuentra tu ritmo', rhythmSubtitle: 'Tres días bastan para empezar.', recommended: 'Recomendado', sleep: 'Tu horario de sueño', bed: 'Hora de dormir', wake: 'Hora de despertar', invalidTime: 'Usa una hora válida de 24 horas, por ejemplo 22:30.', chooseOption: 'Elige una opción para continuar.', finish: 'Crear mi entrenamiento', days: 'días / semana', dayUnit: 'días', summary: 'Tu recorrido', goalLabel: 'Objetivo', levelLabel: 'Nivel', rhythmLabel: 'Ritmo', sleepFirst: 'Tu sueño siempre es lo primero.', timePickerHint: 'Abre el selector de hora del sistema.',
    startTitleDisplay: 'Tu práctica\nen tres momentos',
    goalShort: { first_lucid_dream: 'Primer sueño lúcido', improve_recall: 'Recordar mis sueños', more_frequent_lucidity: 'Más sueños lúcidos', stabilize_lucidity: 'Mantener la lucidez' },
    experienceHints: { beginner: 'Estoy empezando', occasional: 'Ya lo he probado', experienced: 'Tengo una rutina' },
  },
  de: {
    step: 'Schritt', start: 'Starten', startTitle: 'Deine Übung in drei Momenten', introShort: 'Tagsüber beobachten. Eine Absicht setzen. Beim Aufwachen notieren.', goal: 'Wähle deinen Weg', experience: 'Deine Erfahrung', experienceQuestion: 'Wo startest du?', startingPoint: 'Ausgangspunkt', reminders: 'Übungsrhythmus', rhythmTitle: 'Finde deinen Rhythmus', rhythmSubtitle: 'Drei Tage reichen für den Anfang.', recommended: 'Empfohlen', sleep: 'Dein Schlaffenster', bed: 'Schlafenszeit', wake: 'Aufstehzeit', invalidTime: 'Nutze eine gültige 24-Stunden-Zeit, zum Beispiel 22:30.', chooseOption: 'Wähle eine Option, um fortzufahren.', finish: 'Mein Training erstellen', days: 'Tage / Woche', dayUnit: 'Tage', summary: 'Dein Weg', goalLabel: 'Ziel', levelLabel: 'Niveau', rhythmLabel: 'Rhythmus', sleepFirst: 'Dein Schlaf steht immer an erster Stelle.', timePickerHint: 'Öffnet die Zeitauswahl des Systems.',
    startTitleDisplay: 'Deine Übung\nin drei Momenten',
    goalShort: { first_lucid_dream: 'Erster Klartraum', improve_recall: 'Träume erinnern', more_frequent_lucidity: 'Mehr Klarträume', stabilize_lucidity: 'Länger klar bleiben' },
    experienceHints: { beginner: 'Ich fange an', occasional: 'Ich habe es probiert', experienced: 'Ich habe eine Routine' },
  },
  it: {
    step: 'Passaggio', start: 'Inizia', startTitle: 'La tua pratica in tre momenti', introShort: 'Osserva di giorno. Scegli un intento. Annota al risveglio.', goal: 'Scegli il tuo orizzonte', experience: 'La tua esperienza', experienceQuestion: 'Da dove parti?', startingPoint: 'Punto di partenza', reminders: 'Ritmo di pratica', rhythmTitle: 'Trova il tuo ritmo', rhythmSubtitle: 'Tre giorni bastano per iniziare.', recommended: 'Consigliato', sleep: 'La tua finestra di sonno', bed: 'Ora di dormire', wake: 'Ora di sveglia', invalidTime: 'Usa un orario valido di 24 ore, per esempio 22:30.', chooseOption: 'Scegli un’opzione per continuare.', finish: 'Crea il mio allenamento', days: 'giorni / settimana', dayUnit: 'giorni', summary: 'Il tuo percorso', goalLabel: 'Obiettivo', levelLabel: 'Livello', rhythmLabel: 'Ritmo', sleepFirst: 'Il tuo sonno viene sempre prima di tutto.', timePickerHint: 'Apre il selettore dell’ora di sistema.',
    startTitleDisplay: 'La tua pratica\nin tre momenti',
    goalShort: { first_lucid_dream: 'Primo sogno lucido', improve_recall: 'Ricordare i sogni', more_frequent_lucidity: 'Più sogni lucidi', stabilize_lucidity: 'Restare lucido' },
    experienceHints: { beginner: 'Sto iniziando', occasional: 'Ho già provato', experienced: 'Ho una routine' },
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
  const { state, content, completeOnboarding } = useLucidTrainer();
  const locale = content.locale;
  const copy = LOCAL[locale];
  const initial = state!.onboarding;
  const [step, setStep] = useState(0);
  const [stepDirection, setStepDirection] = useState<-1 | 1>(1);
  const [goal, setGoal] = useState<LucidGoal | null>(initial.goal);
  const [experience, setExperience] = useState<LucidExperienceLevel | null>(initial.experience);
  const [weeklyTarget, setWeeklyTarget] = useState(initial.weeklyTarget);
  const [bedtime, setBedtime] = useState(initial.sleepSchedule.bedtime);
  const [wakeTime, setWakeTime] = useState(initial.sleepSchedule.wakeTime);
  const [saving, setSaving] = useState(false);

  const timeZone = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
  }, []);

  const canContinue =
    (step !== 1 || goal !== null) &&
    (step !== 2 || experience !== null) &&
    (step !== 4 || (isLucidLocalTime(bedtime) && isLucidLocalTime(wakeTime)));

  // Why the step is blocked is shown under the button itself, so it stays
  // visible while the user fixes it instead of vanishing with an alert.
  const blockedReason = canContinue ? undefined : step === 4 ? copy.invalidTime : copy.chooseOption;

  const next = async () => {
    if (!canContinue) return;
    if (step < STEP_COUNT - 1) {
      setStepDirection(1);
      setStep((value) => value + 1);
      return;
    }
    if (!goal || !experience) return;
    setSaving(true);
    try {
      await completeOnboarding({
        goal,
        experience,
        weeklyTarget,
        sleepSchedule: { bedtime, wakeTime, timeZone },
        notificationsPermission: initial.notificationsPermission,
        notificationsExplained: initial.notificationsExplained,
        audioSafetyAccepted: initial.audioSafetyAccepted,
        analyticsConsent: initial.analyticsConsent ?? false,
        accessibility: initial.accessibility,
        cloudSyncEnabled: state!.preferences.cloudSyncEnabled,
        noctaliaLinkEnabled: state!.preferences.noctaliaLinkEnabled,
      });
    } finally {
      setSaving(false);
    }
  };

  const titles = [copy.startTitle, copy.goal, copy.experience, copy.reminders, copy.sleep];
  const selectedExperience = content.onboarding.experienceLevels.find((choice) => choice.id === experience);
  const journeySummary = [
    goal ? copy.goalShort[goal] : '—',
    selectedExperience?.title ?? '—',
    `${weeklyTarget} ${copy.days}`,
  ].join(' · ');
  const reduceMotion = state!.onboarding.accessibility.reduceMotion;
  const reflow = width < 380 || fontScale >= 1.3;
  const stageMinHeight = reflow ? Math.max(720, height - 160) : Math.max(520, height - 280);
  const sleepStepTop = reflow ? 160 : Math.min(280, height * 0.26);

  return (
    <LucidScreen
      testID="lucid-onboarding"
      background={<LucidOnboardingBackdrop ambience={ambience} reduceMotion={reduceMotion} step={step} />}
      bottomInset={reflow ? 112 : 0}
      contentStyle={styles.screenContent}
      eyebrow={`${copy.step} ${step + 1} / ${STEP_COUNT}`}
      eyebrowTone="accent"
      scroll={reflow}
      footer={
        <View style={[styles.primaryAction, step === 0 && styles.primaryActionIntro]}>
          <LucidButton
            label={step === 0 ? copy.start : step === STEP_COUNT - 1 ? copy.finish : content.chrome.common.continue}
            disabled={!canContinue}
            disabledReason={blockedReason}
            immersive={step === 0}
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
            onPress={() => {
              setStepDirection(-1);
              setStep((value) => value - 1);
            }}
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
          <View style={styles.immersiveStep}>
            <LucidMomentPath />
            <View style={styles.introCopy}>
              <Text
                accessibilityLabel={copy.startTitle}
                accessibilityRole="header"
                style={[styles.immersiveTitle, { color: palette.text }]}
              >
                {copy.startTitleDisplay}
              </Text>
              <Text style={[styles.introSubtitle, { color: palette.textSecondary }]}>{copy.introShort}</Text>
            </View>
          </View>
        ) : null}

        {step === 1 ? (
          <LucidGoalSelector
            choices={content.onboarding.goals}
            label={copy.goal}
            onSelect={setGoal}
            reduceMotion={reduceMotion}
            selected={goal}
            shortLabels={copy.goalShort}
            title={copy.goal}
          />
        ) : null}

        {step === 2 ? (
          <LucidExperienceSelector
            choices={content.onboarding.experienceLevels}
            hints={copy.experienceHints}
            label={copy.experience}
            onSelect={setExperience}
            question={copy.experienceQuestion}
            reduceMotion={reduceMotion}
            selected={experience}
            startingPoint={copy.startingPoint}
          />
        ) : null}

        {step === 3 ? (
          <LucidRhythmSelector
            daysLabel={(value) => `${value} ${copy.dayUnit}`}
            label={copy.reminders}
            onSelect={setWeeklyTarget}
            recommended={copy.recommended}
            reduceMotion={reduceMotion}
            selected={weeklyTarget}
            subtitle={copy.rhythmSubtitle}
            title={copy.rhythmTitle}
          />
        ) : null}

        {step === 4 ? (
          <View style={[styles.sleepStep, { paddingTop: sleepStepTop }]}>
            <SleepWindowPicker
              bedtime={bedtime}
              bedtimeLabel={copy.bed}
              cancelLabel={content.chrome.common.cancel}
              doneLabel={content.chrome.common.done}
              locale={locale}
              onBedtimeChange={setBedtime}
              onWakeTimeChange={setWakeTime}
              pickerHint={copy.timePickerHint}
              reflow={reflow}
              wakeLabel={copy.wake}
              wakeTime={wakeTime}
            />
            <Text accessibilityRole="header" style={[styles.immersiveTitle, styles.sleepTitle, { color: palette.text }]}>
              {copy.sleep}
            </Text>
            <View style={styles.summaryBlock}>
              <LucidOverline text={copy.summary} tone="accent" />
              <Text style={[styles.journeySummary, { color: palette.textSecondary }]}>
                {journeySummary}
              </Text>
              <View style={styles.sleepPriorityRow}>
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={styles.sleepPriorityIcon}
                >
                  <Ionicons color={palette.amber} name="shield-checkmark-outline" size={LucidIcon.lg} />
                </View>
                <Text style={[styles.sleepPriorityText, { color: palette.amber }]}>
                  {copy.sleepFirst}
                </Text>
              </View>
            </View>
          </View>
        ) : null}
      </LucidOnboardingStage>

    </LucidScreen>
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

function localTimeToDate(value: string, fallback: string) {
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
  onBedtimeChange,
  onWakeTimeChange,
  pickerHint,
  reflow,
  wakeLabel,
  wakeTime,
}: {
  bedtime: string;
  bedtimeLabel: string;
  cancelLabel: string;
  doneLabel: string;
  locale: keyof typeof PICKER_LOCALES;
  onBedtimeChange: (value: string) => void;
  onWakeTimeChange: (value: string) => void;
  pickerHint: string;
  reflow: boolean;
  wakeLabel: string;
  wakeTime: string;
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
            pickerHint={pickerHint}
            reflow={reflow}
            testID="lucid-sleep-bedtime"
            tone="accent"
            valid={isLucidLocalTime(bedtime)}
            value={bedtime}
          />
          <SleepTimeChoice
            active={activePicker === 'wakeTime'}
            icon="sunny-outline"
            label={wakeLabel}
            onPress={() => openPicker('wakeTime')}
            pickerHint={pickerHint}
            reflow={reflow}
            testID="lucid-sleep-wake-time"
            tone="amber"
            valid={isLucidLocalTime(wakeTime)}
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
  onPress: () => void;
  pickerHint: string;
  reflow: boolean;
  testID: string;
  tone: 'accent' | 'amber';
  valid: boolean;
  value: string;
}) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const toneColor = tone === 'accent' ? palette.accentStrong : palette.amber;
  const toneSurface = tone === 'accent' ? palette.accentSoft : palette.amberSoft;

  return (
    <Pressable
      accessibilityHint={pickerHint}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ expanded: active }}
      accessibilityValue={{ text: value }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.timeChoice,
        reflow && styles.timeChoiceReflow,
        reflow && { backgroundColor: palette.overlay, borderColor: valid ? toneColor : palette.danger },
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
            borderColor: valid ? toneColor : palette.danger,
            opacity: active ? 1 : 0.86,
          },
        ]}
      >
        <View style={[styles.timeNode, { backgroundColor: valid ? toneColor : palette.danger }]} />
      </View>
      <View style={[styles.timeChoiceCopy, reflow && styles.timeChoiceCopyReflow]}>
        <Ionicons color={toneColor} name={icon} size={LucidIcon.lg} />
        <Text style={[styles.timeValue, { color: toneColor }]}>{value}</Text>
        <Text style={[styles.timeLabel, { color: toneColor }]}>· {label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screenContent: { gap: LucidSpace.md },
  progressRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: LucidSpace.lg },
  stage: { position: 'relative' },
  immersiveStep: { flex: 1, position: 'relative' },
  introCopy: { position: 'absolute', left: 0, right: 0, bottom: 64, gap: LucidSpace.md },
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
  sleepStep: { flex: 1, gap: LucidSpace.xl },
  sleepTitle: { maxWidth: 232 },
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
  summaryBlock: { gap: LucidSpace.md },
  journeySummary: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.bodySm[0],
    lineHeight: LucidType.bodySm[1],
  },
  sleepPriorityRow: { flexDirection: 'row', alignItems: 'center', gap: LucidSpace.md },
  sleepPriorityIcon: {
    width: 36,
    height: 36,
    borderRadius: LucidRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepPriorityText: {
    flex: 1,
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: LucidType.bodySm[0],
    lineHeight: LucidType.bodySm[1],
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
  primaryActionIntro: { paddingBottom: 48 },
});
