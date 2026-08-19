import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { LucidButton, LucidCard, LucidScreen, LucidSectionHeader, LucidToggleRow } from '@/components/lucid/LucidUI';
import { getLucidPalette } from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import { useLucidNightAudio } from '@/hooks/useLucidNightAudio';
import { MAX_LUCID_NIGHT_VOLUME } from '@/lib/lucid/audio';
import { SLEEP_SOUNDS, type SleepSoundId } from '@/lib/sleepSounds';

const COPY = {
  en: { eyebrow: 'Before sleep', title: 'Set a quiet intention', subtitle: 'Night signals are optional. Your sleep matters more than any technique.', library: 'Signal library', rain: 'Soft rain', ocean: 'Ocean pulse', 'brown-noise': 'Brown noise', volume: 'Prudent volume', timer: 'Night window', hours: 'hours', preview: 'Preview 7 seconds', start: 'Start night signals', stop: 'Stop signals', active: 'Signals active', next: 'Up to four dated local cues are scheduled. Missed cues are never replayed.', speaker: 'Use the phone speaker at a low volume. Do not sleep with headphones.', systemVolume: 'The preview is capped at 30%. Night notifications also follow the device notification volume.', cueTitle: 'Lucid Trainer', cueBody: 'A gentle reality cue. Notice your surroundings.', fragile: 'My sleep feels fragile tonight', hearing: 'I have a hearing concern', route: 'I will use the phone speaker', safety: 'Audio safety', prep: 'Tonight’s preparation', morning: 'Open morning review', blocked: 'Signals are unavailable until every safety condition and notification permission is met.', needs: 'Still required:', needAck: 'accept audio safety', needSpeaker: 'phone speaker', needRested: 'uncheck “fragile sleep”', needHearing: 'uncheck “hearing concern”', failed: 'Night notifications or audio are unavailable on this device.', remaining: 'remaining' },
  fr: { eyebrow: 'Avant le sommeil', title: 'Posez une intention calme', subtitle: 'Les signaux nocturnes sont facultatifs. Votre sommeil passe avant toute technique.', library: 'Bibliothèque de signaux', rain: 'Pluie douce', ocean: 'Pulsation océan', 'brown-noise': 'Bruit brun', volume: 'Volume prudent', timer: 'Fenêtre nocturne', hours: 'heures', preview: 'Aperçu de 7 secondes', start: 'Démarrer les signaux', stop: 'Arrêter les signaux', active: 'Signaux actifs', next: 'Jusqu’à quatre signaux locaux datés sont planifiés. Aucun signal manqué n’est rejoué.', speaker: 'Utilisez le haut-parleur du téléphone à faible volume. Ne dormez pas avec un casque.', systemVolume: 'L’aperçu est plafonné à 30 %. Les notifications nocturnes suivent aussi le volume système.', cueTitle: 'Lucid Trainer', cueBody: 'Signal de réalité doux. Observez votre environnement.', fragile: 'Mon sommeil semble fragile ce soir', hearing: 'J’ai une fragilité auditive', route: 'J’utiliserai le haut-parleur du téléphone', safety: 'Sécurité audio', prep: 'Préparation de ce soir', morning: 'Ouvrir le bilan du matin', blocked: 'Les signaux restent indisponibles sans conditions de sécurité et permission de notifications.', needs: 'Encore nécessaire :', needAck: 'accepter la sécurité audio', needSpeaker: 'haut-parleur du téléphone', needRested: 'décocher « sommeil fragile »', needHearing: 'décocher « fragilité auditive »', failed: 'Les notifications nocturnes ou l’audio sont indisponibles sur cet appareil.', remaining: 'restantes' },
  es: { eyebrow: 'Antes de dormir', title: 'Fija una intención tranquila', subtitle: 'Las señales nocturnas son opcionales. Tu sueño importa más que cualquier técnica.', library: 'Biblioteca de señales', rain: 'Lluvia suave', ocean: 'Pulso oceánico', 'brown-noise': 'Ruido marrón', volume: 'Volumen prudente', timer: 'Ventana nocturna', hours: 'horas', preview: 'Vista previa 7 segundos', start: 'Iniciar señales', stop: 'Detener señales', active: 'Señales activas', next: 'Se programan hasta cuatro señales locales fechadas. Las perdidas nunca se repiten.', speaker: 'Usa el altavoz del teléfono a bajo volumen. No duermas con auriculares.', systemVolume: 'La vista previa está limitada al 30 %. Las notificaciones también siguen el volumen del sistema.', cueTitle: 'Lucid Trainer', cueBody: 'Señal de realidad suave. Observa tu entorno.', fragile: 'Mi sueño está frágil esta noche', hearing: 'Tengo una preocupación auditiva', route: 'Usaré el altavoz del teléfono', safety: 'Seguridad de audio', prep: 'Preparación de esta noche', morning: 'Abrir revisión matinal', blocked: 'Las señales requieren todas las condiciones y el permiso de notificaciones.', needs: 'Aún necesario:', needAck: 'aceptar la seguridad de audio', needSpeaker: 'altavoz del teléfono', needRested: 'desmarcar «sueño frágil»', needHearing: 'desmarcar «fragilidad auditiva»', failed: 'Las notificaciones nocturnas o el audio no están disponibles.', remaining: 'restantes' },
  de: { eyebrow: 'Vor dem Schlaf', title: 'Eine ruhige Absicht setzen', subtitle: 'Nachtsignale sind optional. Schlaf ist wichtiger als jede Technik.', library: 'Signalbibliothek', rain: 'Sanfter Regen', ocean: 'Meeresimpuls', 'brown-noise': 'Braunes Rauschen', volume: 'Vorsichtige Lautstärke', timer: 'Nachtfenster', hours: 'Stunden', preview: '7 Sekunden anhören', start: 'Nachtsignale starten', stop: 'Signale stoppen', active: 'Signale aktiv', next: 'Bis zu vier lokale Signale werden terminiert. Verpasste Signale werden nie nachgeholt.', speaker: 'Nutze den Telefonlautsprecher leise. Schlafe nicht mit Kopfhörern.', systemVolume: 'Die Vorschau ist auf 30 % begrenzt. Nachtsignale folgen auch der Systemlautstärke.', cueTitle: 'Lucid Trainer', cueBody: 'Sanftes Realitätssignal. Nimm deine Umgebung wahr.', fragile: 'Mein Schlaf ist heute fragil', hearing: 'Ich habe Hörbedenken', route: 'Ich nutze den Telefonlautsprecher', safety: 'Audiosicherheit', prep: 'Vorbereitung heute', morning: 'Morgenrückblick öffnen', blocked: 'Signale erfordern alle Sicherheitsbedingungen und die Benachrichtigungsfreigabe.', needs: 'Noch nötig:', needAck: 'Audio-Sicherheit bestätigen', needSpeaker: 'Telefonlautsprecher', needRested: '„fragiler Schlaf“ abwählen', needHearing: '„Hörempfindlichkeit“ abwählen', failed: 'Nachtsignale oder Audio sind auf diesem Gerät nicht verfügbar.', remaining: 'verbleibend' },
  it: { eyebrow: 'Prima di dormire', title: 'Imposta un’intenzione calma', subtitle: 'I segnali notturni sono facoltativi. Il sonno conta più di ogni tecnica.', library: 'Libreria segnali', rain: 'Pioggia lieve', ocean: 'Impulso oceanico', 'brown-noise': 'Rumore marrone', volume: 'Volume prudente', timer: 'Finestra notturna', hours: 'ore', preview: 'Anteprima 7 secondi', start: 'Avvia segnali', stop: 'Ferma segnali', active: 'Segnali attivi', next: 'Vengono programmati fino a quattro segnali locali. Quelli persi non vengono mai ripetuti.', speaker: 'Usa l’altoparlante del telefono a volume basso. Non dormire con cuffie.', systemVolume: 'L’anteprima è limitata al 30 %. Le notifiche seguono anche il volume di sistema.', cueTitle: 'Lucid Trainer', cueBody: 'Segnale di realtà delicato. Osserva l’ambiente.', fragile: 'Il mio sonno è fragile stasera', hearing: 'Ho una sensibilità uditiva', route: 'Userò l’altoparlante del telefono', safety: 'Sicurezza audio', prep: 'Preparazione di stasera', morning: 'Apri bilancio mattutino', blocked: 'I segnali richiedono tutte le condizioni e il permesso notifiche.', needs: 'Ancora necessario:', needAck: 'accettare la sicurezza audio', needSpeaker: 'altoparlante del telefono', needRested: 'deselezionare «sonno fragile»', needHearing: 'deselezionare «fragilità uditiva»', failed: 'Le notifiche notturne o l’audio non sono disponibili.', remaining: 'rimanenti' },
} as const;

