import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { Alert, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import {
  LucidNightSanctuary,
  shouldUseLucidNightReflow,
} from '@/components/lucid/LucidNightSanctuary';
import {
  LUCID_TAB_BAR_INSET,
  LucidButton,
  LucidScreen,
  LucidToggleRow,
} from '@/components/lucid/LucidUI';
import { getLucidPalette, LucidIcon, LucidPress, LucidRadius, LucidSpace, LucidType } from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import { useLucidNightAudio, type LucidNightRemaining } from '@/hooks/useLucidNightAudio';
import { useSleepSoundPlayer } from '@/hooks/useSleepSoundPlayer';
import {
  MAX_LUCID_NIGHT_VOLUME,
  resolveLucidNightCueCalibration,
} from '@/lib/lucid/audio';
import {
  canUseLucidNightSignals,
  evaluateLucidSafetyPolicyFromState,
} from '@/lib/lucid/safety';
import { DEFAULT_SLEEP_SOUND_ID, SLEEP_SOUNDS, type SleepSoundId } from '@/lib/sleepSounds';

const NIGHT_SANCTUARY = require('../../../assets/images/lucid/night-ritual-sanctuary.png');

const SOUND_ICONS = {
  rain: 'rainy',
  ocean: 'water',
  'brown-noise': 'pulse',
} as const;

const VOLUME_OPTIONS = [0.1, 0.15, 0.2, 0.25, 0.3] as const;
const TIMER_OPTIONS = [240, 360, 480] as const;

const COPY = {
  en: {
    eyebrow: 'Before sleep',
    title: 'Set a quiet intention',
    subtitle: 'Night signals are optional. Your sleep matters more than any technique.',
    sleepWindow: 'Sleep window',
    bedtime: 'Bedtime',
    wakeTime: 'Wake time',
    library: 'Falling-asleep ambience',
    rain: 'Soft rain',
    ocean: 'Ocean pulse',
    'brown-noise': 'Brown noise',
    ambiencePlay: 'Play ambience',
    ambiencePause: 'Pause ambience',
    ambienceStop: 'Stop ambience',
    ambienceHint: 'Local rain, ocean or brown noise for 30 minutes. It does not need night-signal permission.',
    volume: 'Prudent TLR volume',
    timer: 'Night window',
    hours: 'hours',
    cueSection: 'Experimental TLR cue',
    preview: 'Preview 1.2-second cue',
    start: 'Start night signals',
    stop: 'Stop signals',
    active: 'Signals active',
    next: 'TLR is experimental. A short local rain cue may play later; it cannot detect REM in real time or guarantee a REM phase.',
    reduced: 'After one signal wake, tonight stays at two very-low cues.',
    suspended: 'After two signal wakes, TLR is suspended until you review it in the morning.',
    speaker: 'Use the phone speaker at a low volume. Do not sleep with headphones.',
    systemVolume: 'The cue is a fixed 1.2-second rain signal, capped at 30%. Night notifications also follow the device notification volume.',
    cueTitle: 'Lucid Trainer',
    cueBody: 'A gentle reality cue. Notice your surroundings.',
    fragile: 'My sleep feels fragile tonight',
    hearing: 'I have a hearing concern',
    route: 'I will use the phone speaker',
    safety: 'Audio safety',
    prep: 'Tonight’s preparation',
    morning: 'Open morning review',
    blocked: 'Signals are unavailable until every safety condition and notification permission is met.',
    needs: 'Still required:',
    needAck: 'accept audio safety',
    accept: 'I accept the night audio safety rules',
    needSpeaker: 'phone speaker',
    needRested: 'uncheck “fragile sleep”',
    needHearing: 'uncheck “hearing concern”',
    failed: 'Night notifications or audio are unavailable on this device.',
    remaining: 'remaining',
    signals: 'Optional settings',
    hideSignals: 'Hide ambience and experimental cue',
    showSignals: 'Show ambience and experimental cue',
  },
  fr: {
    eyebrow: 'Avant le sommeil',
    title: 'Posez une intention calme',
    subtitle: 'Les signaux nocturnes sont facultatifs. Votre sommeil passe avant toute technique.',
    sleepWindow: 'Fenêtre de sommeil',
    bedtime: 'Coucher',
    wakeTime: 'Réveil',
    library: 'Ambiance d’endormissement',
    rain: 'Pluie douce',
    ocean: 'Pulsation océan',
    'brown-noise': 'Bruit brun',
    ambiencePlay: 'Lancer l’ambiance',
    ambiencePause: 'Mettre l’ambiance en pause',
    ambienceStop: 'Arrêter l’ambiance',
    ambienceHint: 'Pluie, océan ou bruit brun en local pendant 30 minutes. Aucune permission de signal nocturne n’est requise.',
    volume: 'Volume TLR prudent',
    timer: 'Fenêtre nocturne',
    hours: 'heures',
    cueSection: 'Signal TLR expérimental',
    preview: 'Aperçu du signal de 1,2 s',
    start: 'Démarrer les signaux',
    stop: 'Arrêter les signaux',
    active: 'Signaux actifs',
    next: 'Le TLR est expérimental. Un court signal de pluie local peut retentir plus tard ; il ne détecte pas le REM en temps réel et ne garantit aucune phase REM.',
    reduced: 'Après un réveil lié au signal, la nuit reste à deux signaux très faibles.',
    suspended: 'Après deux réveils liés au signal, le TLR est suspendu jusqu’au bilan du matin.',
    speaker: 'Utilisez le haut-parleur du téléphone à faible volume. Ne dormez pas avec un casque.',
    systemVolume: 'Le signal est une pluie fixe de 1,2 s, plafonnée à 30 %. Les notifications nocturnes suivent aussi le volume système.',
    cueTitle: 'Lucid Trainer',
    cueBody: 'Signal de réalité doux. Observez votre environnement.',
    fragile: 'Mon sommeil semble fragile ce soir',
    hearing: 'J’ai une fragilité auditive',
    route: 'J’utiliserai le haut-parleur du téléphone',
    safety: 'Sécurité audio',
    prep: 'Préparation de ce soir',
    morning: 'Ouvrir le bilan du matin',
    blocked: 'Les signaux restent indisponibles sans conditions de sécurité et permission de notifications.',
    needs: 'Encore nécessaire :',
    needAck: 'accepter la sécurité audio',
    accept: 'J’accepte les règles de sécurité audio nocturne',
    needSpeaker: 'haut-parleur du téléphone',
    needRested: 'décocher « sommeil fragile »',
    needHearing: 'décocher « fragilité auditive »',
    failed: 'Les notifications nocturnes ou l’audio sont indisponibles sur cet appareil.',
    remaining: 'restantes',
    signals: 'Réglages facultatifs',
    hideSignals: 'Masquer ambiance et signal expérimental',
    showSignals: 'Afficher ambiance et signal expérimental',
  },
  es: {
    eyebrow: 'Antes de dormir',
    title: 'Fija una intención tranquila',
    subtitle: 'Las señales nocturnas son opcionales. Tu sueño importa más que cualquier técnica.',
    sleepWindow: 'Horario de sueño',
    bedtime: 'Dormir',
    wakeTime: 'Despertar',
    library: 'Ambiente para conciliar el sueño',
    rain: 'Lluvia suave',
    ocean: 'Pulso oceánico',
    'brown-noise': 'Ruido marrón',
    ambiencePlay: 'Reproducir ambiente',
    ambiencePause: 'Pausar ambiente',
    ambienceStop: 'Detener ambiente',
    ambienceHint: 'Lluvia, océano o ruido marrón local durante 30 minutos. No requiere permiso de señales nocturnas.',
    volume: 'Volumen TLR prudente',
    timer: 'Ventana nocturna',
    hours: 'horas',
    cueSection: 'Señal TLR experimental',
    preview: 'Vista previa de 1,2 s',
    start: 'Iniciar señales',
    stop: 'Detener señales',
    active: 'Señales activas',
    next: 'El TLR es experimental. Puede sonar más tarde una lluvia local breve; no detecta el REM en tiempo real ni garantiza una fase REM.',
    reduced: 'Tras un despertar por la señal, esta noche se queda en dos señales muy bajas.',
    suspended: 'Tras dos despertares por la señal, el TLR queda suspendido hasta la revisión de la mañana.',
    speaker: 'Usa el altavoz del teléfono a bajo volumen. No duermas con auriculares.',
    systemVolume: 'La señal es una lluvia fija de 1,2 s, limitada al 30 %. Las notificaciones también siguen el volumen del sistema.',
    cueTitle: 'Lucid Trainer',
    cueBody: 'Señal de realidad suave. Observa tu entorno.',
    fragile: 'Mi sueño está frágil esta noche',
    hearing: 'Tengo una preocupación auditiva',
    route: 'Usaré el altavoz del teléfono',
    safety: 'Seguridad de audio',
    prep: 'Preparación de esta noche',
    morning: 'Abrir revisión matinal',
    blocked: 'Las señales requieren todas las condiciones y el permiso de notificaciones.',
    needs: 'Aún necesario:',
    needAck: 'aceptar la seguridad de audio',
    accept: 'Acepto las reglas de seguridad de audio nocturno',
    needSpeaker: 'altavoz del teléfono',
    needRested: 'desmarcar «sueño frágil»',
    needHearing: 'desmarcar «fragilidad auditiva»',
    failed: 'Las notificaciones nocturnas o el audio no están disponibles.',
    remaining: 'restantes',
    signals: 'Ajustes opcionales',
    hideSignals: 'Ocultar ambiente y señal experimental',
    showSignals: 'Mostrar ambiente y señal experimental',
  },
  de: {
    eyebrow: 'Vor dem Schlaf',
    title: 'Eine ruhige Absicht setzen',
    subtitle: 'Nachtsignale sind optional. Schlaf ist wichtiger als jede Technik.',
    sleepWindow: 'Schlaffenster',
    bedtime: 'Schlafen',
    wakeTime: 'Aufwachen',
    library: 'Einschlafatmosphäre',
    rain: 'Sanfter Regen',
    ocean: 'Meeresimpuls',
    'brown-noise': 'Braunes Rauschen',
    ambiencePlay: 'Atmosphäre starten',
    ambiencePause: 'Atmosphäre pausieren',
    ambienceStop: 'Atmosphäre stoppen',
    ambienceHint: 'Lokaler Regen, Ozean oder braunes Rauschen für 30 Minuten. Keine Nachtsignal-Erlaubnis nötig.',
    volume: 'Vorsichtige TLR-Lautstärke',
    timer: 'Nachtfenster',
    hours: 'Stunden',
    cueSection: 'Experimentelles TLR-Signal',
    preview: '1,2-Sekunden-Signal anhören',
    start: 'Nachtsignale starten',
    stop: 'Signale stoppen',
    active: 'Signale aktiv',
    next: 'TLR ist experimentell. Ein kurzes lokales Regensignal kann später ertönen; es erkennt REM nicht in Echtzeit und garantiert keine REM-Phase.',
    reduced: 'Nach einem Signalweck bleibt die Nacht bei zwei sehr leisen Signalen.',
    suspended: 'Nach zwei Signalwecks ist TLR bis zur Morgenprüfung ausgesetzt.',
    speaker: 'Nutze den Telefonlautsprecher leise. Schlafe nicht mit Kopfhörern.',
    systemVolume: 'Das Signal ist ein festes 1,2-Sekunden-Regenstück, begrenzt auf 30 %. Nachtsignale folgen auch der Systemlautstärke.',
    cueTitle: 'Lucid Trainer',
    cueBody: 'Sanftes Realitätssignal. Nimm deine Umgebung wahr.',
    fragile: 'Mein Schlaf ist heute fragil',
    hearing: 'Ich habe Hörbedenken',
    route: 'Ich nutze den Telefonlautsprecher',
    safety: 'Audiosicherheit',
    prep: 'Vorbereitung heute',
    morning: 'Morgenrückblick öffnen',
    blocked: 'Signale erfordern alle Sicherheitsbedingungen und die Benachrichtigungsfreigabe.',
    needs: 'Noch nötig:',
    needAck: 'Audio-Sicherheit bestätigen',
    accept: 'Ich akzeptiere die Regeln zur Nacht-Audiosicherheit',
    needSpeaker: 'Telefonlautsprecher',
    needRested: '„fragiler Schlaf“ abwählen',
    needHearing: '„Hörempfindlichkeit“ abwählen',
    failed: 'Nachtsignale oder Audio sind auf diesem Gerät nicht verfügbar.',
    remaining: 'verbleibend',
    signals: 'Optionale Einstellungen',
    hideSignals: 'Atmosphäre und experimentelles Signal ausblenden',
    showSignals: 'Atmosphäre und experimentelles Signal anzeigen',
  },
  it: {
    eyebrow: 'Prima di dormire',
    title: 'Imposta un’intenzione calma',
    subtitle: 'I segnali notturni sono facoltativi. Il sonno conta più di ogni tecnica.',
    sleepWindow: 'Finestra di sonno',
    bedtime: 'Dormire',
    wakeTime: 'Risveglio',
    library: 'Ambiente per addormentarsi',
    rain: 'Pioggia lieve',
    ocean: 'Impulso oceanico',
    'brown-noise': 'Rumore marrone',
    ambiencePlay: 'Avvia ambiente',
    ambiencePause: 'Metti in pausa l’ambiente',
    ambienceStop: 'Ferma ambiente',
    ambienceHint: 'Pioggia, oceano o rumore marrone in locale per 30 minuti. Non serve il permesso dei segnali notturni.',
    volume: 'Volume TLR prudente',
    timer: 'Finestra notturna',
    hours: 'ore',
    cueSection: 'Segnale TLR sperimentale',
    preview: 'Anteprima del segnale da 1,2 s',
    start: 'Avvia segnali',
    stop: 'Ferma segnali',
    active: 'Segnali attivi',
    next: 'Il TLR è sperimentale. Più tardi può suonare una breve pioggia locale; non rileva il REM in tempo reale e non garantisce una fase REM.',
    reduced: 'Dopo un risveglio da segnale, la notte resta a due segnali molto deboli.',
    suspended: 'Dopo due risvegli da segnale, il TLR è sospeso fino al bilancio del mattino.',
    speaker: 'Usa l’altoparlante del telefono a volume basso. Non dormire con cuffie.',
    systemVolume: 'Il segnale è una pioggia fissa di 1,2 s, limitata al 30 %. Le notifiche seguono anche il volume di sistema.',
    cueTitle: 'Lucid Trainer',
    cueBody: 'Segnale di realtà delicato. Osserva l’ambiente.',
    fragile: 'Il mio sonno è fragile stasera',
    hearing: 'Ho una sensibilità uditiva',
    route: 'Userò l’altoparlante del telefono',
    safety: 'Sicurezza audio',
    prep: 'Preparazione di stasera',
    morning: 'Apri bilancio mattutino',
    blocked: 'I segnali richiedono tutte le condizioni e il permesso notifiche.',
    needs: 'Ancora necessario:',
    needAck: 'accettare la sicurezza audio',
    accept: 'Accetto le regole di sicurezza audio notturna',
    needSpeaker: 'altoparlante del telefono',
    needRested: 'deselezionare «sonno fragile»',
    needHearing: 'deselezionare «fragilità uditiva»',
    failed: 'Le notifiche notturne o l’audio non sono disponibili.',
    remaining: 'rimanenti',
    signals: 'Impostazioni facoltative',
    hideSignals: 'Nascondi ambiente e segnale sperimentale',
    showSignals: 'Mostra ambiente e segnale sperimentale',
  },
} as const;

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 3600)}h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}m`;

/* The only subscriber to the night tick: the gradient, the sound cards, the volume levels and the switches must not repaint every 15 seconds. */
function NightCountdown({
  remaining,
  suffix,
  color,
}: {
  remaining: LucidNightRemaining;
  suffix: string;
  color: string;
}) {
  const seconds = useSyncExternalStore(remaining.subscribe, remaining.getSnapshot, remaining.getSnapshot);
  return <Text style={[styles.body, { color }]}>{`${formatTime(seconds)} ${suffix}`}</Text>;
}

function SleepWindowArc({
  accent,
  accentSoft,
  amber,
  amberSoft,
  bedtime,
  bedtimeLabel,
  border,
  reflow,
  text,
  textSecondary,
  title,
  wakeLabel,
  wakeTime,
}: {
  accent: string;
  accentSoft: string;
  amber: string;
  amberSoft: string;
  bedtime: string;
  bedtimeLabel: string;
  border: string;
  reflow: boolean;
  text: string;
  textSecondary: string;
  title: string;
  wakeLabel: string;
  wakeTime: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${title}. ${bedtimeLabel}: ${bedtime}. ${wakeLabel}: ${wakeTime}.`}
      accessibilityRole="summary"
      style={[styles.sleepWindow, reflow && styles.sleepWindowReflow]}
      testID="lucid-night-sleep-window"
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.sleepWindowVisual}
      >
        <View style={[styles.sleepEndpoint, reflow && styles.sleepEndpointReflow]}>
          <View style={[styles.sleepEndpointIcon, { backgroundColor: accentSoft }]}>
            <Ionicons color={accent} name="moon-outline" size={LucidIcon.md} />
          </View>
          <Text style={[styles.sleepEndpointLabel, { color: textSecondary }]}>{bedtimeLabel}</Text>
          <Text style={[styles.sleepEndpointTime, { color: text }]}>{bedtime}</Text>
        </View>

        <View style={[styles.sleepArcTrack, reflow && styles.sleepArcTrackReflow]}>
          <View style={[styles.sleepArcLine, { borderTopColor: border }]} />
          <View style={[styles.sleepArcPoint, { backgroundColor: accent }]} />
        </View>

        <View style={[styles.sleepEndpoint, reflow && styles.sleepEndpointReflow]}>
          <View
            style={[
              styles.sleepEndpointIcon,
              styles.sleepDawn,
              { backgroundColor: amberSoft, shadowColor: amber },
            ]}
          >
            <Ionicons color={amber} name="sunny-outline" size={LucidIcon.md} />
          </View>
          <Text style={[styles.sleepEndpointLabel, { color: textSecondary }]}>{wakeLabel}</Text>
          <Text style={[styles.sleepEndpointTime, { color: text }]}>{wakeTime}</Text>
        </View>
      </View>
    </View>
  );
}

