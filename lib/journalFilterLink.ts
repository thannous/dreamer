import { DREAM_THEMES } from '@/lib/dreamThemes';
import type { JournalAnalysisStatusFilter } from '@/lib/dreamFilters';
import type { DreamTheme, DreamType } from '@/lib/types';

/**
 * Opening the journal on a set of dreams from another screen (Tendances): the filters
 * travel as route params and replace whatever the journal had. `filter` names the
 * request, so the same link pressed twice applies twice.
 */
export type JournalFilterRequest = {
  theme?: DreamTheme | null;
  dreamType?: DreamType | null;
  /** Local day keys, `YYYY-MM-DD`, both ends included. */
  from?: string | null;
  to?: string | null;
  analysis?: JournalAnalysisStatusFilter | null;
};

export type JournalFilterRouteParams = {
  filter?: string | string[];
  theme?: string | string[];
  type?: string | string[];
  from?: string | string[];
  to?: string | string[];
  analysis?: string | string[];
};

export type JournalFilterSelection = {
  key: string;
  theme: DreamTheme | null;
  dreamType: DreamType | null;
  start: Date | null;
  end: Date | null;
  analysis: JournalAnalysisStatusFilter | null;
};

const DREAM_TYPES: readonly DreamType[] = [
  'Lucid Dream',
  'Recurring Dream',
  'Nightmare',
  'Symbolic Dream',
  'Everyday Dream',
  'Fantastical Dream',
];
const ANALYSIS_FILTERS: readonly JournalAnalysisStatusFilter[] = ['unanalyzed', 'analyzed', 'explored'];

export function toJournalFilterParams(request: JournalFilterRequest, key: string): Record<string, string> {
  return {
    filter: key,
    ...(request.theme ? { theme: request.theme } : {}),
    ...(request.dreamType ? { type: request.dreamType } : {}),
    ...(request.from ? { from: request.from } : {}),
    ...(request.to ? { to: request.to } : {}),
    ...(request.analysis ? { analysis: request.analysis } : {}),
  };
}

const single = (value: string | string[] | undefined): string | undefined =>
  (Array.isArray(value) ? value[0] : value) || undefined;

function localDate(key: string | undefined): Date | null {
  const match = key ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(key) : null;
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(date.getTime()) && date.getDate() === Number(match[3]) ? date : null;
}

/** An unknown value is dropped rather than guessed: a stale link never filters on nonsense. */
export function parseJournalFilterParams(params: JournalFilterRouteParams): JournalFilterSelection | null {
  const key = single(params.filter);
  if (!key) return null;
  const theme = single(params.theme);
  const dreamType = single(params.type);
  const analysis = single(params.analysis);
  return {
    key,
    theme: DREAM_THEMES.includes(theme as DreamTheme) ? (theme as DreamTheme) : null,
    dreamType: DREAM_TYPES.includes(dreamType as DreamType) ? (dreamType as DreamType) : null,
    start: localDate(single(params.from)),
    end: localDate(single(params.to)),
    analysis: ANALYSIS_FILTERS.includes(analysis as JournalAnalysisStatusFilter)
      ? (analysis as JournalAnalysisStatusFilter)
      : null,
  };
}
