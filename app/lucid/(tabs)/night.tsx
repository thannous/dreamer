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
import { MAX_LUCID_NIGHT_VOLUME } from '@/lib/lucid/audio';
import {
  canUseLucidNightSignals,
  evaluateLucidSafetyPolicyFromState,
} from '@/lib/lucid/safety';
import { SLEEP_SOUNDS, type SleepSoundId } from '@/lib/sleepSounds';

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
    library: 'Signal library',
    rain: 'Soft rain',
    ocean: 'Ocean pulse',
    'brown-noise': 'Brown noise',
    volume: 'Prudent volume',
    timer: 'Night window',
    hours: 'hours',
    preview: 'Preview 7 seconds',
    start: 'Start night signals',
    stop: 'Stop signals',
    active: 'Signals active',
    next: 'Up to four dated local cues are scheduled. Missed cues are never replayed.',
    speaker: 'Use the phone speaker at a low volume. Do not sleep with headphones.',
    systemVolume: 'The preview is capped at 30%. Night notifications also follow the device notification volume.',
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
    signals: 'Optional signals',
    hideSignals: 'Hide sound, volume and duration',
    showSignals: 'Choose sound, volume and duration',
  },
  fr: {
    eyebrow: 'Avant le sommeil',
    title: 'Posez une intention calme',
    subtitle: 'Les signaux nocturnes sont facultatifs. Votre sommeil passe avant toute technique.',
    sleepWindow: 'Fenêtre de sommeil',
    bedtime: 'Coucher',
    wakeTime: 'Réveil',
    library: 'Bibliothèque de signaux',
    rain: 'Pluie douce',
    ocean: 'Pulsation océan',
    'brown-noise': 'Bruit brun',
    volume: 'Volume prudent',
    timer: 'Fenêtre nocturne',
    hours: 'heures',
    preview: 'Aperçu de 7 secondes',
    start: 'Démarrer les signaux',
    stop: 'Arrêter les signaux',
    active: 'Signaux actifs',
    next: 'Jusqu’à quatre signaux locaux datés sont planifiés. Aucun signal manqué n’est rejoué.',
    speaker: 'Utilisez le haut-parleur du téléphone à faible volume. Ne dormez pas avec un casque.',
    systemVolume: 'L’aperçu est plafonné à 30 %. Les notifications nocturnes suivent aussi le volume système.',
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
    signals: 'Signaux facultatifs',
    hideSignals: 'Masquer son, volume et durée',
    showSignals: 'Choisir son, volume et durée',
  },
  es: {
    eyebrow: 'Antes de dormir',
    title: 'Fija una intención tranquila',
    subtitle: 'Las señales nocturnas son opcionales. Tu sueño importa más que cualquier técnica.',
    sleepWindow: 'Horario de sueño',
    bedtime: 'Dormir',
    wakeTime: 'Despertar',
    library: 'Biblioteca de señales',
    rain: 'Lluvia suave',
    ocean: 'Pulso oceánico',
    'brown-noise': 'Ruido marrón',
    volume: 'Volumen prudente',
    timer: 'Ventana nocturna',
    hours: 'horas',
    preview: 'Vista previa 7 segundos',
    start: 'Iniciar señales',
    stop: 'Detener señales',
    active: 'Señales activas',
    next: 'Se programan hasta cuatro señales locales fechadas. Las perdidas nunca se repiten.',
    speaker: 'Usa el altavoz del teléfono a bajo volumen. No duermas con auriculares.',
    systemVolume: 'La vista previa está limitada al 30 %. Las notificaciones también siguen el volumen del sistema.',
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
    signals: 'Señales opcionales',
    hideSignals: 'Ocultar sonido, volumen y duración',
    showSignals: 'Elegir sonido, volumen y duración',
  },
  de: {
    eyebrow: 'Vor dem Schlaf',
    title: 'Eine ruhige Absicht setzen',
    subtitle: 'Nachtsignale sind optional. Schlaf ist wichtiger als jede Technik.',
    sleepWindow: 'Schlaffenster',
    bedtime: 'Schlafen',
    wakeTime: 'Aufwachen',
    library: 'Signalbibliothek',
    rain: 'Sanfter Regen',
    ocean: 'Meeresimpuls',
    'brown-noise': 'Braunes Rauschen',
    volume: 'Vorsichtige Lautstärke',
    timer: 'Nachtfenster',
    hours: 'Stunden',
    preview: '7 Sekunden anhören',
    start: 'Nachtsignale starten',
    stop: 'Signale stoppen',
    active: 'Signale aktiv',
    next: 'Bis zu vier lokale Signale werden terminiert. Verpasste Signale werden nie nachgeholt.',
    speaker: 'Nutze den Telefonlautsprecher leise. Schlafe nicht mit Kopfhörern.',
    systemVolume: 'Die Vorschau ist auf 30 % begrenzt. Nachtsignale folgen auch der Systemlautstärke.',
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
    signals: 'Optionale Signale',
    hideSignals: 'Klang, Lautstärke und Dauer ausblenden',
    showSignals: 'Klang, Lautstärke und Dauer wählen',
  },
  it: {
    eyebrow: 'Prima di dormire',
    title: 'Imposta un’intenzione calma',
    subtitle: 'I segnali notturni sono facoltativi. Il sonno conta più di ogni tecnica.',
    sleepWindow: 'Finestra di sonno',
    bedtime: 'Dormire',
    wakeTime: 'Risveglio',
    library: 'Libreria segnali',
    rain: 'Pioggia lieve',
    ocean: 'Impulso oceanico',
    'brown-noise': 'Rumore marrone',
    volume: 'Volume prudente',
    timer: 'Finestra notturna',
    hours: 'ore',
    preview: 'Anteprima 7 secondi',
    start: 'Avvia segnali',
    stop: 'Ferma segnali',
    active: 'Segnali attivi',
    next: 'Vengono programmati fino a quattro segnali locali. Quelli persi non vengono mai ripetuti.',
    speaker: 'Usa l’altoparlante del telefono a volume basso. Non dormire con cuffie.',
    systemVolume: 'L’anteprima è limitata al 30 %. Le notifiche seguono anche il volume di sistema.',
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
    signals: 'Segnali facoltativi',
    hideSignals: 'Nascondi suono, volume e durata',
    showSignals: 'Scegli suono, volume e durata',
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
  const [soundId, setSoundId] = useState<SleepSoundId>('rain');
  const [timerMinutes, setTimerMinutes] = useState(360);
  const [speaker, setSpeaker] = useState(false);
  const [fragile, setFragile] = useState(false);
  const [hearing, setHearing] = useState(false);
  const [signalsOpen, setSignalsOpen] = useState(false);
  const volume = Math.min(MAX_LUCID_NIGHT_VOLUME, state!.preferences.audioVolume);
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
    soundId,
    volume,
    timerMinutes,
    safety,
    policy,
    notificationTitle: copy.cueTitle,
    notificationBody: copy.cueBody,
  });
  const signalsAllowed = speaker && canUseLucidNightSignals(policy);
  const missing = (
    [
      safety.acknowledged ? null : copy.needAck,
      speaker ? null : copy.needSpeaker,
      fragile ? copy.needRested : null,
      hearing ? copy.needHearing : null,
    ] as (string | null)[]
  ).filter((label): label is string => label !== null);
  const showSignals = signalsOpen || !!audio.plan;

  const start = async () => {
    if (!signalsAllowed) return;
    if (!state!.preferences.audioCuesEnabled) await updatePreferences({ audioCuesEnabled: true });
    if (!(await audio.startNight())) Alert.alert(copy.safety, copy.blocked);
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
              disabled={!signalsAllowed || audio.isScheduling}
              disabledReason={
                !signalsAllowed
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

        {/* Read the safeguards before accepting them; every row below gates audio. */}
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
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={copy.library}
              style={[styles.soundRow, reflow && styles.soundRowReflow]}
            >
              {SLEEP_SOUNDS.map((sound) => {
                const selected = sound.id === (audio.plan?.soundId ?? soundId);
                return (
                  <Pressable
                    key={sound.id}
                    disabled={!!audio.plan}
                    accessibilityRole="radio"
                    accessibilityLabel={copy[sound.id]}
                    accessibilityState={{ checked: selected, selected, disabled: !!audio.plan }}
                    onPress={() => setSoundId(sound.id)}
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

            <LucidButton
              label={copy.preview}
              variant="secondary"
              icon={audio.isPlaying ? 'volume-high' : 'play'}
              disabled={!signalsAllowed || !audio.isLoaded || audio.isScheduling || !!audio.plan}
              onPress={() => void audio.preview()}
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