export default function LucidNightScreen() {
  const { fontScale, width } = useWindowDimensions();
  const reflow = shouldUseLucidNightReflow(width, fontScale);
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { state, content, updateAudioSafetyConsent, updatePreferences } = useLucidTrainer();
  const copy = COPY[content.locale];
  const [soundId, setSoundId] = useState<SleepSoundId>(DEFAULT_SLEEP_SOUND_ID);
  const [timerMinutes, setTimerMinutes] = useState(360);
  const [speaker, setSpeaker] = useState(false);
  const [fragile, setFragile] = useState(false);
  const [hearing, setHearing] = useState(false);
  const [signalsOpen, setSignalsOpen] = useState(false);
  const volume = Math.min(MAX_LUCID_NIGHT_VOLUME, state!.preferences.audioVolume);
  const experiments = state!.experiments;
  const selectedAmbience = SLEEP_SOUNDS.find((sound) => sound.id === soundId) ?? SLEEP_SOUNDS[0];
  const ambience = useSleepSoundPlayer({
    sound: selectedAmbience,
    durationMinutes: 30,
    title: copy[selectedAmbience.id],
    albumTitle: copy.library,
  });
  const policy = useMemo(
    () =>
      evaluateLucidSafetyPolicyFromState(state, {
        sleepIsFragile: fragile,
        hearingConcern: hearing,
      }),
    [fragile, hearing, state],
  );
  const safety = useMemo(
    () => ({
      acknowledged: state!.onboarding.audioSafetyAccepted,
      playbackRoute: speaker ? ('speaker' as const) : ('unknown' as const),
      sleepIsFragile: fragile,
      hearingConcern: hearing,
    }),
    [fragile, hearing, speaker, state],
  );
  const audio = useLucidNightAudio({
    volume,
    timerMinutes,
    safety,
    policy,
    notificationTitle: copy.cueTitle,
    notificationBody: copy.cueBody,
    experiments,
  });
  const calibration = useMemo(
    () =>
      resolveLucidNightCueCalibration({
        requestedVolume: volume,
        policy,
        experiments,
      }),
    [experiments, policy, volume],
  );
  const signalsSuspended = calibration.status === 'suspended';
  const signalsAllowed = speaker && canUseLucidNightSignals(policy) && !signalsSuspended;
  const missing = (
    [
      safety.acknowledged ? null : copy.needAck,
      speaker ? null : copy.needSpeaker,
      fragile ? copy.needRested : null,
      hearing ? copy.needHearing : null,
      signalsSuspended ? copy.suspended : null,
    ] as (string | null)[]
  ).filter((label): label is string => label !== null);
  const showSignals = signalsOpen || !!audio.plan;
  const calibrationStatusCopy =
    calibration.status === 'suspended'
      ? copy.suspended
      : calibration.status === 'reduced'
        ? copy.reduced
        : null;

  const start = async () => {
    if (!signalsAllowed) return;
    if (!state!.preferences.audioCuesEnabled) await updatePreferences({ audioCuesEnabled: true });
    if (!(await audio.startNight())) Alert.alert(copy.safety, copy.blocked);
  };

  const selectAmbience = (nextSoundId: SleepSoundId) => {
    if (ambience.isPlaying || nextSoundId === soundId) return;
    void ambience.stop();
    setSoundId(nextSoundId);
  };

  return (
    <LucidScreen
      testID="lucid-night"
      bottomInset={LUCID_TAB_BAR_INSET}
      contentStyle={styles.screenContent}
    >
      <LucidNightSanctuary fadeColor={palette.background} reflow={reflow} source={NIGHT_SANCTUARY} />

      <View style={styles.mainContent}>
        <View style={styles.heroCopy}>
          <Text style={[styles.overline, { color: palette.accent }]}>{copy.eyebrow}</Text>
          <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>
            {copy.title}
          </Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{copy.subtitle}</Text>
        </View>

        <SleepWindowArc
          accent={palette.accent}
          accentSoft={palette.accentSoft}
          amber={palette.amber}
          amberSoft={palette.amberSoft}
          bedtime={state!.onboarding.sleepSchedule.bedtime}
          bedtimeLabel={copy.bedtime}
          border={palette.borderInteractive}
          reflow={reflow}
          text={palette.text}
          textSecondary={palette.textSecondary}
          title={copy.sleepWindow}
          wakeLabel={copy.wakeTime}
          wakeTime={state!.onboarding.sleepSchedule.wakeTime}
        />

        <View
          style={[
            styles.ritualCard,
            {
              backgroundColor: palette.surface,
              borderColor: audio.plan ? palette.accent : palette.border,
            },
          ]}
        >
          <View style={styles.ritualTop}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[
                styles.ritualMark,
                { backgroundColor: audio.plan ? palette.accentSoft : palette.surfaceRaised },
              ]}
            >
              <Ionicons
                color={audio.plan ? palette.accent : palette.textSecondary}
                name={audio.plan ? 'radio' : 'moon'}
                size={LucidIcon.lg}
              />
            </View>
            <View style={styles.ritualCopy}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>
                {audio.plan ? copy.active : copy.prep}
              </Text>
              {audio.plan ? (
                <NightCountdown remaining={audio.remaining} suffix={copy.remaining} color={palette.textSecondary} />
              ) : null}
            </View>
          </View>
          <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.next}</Text>
          {calibrationStatusCopy ? (
            <Text style={[styles.body, { color: palette.textSecondary }]}>{calibrationStatusCopy}</Text>
          ) : null}
          {audio.plan ? (
            <LucidButton
              label={copy.stop}
              variant="danger"
              icon="stop"
              onPress={() => void audio.stopNight()}
              testID="lucid-night-stop"
            />
          ) : (
            <LucidButton
              label={copy.start}
              icon="moon"
              disabled={!signalsAllowed || audio.isScheduling || signalsSuspended}
              disabledReason={
                !signalsAllowed || signalsSuspended
                  ? missing.length
                    ? `${copy.needs} ${missing.join(', ')}`
                    : copy.blocked
                  : undefined
              }
              onPress={() => void start()}
              testID="lucid-night-start"
            />
          )}
          {audio.error ? (
            <Text style={[styles.error, { color: palette.danger }]}>
              {copy.failed} ({audio.error})
            </Text>
          ) : null}
        </View>

        {/* Read the safeguards before accepting them; every row below gates only the experimental night cue. */}
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: palette.text }]}>
          {copy.safety}
        </Text>
        <View style={[styles.safetyCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          {content.nightSignals.safeguards.map((item) => (
            <View key={item} style={styles.safeguard}>
              <Ionicons
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                color={palette.accent}
                name="shield-checkmark"
                size={LucidIcon.md}
              />
              <Text style={[styles.safeguardText, { color: palette.textSecondary }]}>{item}</Text>
            </View>
          ))}
          <LucidToggleRow
            title={copy.accept}
            description={content.onboarding.audioPermission}
            value={safety.acknowledged}
            onValueChange={(value) => void updateAudioSafetyConsent(value)}
            icon="shield-checkmark"
            testID="lucid-night-audio-safety"
          />
          <LucidToggleRow
            title={copy.route}
            value={speaker}
            onValueChange={setSpeaker}
            icon="volume-low"
            testID="lucid-night-speaker"
          />
          <LucidToggleRow
            title={copy.fragile}
            value={fragile}
            onValueChange={setFragile}
            icon="bed"
            testID="lucid-night-fragile"
          />
          <LucidToggleRow
            title={copy.hearing}
            value={hearing}
            onValueChange={setHearing}
            icon="ear"
            testID="lucid-night-hearing"
            divider={false}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showSignals ? copy.hideSignals : copy.showSignals}
          accessibilityState={{ expanded: showSignals }}
          onPress={() => setSignalsOpen((open) => !open)}
          testID="lucid-night-signals-toggle"
          style={({ pressed }) => [
            styles.disclosure,
            {
              backgroundColor: palette.surface,
              borderColor: palette.borderInteractive,
              opacity: pressed ? LucidPress.opacity : 1,
            },
          ]}
        >
          <View style={styles.disclosureCopy}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>{copy.signals}</Text>
            <Text style={[styles.body, { color: palette.textSecondary }]}>
              {content.nightSignals.optionalLabel}
            </Text>
          </View>
          <Ionicons
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            color={palette.textSecondary}
            name={showSignals ? 'chevron-up' : 'chevron-down'}
            size={LucidIcon.lg}
          />
        </Pressable>

        {showSignals ? (
          <View style={styles.signals}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: palette.text }]}>
              {copy.library}
            </Text>
            <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.ambienceHint}</Text>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={copy.library}
              style={[styles.soundRow, reflow && styles.soundRowReflow]}
            >
              {SLEEP_SOUNDS.map((sound) => {
                const selected = sound.id === soundId;
                return (
                  <Pressable
                    key={sound.id}
                    disabled={ambience.isPlaying}
                    accessibilityRole="radio"
                    accessibilityLabel={copy[sound.id]}
                    accessibilityState={{ checked: selected, selected, disabled: ambience.isPlaying }}
                    onPress={() => selectAmbience(sound.id)}
                    testID={`lucid-night-ambience-${sound.id}`}
                    style={({ pressed }) => [
                      styles.sound,
                      reflow && styles.soundReflow,
                      {
                        backgroundColor: selected ? palette.accentSoft : palette.surfaceRaised,
                        borderColor: selected ? palette.accent : palette.borderInteractive,
                        opacity: pressed ? LucidPress.opacity : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      color={selected ? palette.accent : palette.textSecondary}
                      name={SOUND_ICONS[sound.id]}
                      size={LucidIcon.lg}
                    />
                    <Text style={[styles.soundLabel, { color: palette.text }]}>{copy[sound.id]}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={[styles.ambienceControls, reflow && styles.ambienceControlsReflow]}>
              <LucidButton
                label={ambience.isPlaying ? copy.ambiencePause : copy.ambiencePlay}
                variant="secondary"
                icon={ambience.isPlaying ? 'pause' : 'play'}
                disabled={!ambience.isLoaded || ambience.isBuffering}
                onPress={() => void (ambience.isPlaying ? ambience.pause() : ambience.play())}
                testID="lucid-night-ambience-play"
              />
              <LucidButton
                label={copy.ambienceStop}
                variant="ghost"
                icon="stop"
                onPress={() => void ambience.stop()}
                testID="lucid-night-ambience-stop"
              />
            </View>

            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: palette.text }]}>
              {copy.cueSection}
            </Text>
            <LucidButton
              label={copy.preview}
              variant="secondary"
              icon={audio.isPlaying ? 'volume-high' : 'play'}
              disabled={!signalsAllowed || !audio.isLoaded || audio.isScheduling || !!audio.plan || signalsSuspended}
              onPress={() => void audio.preview()}
              testID="lucid-night-preview"
            />

            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: palette.text }]}>
              {copy.volume}
            </Text>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={copy.volume}
              style={[styles.levels, reflow && styles.levelsReflow]}
            >
              {VOLUME_OPTIONS.map((value) => {
                const selected = Math.abs(volume - value) < 0.01;
                const label = `${Math.round(value * 100)}%`;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityLabel={`${copy.volume}, ${label}`}
                    accessibilityState={{ checked: selected, selected }}
                    onPress={() => void updatePreferences({ audioVolume: value })}
                    style={({ pressed }) => [
                      styles.level,
                      {
                        backgroundColor: selected ? palette.accent : palette.surfaceRaised,
                        opacity: pressed ? LucidPress.opacity : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.levelText,
                        { color: selected ? palette.backgroundDeep : palette.textSecondary },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.speaker}</Text>
            <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.systemVolume}</Text>

            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: palette.text }]}>
              {copy.timer}
            </Text>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={copy.timer}
              style={[styles.timerRow, reflow && styles.timerRowReflow]}
            >
              {TIMER_OPTIONS.map((value) => {
                const selected = timerMinutes === value;
                const hours = value / 60;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityLabel={`${copy.timer}, ${hours} ${copy.hours}`}
                    accessibilityState={{ checked: selected, selected }}
                    onPress={() => setTimerMinutes(value)}
                    style={({ pressed }) => [
                      styles.timer,
                      reflow && styles.timerReflow,
                      {
                        backgroundColor: selected ? palette.amberSoft : palette.surfaceRaised,
                        borderColor: selected ? palette.amber : palette.borderInteractive,
                        opacity: pressed ? LucidPress.opacity : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.timerValue, { color: selected ? palette.amber : palette.text }]}>
                      {hours}
                    </Text>
                    <Text style={[styles.timerLabel, { color: palette.textSecondary }]}>{copy.hours}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <LucidButton label={copy.morning} variant="ghost" icon="sunny" onPress={() => router.push('/lucid/morning')} />
      </View>
    </LucidScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
    gap: 0,
  },
  mainContent: {
    marginTop: -LucidSpace.xl * 2,
    paddingHorizontal: LucidSpace.gutter,
    gap: LucidSpace.lg,
  },
  heroCopy: { gap: LucidSpace.sm },
  overline: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.overline[0],
    lineHeight: LucidType.overline[1],
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: LucidType.display[0],
    lineHeight: LucidType.display[1],
    letterSpacing: -0.8,
  },
  subtitle: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.bodySm[0],
    lineHeight: LucidType.bodySm[1],
  },
  sleepWindow: {
    minHeight: 94,
    justifyContent: 'center',
  },
  sleepWindowReflow: {
    minHeight: 86,
  },
  sleepWindowVisual: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  sleepEndpoint: {
    width: 82,
    alignItems: 'center',
    gap: 2,
  },
  sleepEndpointReflow: {
    width: 68,
  },
  sleepEndpointIcon: {
    width: 38,
    height: 38,
    borderRadius: LucidRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: LucidSpace.xs,
  },
  sleepDawn: {
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  sleepEndpointLabel: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: LucidType.overline[0],
    lineHeight: LucidType.overline[1],
  },
  sleepEndpointTime: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.bodySm[0],
    lineHeight: LucidType.bodySm[1],
    fontVariant: ['tabular-nums'],
  },
  sleepArcTrack: {
    flex: 1,
    minWidth: 60,
    height: 36,
    marginTop: 18,
    position: 'relative',
  },
  sleepArcTrackReflow: {
    minWidth: 32,
  },
  sleepArcLine: {
    height: 32,
    borderTopWidth: 2,
    borderTopLeftRadius: LucidRadius.full,
    borderTopRightRadius: LucidRadius.full,
  },
  sleepArcPoint: {
    position: 'absolute',
    left: '50%',
    top: -2,
    width: 5,
    height: 5,
    marginLeft: -2.5,
    borderRadius: LucidRadius.full,
  },
  ritualCard: {
    borderRadius: LucidRadius.xl,
    borderWidth: 1,
    padding: LucidSpace.lg,
    gap: LucidSpace.md,
  },
  ritualTop: { flexDirection: 'row', alignItems: 'center', gap: LucidSpace.md },
  ritualMark: {
    width: 56,
    height: 56,
    borderRadius: LucidRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ritualCopy: { flex: 1, gap: LucidSpace.xs },
  cardTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.h3[0],
    lineHeight: LucidType.h3[1],
  },
  body: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
  error: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
  sectionTitle: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: LucidType.bodySm[0],
    lineHeight: LucidType.bodySm[1],
    letterSpacing: 0.2,
  },
  safetyCard: {
    borderRadius: LucidRadius.xl,
    borderWidth: 1,
    padding: LucidSpace.lg,
    gap: LucidSpace.md,
  },
  safeguard: { flexDirection: 'row', alignItems: 'flex-start', gap: LucidSpace.sm },
  safeguardText: {
    flex: 1,
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
  disclosure: {
    minHeight: 64,
    borderRadius: LucidRadius.xl,
    borderWidth: 1,
    paddingHorizontal: LucidSpace.lg,
    paddingVertical: LucidSpace.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: LucidSpace.md,
  },
  disclosureCopy: { flex: 1, gap: LucidSpace.xs },
  signals: { gap: LucidSpace.md },
  ambienceControls: { flexDirection: 'row', gap: LucidSpace.sm },
  ambienceControlsReflow: { flexDirection: 'column' },
  soundRow: { flexDirection: 'row', gap: LucidSpace.sm },
  soundRowReflow: { flexDirection: 'column' },
  sound: {
    flex: 1,
    minHeight: 88,
    borderRadius: LucidRadius.lg,
    borderWidth: 1,
    padding: LucidSpace.md,
    gap: LucidSpace.sm,
    justifyContent: 'center',
  },
  soundReflow: { width: '100%', flex: 0 },
  soundLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
  levels: { flexDirection: 'row', gap: LucidSpace.sm },
  levelsReflow: { flexWrap: 'wrap' },
  level: {
    flex: 1,
    minWidth: 56,
    minHeight: 44,
    borderRadius: LucidRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.overline[0],
    lineHeight: LucidType.overline[1],
  },
  timerRow: { flexDirection: 'row', gap: LucidSpace.sm },
  timerRowReflow: { flexDirection: 'column' },
  timer: {
    flex: 1,
    minHeight: 76,
    borderRadius: LucidRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: LucidSpace.xs,
  },
  timerReflow: { width: '100%', flex: 0 },
  timerValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.h2[0],
    lineHeight: LucidType.h2[1],
    fontVariant: ['tabular-nums'],
  },
  timerLabel: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: LucidType.overline[0],
    lineHeight: LucidType.overline[1],
  },
});
