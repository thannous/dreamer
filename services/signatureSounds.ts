import type { AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { AppState, Platform } from 'react-native';

import { getLucidKeyValueStorage } from '@/services/lucidKeyValueStorage';
import { isMicrophoneHeld } from '@/services/microphoneHold';
import { isSpeechRecognitionIdle } from '@/services/nativeSpeechRecognition';

/**
 * Noctalia's three signature moments, each heard once as it happens and felt under the finger:
 * - `seal`: a dream is saved, its seal pressed;
 * - `painting`: its painting leaves the seal for the top of its page;
 * - `echo`: a symbol of the new reading lights up, already met in other dreams.
 */
export type SignatureSound = 'seal' | 'painting' | 'echo';

type ExpoAudio = typeof import('expo-audio');

// Loaded with the first sound: a screen that only offers the setting never loads a player.
let expoAudio: ExpoAudio | undefined;
function audio(): ExpoAudio {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  expoAudio ??= require('expo-audio') as ExpoAudio;
  return expoAudio;
}

// Synthesized for Noctalia, all in D major pentatonic and matched at -18 LUFS.
function source(sound: SignatureSound): number {
  switch (sound) {
    case 'seal': return require('@/assets/audio/signature/seal.m4a');
    case 'painting': return require('@/assets/audio/signature/painting.m4a');
    case 'echo': return require('@/assets/audio/signature/echo.m4a');
  }
}

/** Well under the phone's media volume: a cue, never a fanfare. */
const VOLUME = 0.5;
/** The echo's answer, felt as it is heard. */
const ECHO_ANSWER_MS = 420;

// Kept beside the sleep sounds' preferences.
const STORAGE_KEY = 'noctalia_signature_sounds_v1';

let enabled: boolean | null = null;
// Counts the dreamer's choices: a read begun before one must not undo it.
let choices = 0;
const players = new Map<SignatureSound, AudioPlayer>();

/** Sounds are on unless the dreamer turned them off. */
export async function getSignatureSoundsEnabled(): Promise<boolean> {
  if (enabled !== null) return enabled;
  const asked = choices;
  let stored: boolean;
  try {
    stored = (await getLucidKeyValueStorage().getItem(STORAGE_KEY)) !== 'off';
  } catch {
    stored = true;
  }
  if (choices === asked) enabled = stored;
  return enabled ?? stored;
}

/** The choice already read this launch, or null before the first read. */
export function peekSignatureSoundsEnabled(): boolean | null {
  return enabled;
}

/** Takes effect at once; a choice that could not be stored is let go. */
export async function setSignatureSoundsEnabled(next: boolean): Promise<void> {
  const before = enabled;
  choices += 1;
  enabled = next;
  try {
    await getLucidKeyValueStorage().setItem(STORAGE_KEY, next ? 'on' : 'off');
  } catch (error) {
    enabled = before;
    throw error;
  }
}

function touch(sound: SignatureSound) {
  const soft = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
  if (sound === 'seal') {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  } else if (sound === 'painting') {
    void soft();
  } else {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setTimeout(soft, ECHO_ANSWER_MS);
  }
}

async function play(sound: SignatureSound) {
  if (!(await getSignatureSoundsEnabled())) return;
  if (AppState.currentState !== 'active') return;
  // A live dictation or recording owns the audio session; changing it would cut them off.
  if (isMicrophoneHeld() || !(await isSpeechRecognitionIdle())) return;
  // Ambient and mixed: silent with the ringer switch (iOS) or a silent or vibrating ringer
  // (Android, where expo-audio then declines to play), and never pausing the dreamer's music.
  // Recording and sleep sounds set their own mode before they start.
  await audio().setAudioModeAsync({
    allowsRecording: false,
    interruptionMode: 'mixWithOthers',
    playsInSilentMode: false,
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false,
  });
  let player = players.get(sound);
  if (!player) {
    player = audio().createAudioPlayer(source(sound));
    players.set(sound, player);
  }
  player.volume = VOLUME;
  await player.seekTo(0);
  player.play();
}

/**
 * Marks one of Noctalia's signature moments: its touch, then its sound when sounds are on
 * and the phone may ring. The web plays no sound and keeps only the save's vibration.
 */
export function playSignature(sound: SignatureSound): void {
  // Neither heard nor felt from the background, where a late cue would only buzz the pocket.
  if (AppState.currentState !== 'active') return;
  if (Platform.OS === 'web') {
    if (sound === 'seal') touch(sound);
    return;
  }
  touch(sound);
  void play(sound).catch((error) => {
    if (__DEV__) console.warn('[signatureSounds] could not play', sound, error);
  });
}
