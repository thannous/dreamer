import * as Speech from 'expo-speech';

import type { VoiceLiveSpikeTts } from '@/lib/voiceLiveSpikeHost';

export async function speakVoiceLiveSpikeUtterance(text: string): Promise<void> {
  const utterance = text.trim();
  if (!utterance) return;
  await Speech.stop();
  await new Promise<void>((resolve) => {
    Speech.speak(utterance, {
      onDone: () => resolve(),
      onStopped: () => resolve(),
      onError: () => resolve(),
    });
  });
}

export async function stopVoiceLiveSpikeSpeech(): Promise<void> {
  await Speech.stop();
}

export const voiceLiveSpikeTts: VoiceLiveSpikeTts = {
  speak: speakVoiceLiveSpikeUtterance,
  stop: stopVoiceLiveSpikeSpeech,
};
