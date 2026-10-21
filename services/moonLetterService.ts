import { fetchJSONWithSession } from '@/lib/apiSession';
import { getApiBaseUrl } from '@/lib/config';
import { isMockModeEnabled } from '@/lib/env';
import { moonCycleAt, MOON_LETTER_MIN_DREAMS } from '@/lib/moonLetter';
import { NETWORK_REQUEST_POLICIES } from '@/lib/networkPolicy';

export type MoonLetter = {
  fullMoonAt: string;
  lang: string;
  opening: string;
  /** The rest of the letter: null for a free account, which reads the opening only. */
  body: string | null;
  locked: boolean;
  dreamCount: number;
};

export type MoonLetterResult = {
  fullMoonAt: string;
  letter: MoonLetter | null;
  /** Why there is no letter: too few dreams this cycle, being written, or an earlier cycle without one. */
  reason: 'too_few_dreams' | 'writing' | 'not_written' | null;
  dreamCount: number | null;
  minDreams: number;
  previous: { fullMoonAt: string; opening: string; dreamCount: number }[];
};

const isText = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const isCount = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const isDate = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));

function parseResult(value: unknown): MoonLetterResult {
  const result = value as MoonLetterResult | null;
  const letter = result?.letter;
  if (!result || !isDate(result.fullMoonAt) || !isCount(result.minDreams) || !Array.isArray(result.previous)
    || !(result.reason === null || ['too_few_dreams', 'writing', 'not_written'].includes(result.reason))
    || !(result.dreamCount === null || isCount(result.dreamCount))
    || result.previous.some((entry) => !isDate(entry?.fullMoonAt) || !isText(entry.opening, 400) || !isCount(entry.dreamCount))
    || (letter !== null && (!letter || !isDate(letter.fullMoonAt) || !isText(letter.opening, 400) || !isCount(letter.dreamCount)
      || typeof letter.locked !== 'boolean' || (letter.locked ? letter.body !== null : !isText(letter.body, 4000))))
    || (letter === null && result.reason === null)) {
    throw new Error('Invalid moon letter response');
  }
  return result;
}

// Mock mode reads a fixed letter, so the screen can be seen without the api.
const MOCK_LETTERS: Record<'fr' | 'en', { opening: string; body: string }> = {
  fr: {
    opening: 'Ce cycle, l’eau est revenue dans presque tous tes rêves, d’abord comme une menace, puis comme un passage.',
    body: 'Au début, la mer montait derrière toi et tu cherchais une porte. Quelques nuits plus tard, tu marchais sur une rivière de verre sans avoir peur de tomber.\n\nLa maison de ton enfance est restée en arrière-plan, toujours éclairée, jamais habitée. Tu y entrais sans jamais t’y arrêter.\n\nQue se passerait-il si, au prochain cycle, tu ouvrais une de ses fenêtres ?',
  },
  en: {
    opening: 'This cycle, water came back in almost every dream, first as a threat, then as a way through.',
    body: 'At first the sea rose behind you and you looked for a door. A few nights later you walked on a river of glass without fear of falling.\n\nYour childhood home stayed in the background, always lit, never lived in. You went in without ever staying.\n\nWhat would happen if, next cycle, you opened one of its windows?',
  },
};

function mockLetter(lang: string, plus: boolean, fullMoonAt?: string): MoonLetterResult {
  const cycle = moonCycleAt(Date.now());
  const current = new Date(cycle.fullMoonAt).toISOString();
  const previous = new Date(cycle.previousFullMoonAt).toISOString();
  const text = MOCK_LETTERS[lang === 'fr' ? 'fr' : 'en'];
  const shown = fullMoonAt ?? current;
  const letter = { fullMoonAt: shown, lang, opening: text.opening, body: plus ? text.body : null, locked: !plus, dreamCount: 5 };
  return {
    fullMoonAt: shown,
    letter,
    reason: null,
    dreamCount: 5,
    minDreams: MOON_LETTER_MIN_DREAMS,
    previous: shown === current ? [{ fullMoonAt: previous, opening: text.opening, dreamCount: 4 }] : [],
  };
}

/**
 * This cycle's full moon letter, written on its first request, or an earlier cycle's when
 * `fullMoonAt` names it. Signed-in accounts only.
 */
export async function fetchMoonLetter(options: {
  lang: string;
  fullMoonAt?: string;
  /** Mock mode only: whether the letter reads as Plus. */
  mockPlus?: boolean;
  signal?: AbortSignal;
}): Promise<MoonLetterResult> {
  if (isMockModeEnabled()) return mockLetter(options.lang, options.mockPlus ?? false, options.fullMoonAt);
  const result = await fetchJSONWithSession<unknown>(`${getApiBaseUrl()}/moon-letter`, {
    method: 'POST',
    body: { lang: options.lang, ...(options.fullMoonAt ? { fullMoonAt: options.fullMoonAt } : {}) },
    ...NETWORK_REQUEST_POLICIES.moonLetter,
    signal: options.signal,
  });
  return parseResult(result);
}
