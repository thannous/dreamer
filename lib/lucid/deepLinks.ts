import type { LucidTechnique } from './progress';

export type NoctaliaHandoffOutcome = 'lucid' | 'remembered' | 'no_recall';
export type NoctaliaScoreBand = 'none' | 'low' | 'medium' | 'high';

export type NoctaliaHandoffPayload = {
  schemaVersion: 1;
  technique: LucidTechnique;
  outcome: NoctaliaHandoffOutcome;
  lucidity: NoctaliaScoreBand;
  recall: NoctaliaScoreBand;
};

export type NoctaliaTransferConsent = {
  dataTransfer: true;
};

export type NoctaliaHandoffLinks = {
  appUrl: string;
  fallbackUrl: string;
};

const APP_PROTOCOL = 'noctalia:';
const APP_ROUTE = 'recording';
const FALLBACK_ORIGIN = 'https://dream.noctalia.app';
// The public Noctalia home already contains the remembered-dream capture.
// Keep the browser fallback on that stable, crawlable surface instead of a
// native-only Expo Router path.
const FALLBACK_PATH = '/';
const MAX_HANDOFF_URL_LENGTH = 512;
const QUERY_KEYS = [
  'v',
  'source',
  'technique',
  'outcome',
  'lucidity',
  'recall',
] as const;
const TECHNIQUES: readonly LucidTechnique[] = ['mild', 'ssild', 'wbtb'];
const OUTCOMES: readonly NoctaliaHandoffOutcome[] = [
  'lucid',
  'remembered',
  'no_recall',
];
const SCORE_BANDS: readonly NoctaliaScoreBand[] = [
  'none',
  'low',
  'medium',
  'high',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isPayload(value: unknown): value is NoctaliaHandoffPayload {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value).sort();
  const expected = [
    'schemaVersion',
    'technique',
    'outcome',
    'lucidity',
    'recall',
  ].sort();
  if (
    keys.length !== expected.length ||
    !keys.every((key, index) => key === expected[index])
  ) {
    return false;
  }
  if (
    value.schemaVersion !== 1 ||
    !TECHNIQUES.includes(value.technique as LucidTechnique) ||
    !OUTCOMES.includes(value.outcome as NoctaliaHandoffOutcome) ||
    !SCORE_BANDS.includes(value.lucidity as NoctaliaScoreBand) ||
    !SCORE_BANDS.includes(value.recall as NoctaliaScoreBand)
  ) {
    return false;
  }

  if (value.outcome === 'no_recall') {
    return value.lucidity === 'none' && value.recall === 'none';
  }
  if (value.outcome === 'lucid') {
    return value.lucidity !== 'none' && value.recall !== 'none';
  }
  return value.recall !== 'none';
}

function hasExplicitConsent(value: unknown): value is NoctaliaTransferConsent {
  return (
    isPlainObject(value) &&
    Object.keys(value).length === 1 &&
    value.dataTransfer === true
  );
}

function getCanonicalQuery(payload: NoctaliaHandoffPayload): string {
  const parameters = new URLSearchParams();
  parameters.set('v', '1');
  parameters.set('source', 'lucid_trainer');
  parameters.set('technique', payload.technique);
  parameters.set('outcome', payload.outcome);
  parameters.set('lucidity', payload.lucidity);
  parameters.set('recall', payload.recall);
  return parameters.toString();
}

function buildCanonicalLinks(payload: NoctaliaHandoffPayload): NoctaliaHandoffLinks {
  const query = getCanonicalQuery(payload);
  return {
    appUrl: `noctalia://${APP_ROUTE}?${query}`,
    fallbackUrl: `${FALLBACK_ORIGIN}${FALLBACK_PATH}?${query}`,
  };
}

export function buildNoctaliaHandoffLinks(
  payload: NoctaliaHandoffPayload | unknown,
  consent: NoctaliaTransferConsent | unknown
): NoctaliaHandoffLinks | null {
  if (!hasExplicitConsent(consent) || !isPayload(payload)) return null;
  return buildCanonicalLinks(payload);
}

function hasCanonicalLocation(url: URL): boolean {
  if (url.username || url.password || url.port || url.hash) return false;

  if (url.protocol === APP_PROTOCOL) {
    return url.hostname === APP_ROUTE && (url.pathname === '' || url.pathname === '/');
  }
  return (
    url.protocol === 'https:' &&
    url.hostname === 'dream.noctalia.app' &&
    url.pathname === FALLBACK_PATH
  );
}

function readSingleParameter(url: URL, key: string): string | null {
  const values = url.searchParams.getAll(key);
  return values.length === 1 ? values[0] : null;
}

export function parseNoctaliaHandoffUrl(
  rawUrl: unknown
): NoctaliaHandoffPayload | null {
  if (
    typeof rawUrl !== 'string' ||
    rawUrl.length === 0 ||
    rawUrl.length > MAX_HANDOFF_URL_LENGTH ||
    /[\u0000-\u001F\u007F]/u.test(rawUrl)
  ) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!hasCanonicalLocation(url)) return null;

  const actualKeys = Array.from(url.searchParams.keys()).sort();
  const expectedKeys = [...QUERY_KEYS].sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    !actualKeys.every((key, index) => key === expectedKeys[index])
  ) {
    return null;
  }
  if (
    readSingleParameter(url, 'v') !== '1' ||
    readSingleParameter(url, 'source') !== 'lucid_trainer'
  ) {
    return null;
  }

  const payload = {
    schemaVersion: 1,
    technique: readSingleParameter(url, 'technique'),
    outcome: readSingleParameter(url, 'outcome'),
    lucidity: readSingleParameter(url, 'lucidity'),
    recall: readSingleParameter(url, 'recall'),
  };
  return isPayload(payload) ? payload : null;
}

export function getNoctaliaHandoffFallbackUrl(rawUrl: unknown): string | null {
  const payload = parseNoctaliaHandoffUrl(rawUrl);
  return payload ? buildCanonicalLinks(payload).fallbackUrl : null;
}
