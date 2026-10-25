import { fetchJSONWithSession } from '@/lib/apiSession';
import { getApiBaseUrl } from '@/lib/config';
import { isMockModeEnabled } from '@/lib/env';
import { HttpError } from '@/lib/http';
import { NETWORK_REQUEST_POLICIES } from '@/lib/networkPolicy';
import { getMockDreamImage } from '@/mock-data/assets';

export type AnalysisPreviewImage = {
  /** painting: the band arrives a little after the reading. none: no painting to show. */
  state: 'ready' | 'painting' | 'none';
  /** A band across the middle of the painting: the whole painting stays on the server. */
  bandUrl: string | null;
};

/** What a free account reads of a prepared analysis before opening it. */
export type AnalysisPreview = {
  title: string;
  opening: string;
  symbols: string[];
  image: AnalysisPreviewImage;
};

export type AnalysisPreviewResult = {
  /**
   * ready: the dream has its preview. available: one can be prepared. writing: one is being
   * written. weekly_limit: this week's preview went to a dream, the next comes at `retryAt`.
   */
  state: 'ready' | 'available' | 'writing' | 'weekly_limit';
  preview: AnalysisPreview | null;
  preparedAt: string | null;
  retryAt: string | null;
};

/** Why the api prepares nothing for this dream: the dream page shows its usual action instead. */
export type AnalysisPreviewRefusal =
  'PLUS_ANALYZES' | 'CAN_ANALYZE' | 'ALREADY_ANALYZED' | 'ANALYSIS_PENDING' | 'DREAM_NOT_FOUND' | 'LANGUAGE_UNSUPPORTED';
const REFUSALS: readonly string[] = [
  'PLUS_ANALYZES', 'CAN_ANALYZE', 'ALREADY_ANALYZED', 'ANALYSIS_PENDING', 'DREAM_NOT_FOUND', 'LANGUAGE_UNSUPPORTED',
];

/** The api's code when it prepares nothing for this dream, or null for any other failure. */
export function analysisPreviewRefusal(error: unknown): AnalysisPreviewRefusal | null {
  const code = error instanceof HttpError ? (error.body as { code?: unknown } | undefined)?.code : undefined;
  return typeof code === 'string' && REFUSALS.includes(code) ? code as AnalysisPreviewRefusal : null;
}

const isText = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const isDate = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));

function parseResult(value: unknown): AnalysisPreviewResult {
  const result = value as AnalysisPreviewResult | null;
  const preview = result?.preview;
  const image = preview?.image;
  if (!result || !['ready', 'available', 'writing', 'weekly_limit'].includes(result.state)
    || (result.state === 'ready') !== Boolean(preview)
    || !(result.preparedAt === null || isDate(result.preparedAt))
    || !(result.retryAt === null || isDate(result.retryAt))
    || (result.state === 'weekly_limit' && !result.retryAt)
    || (preview && (!isText(preview.title, 500) || !isText(preview.opening, 400) || !Array.isArray(preview.symbols)
      || preview.symbols.length > 6 || preview.symbols.some((name) => !isText(name, 120))
      || !image || !['ready', 'painting', 'none'].includes(image.state)
      || (image.state === 'ready' ? !isText(image.bandUrl, 4000) || !/^https:\/\//.test(image.bandUrl) : image.bandUrl !== null)))) {
    throw new Error('Invalid analysis preview response');
  }
  return result;
}

// Mock mode prepares a fixed reading, so the dream page can be seen without the api.
const MOCK_PREVIEWS: Record<'fr' | 'en', Omit<AnalysisPreview, 'image'>> = {
  fr: {
    title: 'La rivière de verre',
    opening: 'Dans ce rêve, la rivière de verre n’est pas un obstacle : elle te porte vers une maison que tu connais déjà.',
    symbols: ['Rivière de verre', 'Maison d’enfance', 'Lumière'],
  },
  en: {
    title: 'The river of glass',
    opening: 'In this dream the river of glass is no obstacle: it carries you towards a house you already know.',
    symbols: ['River of glass', 'Childhood home', 'Light'],
  },
};
const mockPrepared = new Map<string, number>();
const MOCK_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function mockPreview(dreamId: number, lang: string, prepare: boolean): AnalysisPreviewResult {
  const key = `${dreamId}`;
  if (!mockPrepared.has(key)) {
    // Like the api: once a dream's analysis is prepared, the others wait for the next week.
    const week = [...mockPrepared.values()].filter((time) => Date.now() - time < MOCK_WEEK_MS);
    if (week.length) {
      return { state: 'weekly_limit', preview: null, preparedAt: null, retryAt: new Date(Math.max(...week) + MOCK_WEEK_MS).toISOString() };
    }
    if (!prepare) return { state: 'available', preview: null, preparedAt: null, retryAt: null };
    mockPrepared.set(key, Date.now());
  }
  const preparedAt = mockPrepared.get(key) ?? Date.now();
  // The band arrives a few seconds after the reading, as the painting does.
  const painted = Date.now() - preparedAt > 4000;
  const bandUrl = painted ? getMockDreamImage('frozen-lake') : '';
  return {
    state: 'ready',
    preview: {
      ...MOCK_PREVIEWS[lang === 'fr' ? 'fr' : 'en'],
      image: bandUrl ? { state: 'ready', bandUrl } : { state: painted ? 'none' : 'painting', bandUrl: null },
    },
    preparedAt: new Date(preparedAt).toISOString(),
    retryAt: null,
  };
}

/**
 * The prepared analysis of a synced dream, for a free account past its monthly analyses.
 * Without `prepare` it only reads what the dream has; with it, the api prepares the
 * analysis, once a week at most.
 */
export async function fetchAnalysisPreview(options: {
  remoteDreamId: number;
  lang: string;
  prepare?: boolean;
  signal?: AbortSignal;
}): Promise<AnalysisPreviewResult> {
  if (isMockModeEnabled()) return mockPreview(options.remoteDreamId, options.lang, options.prepare === true);
  const result = await fetchJSONWithSession<unknown>(`${getApiBaseUrl()}/analysis-preview`, {
    method: 'POST',
    body: { dreamId: options.remoteDreamId, lang: options.lang, ...(options.prepare ? { prepare: true } : {}) },
    ...(options.prepare ? NETWORK_REQUEST_POLICIES.analysisPreviewPrepare : NETWORK_REQUEST_POLICIES.analysisPreviewRead),
    readOnly: options.prepare !== true,
    signal: options.signal,
  });
  return parseResult(result);
}
