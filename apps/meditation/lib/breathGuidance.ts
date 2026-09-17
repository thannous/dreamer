import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';

import type { BreathPhaseType } from '@/content/breathing';
import type { AppLanguage } from '@/lib/types';

/** IETF tags so the localised phase name is spoken in the right voice. */
export const BREATH_VOICE_LOCALES: Record<AppLanguage, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-PT',
};

/**
 * One signature per phase, distinct in both API and feel, so a closed-eyes
 * practice can be followed from vibration alone — including the first breath.
 */
export type BreathHapticSignature =
  | { method: 'impactAsync'; style: Haptics.ImpactFeedbackStyle }
  | { method: 'selectionAsync' };

export const BREATH_HAPTIC_SIGNATURES: Record<BreathPhaseType, BreathHapticSignature> = {
  inhale: { method: 'impactAsync', style: Haptics.ImpactFeedbackStyle.Heavy },
  hold: { method: 'impactAsync', style: Haptics.ImpactFeedbackStyle.Rigid },
  exhale: { method: 'impactAsync', style: Haptics.ImpactFeedbackStyle.Soft },
  rest: { method: 'selectionAsync' },
};

export async function playBreathHaptic(phase: BreathPhaseType): Promise<void> {
  const signature = BREATH_HAPTIC_SIGNATURES[phase];
  if (signature.method === 'impactAsync') {
    await Haptics.impactAsync(signature.style);
    return;
  }
  await Haptics.selectionAsync();
}

export async function stopBreathVoice(): Promise<void> {
  try {
    await Speech.stop();
  } catch {
    // Missing TTS, simulator, or an already-idle engine.
  }
}

/**
 * Speak the current phase and drop anything still queued. A late "inhale"
 * after the breath has already moved on is worse than a skipped cue.
 */
export async function speakBreathPhase(
  text: string,
  language: AppLanguage
): Promise<void> {
  const phrase = text.trim();
  if (!phrase) return;
  await stopBreathVoice();
  Speech.speak(phrase, {
    language: BREATH_VOICE_LOCALES[language],
    pitch: 1,
    rate: 0.9,
  });
}
