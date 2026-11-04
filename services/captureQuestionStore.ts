import AsyncStorage from '@react-native-async-storage/async-storage';
import { fnv1a32Hex } from '@/lib/dreamAnalysisFreshness';

/**
 * The question Noctalia last asked about a capture draft, so reopening the draft shows it
 * again instead of asking the provider anew. The draft text is never stored here: the
 * record names its draft by a digest. It is forgotten when the draft ends (saved, cleared
 * or discarded), when a guest draft moves into an account, and when the account is deleted.
 */
export type SavedCaptureQuestion = { draft: string; question: string | null; done: boolean; previous: string[] };

// v1 (never released) named the draft by its full text; forgetting a scope removes it too.
const LEGACY_KEY = 'noctalia.capture.question.v1';
const KEY = 'noctalia.capture.question.v2';
const storageKey = (scope?: string) => `${KEY}:${scope ?? 'default'}`;

/** Identifies one draft revision in one language without keeping its text. */
export const captureQuestionDraftId = (language: string, text: string) => fnv1a32Hex(`${language}:${text}`);

export async function readCaptureQuestion(scope: string | undefined, draft: string): Promise<SavedCaptureQuestion | null> {
  try {
    const saved = JSON.parse((await AsyncStorage.getItem(storageKey(scope))) ?? 'null') as SavedCaptureQuestion | null;
    return saved?.draft === draft && Array.isArray(saved.previous) ? saved : null;
  } catch { return null; }
}

export function saveCaptureQuestion(scope: string | undefined, saved: SavedCaptureQuestion): void {
  AsyncStorage.setItem(storageKey(scope), JSON.stringify(saved)).catch(() => {});
}

export async function forgetCaptureQuestion(scope: string | undefined): Promise<void> {
  await Promise.all([storageKey(scope), `${LEGACY_KEY}:${scope ?? 'default'}`].map(key => AsyncStorage.removeItem(key)));
}