export default function LucidNightScreen() {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { state, content, updatePreferences } = useLucidTrainer();
  const copy = COPY[content.locale];
  const [soundId, setSoundId] = useState<SleepSoundId>('rain');
  const [timerMinutes, setTimerMinutes] = useState(360);
  const [speaker, setSpeaker] = useState(false);
  const [fragile, setFragile] = useState(false);
  const [hearing, setHearing] = useState(false);
  const volume = Math.min(MAX_LUCID_NIGHT_VOLUME, state!.preferences.audioVolume);
  const safety = useMemo(() => ({ acknowledged: state!.onboarding.audioSafetyAccepted, playbackRoute: speaker ? 'speaker' as const : 'unknown' as const, sleepIsFragile: fragile, hearingConcern: hearing }), [fragile, hearing, speaker, state]);
  const audio = useLucidNightAudio({ soundId, volume, timerMinutes, safety, notificationTitle: copy.cueTitle, notificationBody: copy.cueBody });
  const safe = safety.acknowledged && speaker && !fragile && !hearing;
  const missing = ([safety.acknowledged ? null : copy.needAck, speaker ? null : copy.needSpeaker, fragile ? copy.needRested : null, hearing ? copy.needHearing : null] as (string | null)[]).filter((label): label is string => label !== null);

  const start = async () => {
    if (!safe) return;
    if (!state!.preferences.audioCuesEnabled) await updatePreferences({ audioCuesEnabled: true });
    if (!(await audio.startNight())) Alert.alert(copy.safety, copy.blocked);
  };
  const formatTime = (seconds: number) => `${Math.floor(seconds / 3600)}h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}m`;

  return (
    <LucidScreen testID="lucid-night" eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle}>
      <LucidCard accent={audio.plan ? 'cyan' : 'violet'}>
        <View style={styles.activeTop}><View style={[styles.moon, { backgroundColor: audio.plan ? palette.cyanSoft : palette.accentSoft }]}><Ionicons name={audio.plan ? 'radio' : 'moon'} size={31} color={audio.plan ? palette.cyan : palette.accent} /></View><View style={styles.activeCopy}><Text style={[styles.cardTitle, { color: palette.text }]}>{audio.plan ? copy.active : copy.prep}</Text><Text style={[styles.body, { color: palette.textSecondary }]}>{audio.plan ? `${formatTime(audio.remainingSeconds)} ${copy.remaining}` : content.nightSignals.intro}</Text></View></View>
        <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.next}</Text>
        {audio.plan ? <LucidButton label={copy.stop} variant="danger" icon="stop" onPress={() => void audio.stopNight()} /> : <LucidButton label={copy.start} icon="moon" disabled={!safe || audio.isScheduling} disabledReason={missing.length ? `${copy.needs} ${missing.join(', ')}` : undefined} onPress={() => void start()} testID="lucid-night-start" />}
        {audio.error ? <Text style={[styles.error, { color: palette.danger }]}>{copy.failed} ({audio.error})</Text> : null}
      </LucidCard>

      {/* Safety comes first: these three switches are what gate the button above. */}
      <LucidSectionHeader title={copy.safety} />
      <LucidCard>
        <LucidToggleRow title={copy.route} value={speaker} onValueChange={setSpeaker} icon="volume-low" />
        <LucidToggleRow title={copy.fragile} value={fragile} onValueChange={setFragile} icon="bed" />
        <LucidToggleRow title={copy.hearing} value={hearing} onValueChange={setHearing} icon="ear" />
        {content.nightSignals.safeguards.map((item) => <View key={item} style={styles.safeguard}><Ionicons name="shield-checkmark" size={18} color={palette.cyan} /><Text style={[styles.safeguardText, { color: palette.textSecondary }]}>{item}</Text></View>)}
      </LucidCard>

      <LucidSectionHeader title={copy.library} caption={content.nightSignals.optionalLabel} />
      <View style={styles.soundRow}>
        {SLEEP_SOUNDS.map((sound) => {
          const selected = sound.id === (audio.plan?.soundId ?? soundId);
          return <Pressable key={sound.id} disabled={!!audio.plan} accessibilityRole="radio" accessibilityState={{ selected, disabled: !!audio.plan }} onPress={() => setSoundId(sound.id)} style={[styles.sound, { backgroundColor: selected ? palette.accentSoft : palette.surface, borderColor: selected ? palette.accent : palette.borderInteractive }]}><Ionicons name={sound.id === 'rain' ? 'rainy' : sound.id === 'ocean' ? 'water' : 'pulse'} size={24} color={selected ? palette.accent : palette.textSecondary} /><Text style={[styles.soundLabel, { color: palette.text }]}>{copy[sound.id]}</Text></Pressable>;
        })}
      </View>
      <LucidButton label={copy.preview} variant="secondary" icon={audio.isPlaying ? 'volume-high' : 'play'} disabled={!safe || !audio.isLoaded || audio.isScheduling || !!audio.plan} onPress={() => void audio.preview()} />

      <LucidSectionHeader title={copy.volume} />
      <LucidCard>
        <View style={styles.levels}>{[0.1, 0.15, 0.2, 0.25, 0.3].map((value) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: Math.abs(volume - value) < 0.01 }} onPress={() => void updatePreferences({ audioVolume: value })} style={[styles.level, { backgroundColor: Math.abs(volume - value) < 0.01 ? palette.cyan : palette.surfaceRaised }]}><Text style={[styles.levelText, { color: Math.abs(volume - value) < 0.01 ? palette.backgroundDeep : palette.textSecondary }]}>{Math.round(value * 100)}%</Text></Pressable>)}</View>
        <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.speaker}</Text>
        <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.systemVolume}</Text>
      </LucidCard>

      <LucidSectionHeader title={copy.timer} />
      <View style={styles.timerRow}>{[240, 360, 480].map((value) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: timerMinutes === value }} onPress={() => setTimerMinutes(value)} style={[styles.timer, { backgroundColor: timerMinutes === value ? palette.amberSoft : palette.surface, borderColor: timerMinutes === value ? palette.amber : palette.borderInteractive }]}><Text style={[styles.timerValue, { color: timerMinutes === value ? palette.amber : palette.text }]}>{value / 60}</Text><Text style={[styles.timerLabel, { color: palette.textSecondary }]}>{copy.hours}</Text></Pressable>)}</View>

      <LucidButton label={copy.morning} variant="ghost" icon="sunny" onPress={() => router.push('/lucid/morning')} />
    </LucidScreen>
  );
}

const styles = StyleSheet.create({
  activeTop: { flexDirection: 'row', alignItems: 'center', gap: 13 }, moon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, activeCopy: { flex: 1, gap: 4 }, cardTitle: { fontFamily: 'Fraunces_600SemiBold', fontSize: 21 }, body: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, lineHeight: 19 }, error: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 12 }, soundRow: { flexDirection: 'row', gap: 9 }, sound: { flex: 1, minHeight: 88, borderRadius: 18, borderWidth: 1, padding: 12, gap: 8, justifyContent: 'center' }, soundLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 12 }, levels: { flexDirection: 'row', gap: 7 }, level: { flex: 1, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, levelText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 11 }, timerRow: { flexDirection: 'row', gap: 9 }, timer: { flex: 1, minHeight: 76, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }, timerValue: { fontFamily: 'Fraunces_600SemiBold', fontSize: 25 }, timerLabel: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 11 }, safeguard: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, safeguardText: { flex: 1, fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, lineHeight: 17 },
});
