/**
 * The live loudness of the microphone while dictation listens, for visuals only.
 * Values follow expo-speech-recognition's `volumechange`: about -2 (silence) to 10;
 * anything below 0 is inaudible. Nothing is stored or sent anywhere.
 */
type VoiceLevelListener = (value: number) => void;

const listeners = new Set<VoiceLevelListener>();

export const VOICE_LEVEL_SILENT = -2;

export function publishVoiceLevel(value: number) {
  for (const listener of listeners) listener(value);
}

export function subscribeVoiceLevel(listener: VoiceLevelListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
