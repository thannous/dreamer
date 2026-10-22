import type { StructuredDreamAnalysis } from '../services/dreamAnalysis.ts';

/** A free account past its monthly analyses gets one new prepared analysis per rolling week. */
export const ANALYSIS_PREVIEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * A prepared analysis's painting lives in the dream-images bucket under previews/<user id>/:
 * the bucket's policies give a signed-in account its own <user id>/ prefix only, so the
 * account reaches the band through its signed link and never the whole painting.
 */
export const PREVIEW_OBJECT_PREFIX = 'previews';
const OPENING_MAX_CHARS = 280;
const PREVIEW_SYMBOLS = 6;

/** Fingerprint of the transcript a reading was written from: an edited dream is read again. */
export async function transcriptSha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The reading's first sentence, as a free account reads it. */
export function previewOpening(interpretation: string): string {
  const text = interpretation.trim().replace(/\s+/g, ' ');
  const sentence = (/^.+?[.!?…](?=\s|$)/u.exec(text)?.[0] ?? text).trim();
  if (sentence.length <= OPENING_MAX_CHARS) return sentence;
  const cut = sentence.slice(0, OPENING_MAX_CHARS);
  const space = cut.lastIndexOf(' ');
  return `${(space > 0 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** What a free account reads of a prepared analysis: its title, first sentence and symbols' names. */
export function previewOf(reading: StructuredDreamAnalysis, title: string) {
  return {
    title,
    opening: previewOpening(reading.interpretation),
    symbols: reading.symbols.map((symbol) => symbol.name).slice(0, PREVIEW_SYMBOLS),
  };
}

/** A stored reading still has the shape an analysis job saves. */
export function isPreparedReading(value: unknown): value is StructuredDreamAnalysis {
  const reading = value as Partial<StructuredDreamAnalysis> | null;
  return Boolean(reading) && typeof reading?.title === 'string' && reading.title.length > 0
    && typeof reading.interpretation === 'string' && reading.interpretation.length > 0
    && typeof reading.shareableQuote === 'string' && typeof reading.theme === 'string'
    && typeof reading.dreamType === 'string' && typeof reading.imagePrompt === 'string'
    && Array.isArray(reading.symbols) && Array.isArray(reading.emotions) && Array.isArray(reading.reflectionQuestions);
}

// deno-lint-ignore no-explicit-any
type AdminClient = { from: (table: string) => any };

/** The reading prepared for this dream from this very transcript and in this language, if one waits. */
export async function takePreparedReading(admin: AdminClient, input: {
  userId: string;
  dreamId: number;
  lang: string;
  transcriptSha256: string;
}): Promise<StructuredDreamAnalysis | null> {
  try {
    const { data, error } = await admin.from('analysis_previews')
      .select('reading, lang, transcript_sha256')
      .eq('user_id', input.userId).eq('dream_id', input.dreamId).eq('status', 'ready')
      .maybeSingle();
    if (error || !data || data.lang !== input.lang || data.transcript_sha256 !== input.transcriptSha256) return null;
    return isPreparedReading(data.reading) ? data.reading : null;
  } catch {
    return null;
  }
}

/** Once the dream's analysis is saved, its prepared reading is spent and its text leaves the table. */
export async function spendPreparedReading(admin: AdminClient, input: { userId: string; dreamId: number }): Promise<void> {
  try {
    const { error } = await admin.from('analysis_previews')
      .update({ status: 'used', reading: null, updated_at: new Date().toISOString() })
      .eq('user_id', input.userId).eq('dream_id', input.dreamId).eq('status', 'ready');
    if (error) console.warn('[analysis-preview] could not spend a prepared reading', { code: error.code ?? null });
  } catch {
    console.warn('[analysis-preview] could not spend a prepared reading');
  }
}
