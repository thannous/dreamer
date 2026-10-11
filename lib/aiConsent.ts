import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';

/**
 * One-time permission before a dream is shared with the third-party AI provider.
 *
 * App Review guideline 5.1.2(i) asks apps to disclose when personal data goes to a
 * third-party AI and to obtain explicit permission first. Analysis, quick
 * categorization, the guided conversation and illustrations all send the dream text
 * to the provider, so each entry point awaits this (or checks hasAiConsent for
 * silent background work) before calling the service. Writing and reading the journal
 * never need it.
 *
 * The web E2E fixtures pre-grant this key outside the consent journey.
 */
export const AI_CONSENT_STORAGE_KEY = 'noctalia.aiConsent.v1';
const STORAGE_KEY = AI_CONSENT_STORAGE_KEY;
const GRANTED = 'granted';

type Translate = (key: string) => string;

let granted: boolean | null = null;
let pending: Promise<boolean> | null = null;
// Owner decision (2026-10-10, maintained 2026-10-11): only signed-in users are asked.
// In mock mode a guest's analysis is a local demonstration. In production a guest's dream
// is still sent to the AI service (/analyzeDream, /categorizeDream) without this prompt; the
// owner accepted that App Review 5.1.2(i) and privacy risk (review on thannous/dreamer#327).
let promptRequired = false;

/** Set from the signed-in state: the consent prompt is shown to signed-in users only. */
export function setAiConsentPromptRequired(required: boolean): void {
  promptRequired = required;
}

export async function hasAiConsent(): Promise<boolean> {
  if (!promptRequired || granted) return true;
  try {
    granted = (await AsyncStorage.getItem(STORAGE_KEY)) === GRANTED;
  } catch {
    granted = false;
  }
  return granted;
}

/** Resolves true once the user has accepted, now or earlier; false if they decline. */
export async function requestAiConsent(t: Translate): Promise<boolean> {
  if (await hasAiConsent()) return true;
  // Several entry points can fire together (auto-sent chat topic, analysis after save).
  if (pending) return pending;
  pending = new Promise<boolean>((resolve) => {
    const accept = () => {
      granted = true;
      void AsyncStorage.setItem(STORAGE_KEY, GRANTED).catch(() => undefined);
      resolve(true);
    };
    // react-native-web's Alert is a no-op, which would leave AI features waiting
    // forever in the browser: use the browser's own confirmation dialog there.
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && typeof window.confirm === 'function'
        && window.confirm(`${t('ai_consent.title')}\n\n${t('ai_consent.message')}`);
      if (confirmed) accept();
      else resolve(false);
      return;
    }
    Alert.alert(
      t('ai_consent.title'),
      t('ai_consent.message'),
      [
        { text: t('ai_consent.decline'), style: 'cancel', onPress: () => resolve(false) },
        { text: t('ai_consent.accept'), onPress: accept },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  }).finally(() => {
    pending = null;
  });
  return pending;
}

/** Test helper: forget the in-memory decision. */
export function resetAiConsentCacheForTests(): void {
  granted = null;
  pending = null;
  promptRequired = false;
}
