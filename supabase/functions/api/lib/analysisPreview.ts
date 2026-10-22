import type { StructuredDreamAnalysis } from '../services/dreamAnalysis.ts';
import { DREAM_THEME_VALUES } from './dreamThemes.ts';

/**
 * A free account past its monthly analyses gets one new prepared analysis per rolling week.
 * hold_analysis_preview (20261021235000) holds it within the same seven days.
 */
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

/**
 * The reading's prose, as plain text: the interpretation is Markdown, opened by a heading
 * meaning "What stands out", and the card shows its first sentence as a plain line.
 */
const plainProse = (markdown: string) => markdown
  .split('\n').filter((line) => !/^\s*#{1,6}(\s|$)/.test(line)).join('\n')
  .replace(/^\s*(?:[-*+]|\d+[.)]|>)\s+/gm, '')
  .replace(/(\*\*|__|\*|_|`)(\S(?:.*?\S)?)\1/g, '$2');

/** A painting still under way after this has failed. */
export const PREVIEW_PAINTING_TIMEOUT_MS = 3 * 60 * 1000;

/** The reading's first sentence, as a free account reads it. */
export function previewOpening(interpretation: string): string {
  const text = plainProse(interpretation).trim().replace(/\s+/g, ' ');
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

/** Postgres btrim() with no characters given: spaces only, not other whitespace. */
const btrim = (value: string) => value.replace(/^ +| +$/g, '');
const trimmedWithin = (value: unknown, min: number, max: number) =>
  typeof value === 'string' && btrim(value).length >= min && btrim(value).length <= max;

/** A reading complete_authenticated_analysis_job saves as it is: same fields, same limits. */
export function isPreparedReading(value: unknown): value is StructuredDreamAnalysis {
  const reading = value as Partial<StructuredDreamAnalysis> | null;
  return Boolean(reading) && trimmedWithin(reading?.title, 1, 500) && trimmedWithin(reading?.interpretation, 1, 20000)
    && trimmedWithin(reading?.shareableQuote, 0, 2000)
    && typeof reading?.theme === 'string' && DREAM_THEME_VALUES.includes(btrim(reading.theme))
    && trimmedWithin(reading?.dreamType, 0, 200) && trimmedWithin(reading?.imagePrompt, 1, 1000)
    && Array.isArray(reading?.symbols) && Array.isArray(reading?.emotions) && Array.isArray(reading?.reflectionQuestions);
}

// deno-lint-ignore no-explicit-any
type AdminClient = { from: (table: string) => any };

/**
 * The reading prepared for this dream from this very transcript and in this language, if one
 * waits. Once the analysis is saved, the dream's is_analyzed trigger spends it.
 */
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
