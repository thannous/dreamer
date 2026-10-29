import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';

/**
 * One-time permission before a dream is shared with the third-party AI providers.
 *
 * App Review guideline 5.1.2(i) asks apps to disclose when personal data goes to a
 * third-party AI and to obtain explicit permission first. Analysis, quick
 * categorization, the guided conversation and illustrations all send the dream text
 * to the provider, so each entry point awaits this (or checks hasAiConsent for
 * silent background work) before calling the service. Writing and reading the journal
 * never need it. Guests are asked too: their dreams reach the same providers.
 *
 * v2 (2026-10-19): a v1 grant is asked once more; a v2 grant is never asked again
 * unless it is withdrawn in Settings, after which the next AI action asks again.
 *
 * The web E2E fixtures pre-grant this key outside the consent journey.
 */
export const AI_CONSENT_STORAGE_KEY = 'noctalia.aiConsent.v2';
const STORAGE_KEY = AI_CONSENT_STORAGE_KEY;
const GRANTED = 'granted';

type Translate = (key: string) => string;

export type AiConsentPromptHandler = {
  show: () => Promise<boolean>;
};

let granted: boolean | null = null;
let pending: Promise<boolean> | null = null;
let promptHandler: AiConsentPromptHandler | null = null;
// Bumped by every decision so a storage read or prompt begun earlier cannot overrule it.
let decision = 0;
// A decision taken in this session is authoritative, even while its write is still pending.
let decided = false;
// Writes run in order: a withdrawal never lands before the grant it withdraws.
let storageWrites: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();
let stopStorageListener: (() => void) | null = null;

function listenForWebDecisions(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || stopStorageListener) return;
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    if (event.storageArea && event.storageArea !== window.localStorage) return;
    // A persisted external decision also invalidates older reads and prompts.
    // Do not echo it to storage: local writes retain their existing FIFO order.
    pending = null;
    decide(event.newValue === GRANTED);
  };
  window.addEventListener('storage', onStorage);
  stopStorageListener = () => window.removeEventListener('storage', onStorage);
}

function writeStorage(write: () => Promise<void>): Promise<void> {
  const next = storageWrites.then(write);
  storageWrites = next.catch(() => undefined);
  return next;
}

function decide(value: boolean): void {
  decision += 1;
  decided = true;
  granted = value;
  listeners.forEach((listener) => listener());
}

/** Notifies after each grant or withdrawal, so a visible setting follows the decision. */
export function subscribeAiConsent(listener: () => void): () => void {
  listenForWebDecisions();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Register the Noctalia-themed AI consent modal host.
 * Returns a cleanup that restores the previous handler if still current.
 */
export function registerAiConsentPromptHandler(handler: AiConsentPromptHandler | null): () => void {
  const previousHandler = promptHandler;
  promptHandler = handler;

  let cleanedUp = false;
  return () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (promptHandler === handler) {
      promptHandler = previousHandler;
    }
  };
}

export async function hasAiConsent(): Promise<boolean> {
  listenForWebDecisions();
  if (granted || decided) return granted === true;
  const asked = decision;
  let stored = false;
  try {
    stored = (await AsyncStorage.getItem(STORAGE_KEY)) === GRANTED;
  } catch {
    stored = false;
  }
  if (asked !== decision) return Boolean(granted);
  granted = stored;
  return granted;
}

/** Resolves true once the user has accepted, now or earlier; false if they decline. */
export async function requestAiConsent(t: Translate): Promise<boolean> {
  if (await hasAiConsent()) return true;
  // Several entry points can fire together (auto-sent chat topic, analysis after save).
  if (pending) return pending;
  const asked = decision;
  const request: Promise<boolean> = new Promise<boolean>((resolve) => {
    const accept = () => {
      // A withdrawal while this prompt was open wins: the next action asks again.
      if (asked !== decision) {
        resolve(false);
        return;
      }
      decide(true);
      void writeStorage(() => AsyncStorage.setItem(STORAGE_KEY, GRANTED)).catch(() => undefined);
      resolve(true);
    };
    // Android needs no separate AI disclosure: the AI action itself records the grant.
    if (Platform.OS === 'android') {
      accept();
      return;
    }
    if (promptHandler) {
      void promptHandler
        .show()
        .then((accepted) => {
          if (accepted) accept();
          else resolve(false);
        })
        .catch(() => resolve(false));
      return;
    }
    // Fallback when no modal host is mounted (isolated unit tests or headless environments).
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
    if (pending === request) pending = null;
  });
  pending = request;
  return request;
}

/**
 * Withdraws the permission from Settings. Nothing already written or read is removed; the
 * next AI action asks again before anything is sent. Withdrawn for this session even if the
 * device cannot store it, in which case this rejects so the setting can say so.
 */
export async function withdrawAiConsent(): Promise<void> {
  pending = null;
  decide(false);
  await writeStorage(() => AsyncStorage.removeItem(STORAGE_KEY));
}

/** Test helper: forget the in-memory decision. */
export function resetAiConsentCacheForTests(): void {
  stopStorageListener?.();
  stopStorageListener = null;
  granted = null;
  pending = null;
  decision += 1;
  decided = false;
  storageWrites = Promise.resolve();
  listeners.clear();
}
