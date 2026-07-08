import type {
  DreamApproximatePeriod,
  DreamStrongestFragment,
  RememberedDreamKind,
} from '@/lib/types';
import type { RecordingCaptureIntent } from '@/lib/recordingActivation';

export type RecordingActivationInsightSignalId =
  | 'memory'
  | 'emotion'
  | 'place'
  | 'person'
  | 'symbol'
  | 'recurrence';

export type RecordingActivationInsightTone = 'memory' | 'signals' | 'fragment';

export type RecordingActivationInsight = {
  tone: RecordingActivationInsightTone;
  signalIds: RecordingActivationInsightSignalId[];
  charCount: number;
};

export type RecordingActivationInsightInput = {
  transcript: string;
  captureIntent?: RecordingCaptureIntent;
  rememberedKind?: RememberedDreamKind;
  approximatePeriod?: DreamApproximatePeriod;
  strongestFragment?: DreamStrongestFragment;
  maxSignals?: number;
};

export type LiveRecordingActivationInsightInput = RecordingActivationInsightInput & {
  minFragmentChars?: number;
};

const MIN_FRAGMENT_CHARS = 18;

const KEYWORDS: Record<Exclude<RecordingActivationInsightSignalId, 'memory'>, string[]> = {
  emotion: [
    'angoiss*',
    'calme',
    'colere',
    'heureu*',
    'joy*',
    'peur',
    'sad*',
    'stress',
    'triste',
    'anx*',
    'afraid',
    'angry',
    'scared',
    'happy',
    'fear',
    'miedo',
    'asustad*',
    'ansiedad',
    'feliz',
    'alegria',
    'tranquil*',
    'paura',
    'ansia',
    'felice',
    'gioia',
    'rabbia',
    'arrabbiat*',
    'angst*',
    'traurig',
    'glucklich',
    'ruhig',
    'wut*',
    'gestresst',
  ],
  place: [
    'appartement',
    'chambre',
    'ecole',
    'foret',
    'jardin',
    'maison',
    'mer',
    'montagne',
    'route',
    'rue',
    'ville',
    'room',
    'house',
    'school',
    'forest',
    'street',
    'city',
    'casa',
    'habitacion',
    'escuela',
    'bosque',
    'calle',
    'ciudad',
    'mar',
    'montana',
    'stanza',
    'scuola',
    'bosco',
    'strada',
    'citta',
    'mare',
    'montagna',
    'haus',
    'zimmer',
    'schule',
    'wald',
    'strasse',
    'stadt',
    'meer',
    'berg',
  ],
  person: [
    'ami',
    'amie',
    'enfant',
    'famille',
    'femme',
    'frere',
    'homme',
    'mere',
    'pere',
    'soeur',
    'visage',
    'friend',
    'mother',
    'father',
    'sister',
    'brother',
    'child',
    'face',
    'madre',
    'padre',
    'hermano',
    'hermana',
    'nino',
    'nina',
    'mujer',
    'hombre',
    'rostro',
    'cara',
    'fratello',
    'sorella',
    'amico',
    'amica',
    'bambino',
    'bambina',
    'donna',
    'uomo',
    'viso',
    'volto',
    'mutter',
    'vater',
    'bruder',
    'schwester',
    'freund',
    'freundin',
    'kind',
    'mann',
    'frau',
    'gesicht',
  ],
  symbol: [
    'cle',
    'couleur',
    'eau',
    'etoile',
    'fenetre',
    'feu',
    'lune',
    'miroir',
    'porte',
    'shadow',
    'water',
    'door',
    'key',
    'mirror',
    'moon',
    'fire',
    'window',
    'agua',
    'fuego',
    'puerta',
    'llave',
    'espejo',
    'luna',
    'ventana',
    'sombra',
    'acqua',
    'fuoco',
    'porta',
    'chiave',
    'specchio',
    'finestra',
    'ombra',
    'wasser',
    'feuer',
    'tur',
    'schlussel',
    'spiegel',
    'mond',
    'fenster',
    'schatten',
  ],
  recurrence: [
    'encore',
    'meme reve',
    'plusieurs fois',
    'recurrent*',
    'reviens',
    'revient',
    'souvent',
    'toujours',
    'again',
    'always',
    'recurring',
    'same dream',
    'otra vez',
    'mismo sueno',
    'varias veces',
    'se repite',
    'di nuovo',
    'stesso sogno',
    'piu volte',
    'si ripete',
    'ricorrent*',
    'immer wieder',
    'derselbe traum',
    'denselben traum',
    'gleicher traum',
    'gleiche traum',
    'mehrmals',
    'wiederkehr*',
  ],
};

const strongestFragmentSignals: Partial<Record<DreamStrongestFragment, RecordingActivationInsightSignalId>> = {
  color: 'symbol',
  fear: 'emotion',
  image: 'symbol',
  person: 'person',
  place: 'place',
  sensation: 'emotion',
};

const rememberedKindSignals: Partial<Record<RememberedDreamKind, RecordingActivationInsightSignalId>> = {
  lucid: 'symbol',
  nightmare: 'emotion',
  person: 'person',
  recurring: 'recurrence',
};

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const getTextTokens = (normalizedText: string) =>
  normalizedText ? normalizedText.split(/\s+/) : [];

const pushUnique = (
  signals: RecordingActivationInsightSignalId[],
  signal: RecordingActivationInsightSignalId | undefined,
) => {
  if (signal && !signals.includes(signal)) {
    signals.push(signal);
  }
};

const keywordMatches = (normalizedText: string, tokens: string[], keyword: string) => {
  const isPrefix = keyword.endsWith('*');
  const normalizedKeyword = isPrefix ? keyword.slice(0, -1) : keyword;

  if (!normalizedKeyword) {
    return false;
  }

  if (isPrefix) {
    return tokens.some((token) => token.startsWith(normalizedKeyword));
  }

  if (normalizedKeyword.includes(' ')) {
    return ` ${normalizedText} `.includes(` ${normalizedKeyword} `);
  }

  return tokens.includes(normalizedKeyword);
};

const hasAnyKeyword = (normalizedText: string, keywords: string[]) => {
  if (!normalizedText) {
    return false;
  }

  const tokens = getTextTokens(normalizedText);
  return keywords.some((keyword) => keywordMatches(normalizedText, tokens, keyword));
};

export function getRecordingActivationInsight({
  transcript,
  captureIntent = 'fresh',
  rememberedKind,
  approximatePeriod,
  strongestFragment,
  maxSignals = 4,
}: RecordingActivationInsightInput): RecordingActivationInsight | null {
  const trimmedTranscript = transcript.trim();
  const normalizedText = normalizeText(trimmedTranscript);
  const signals: RecordingActivationInsightSignalId[] = [];
  const isRememberedCapture = captureIntent === 'remembered';

  if (isRememberedCapture || rememberedKind || approximatePeriod || strongestFragment) {
    pushUnique(signals, 'memory');
  }

  pushUnique(signals, rememberedKind ? rememberedKindSignals[rememberedKind] : undefined);
  pushUnique(signals, strongestFragment ? strongestFragmentSignals[strongestFragment] : undefined);

  for (const signal of ['emotion', 'place', 'person', 'symbol', 'recurrence'] as const) {
    if (hasAnyKeyword(normalizedText, KEYWORDS[signal])) {
      pushUnique(signals, signal);
    }
  }

  if (!isRememberedCapture && trimmedTranscript.length < MIN_FRAGMENT_CHARS) {
    return null;
  }

  if (!signals.length && trimmedTranscript.length < MIN_FRAGMENT_CHARS) {
    return null;
  }

  const limitedSignals = signals.slice(0, Math.max(1, maxSignals));

  return {
    tone: limitedSignals.includes('memory')
      ? 'memory'
      : limitedSignals.length > 0
        ? 'signals'
        : 'fragment',
    signalIds: limitedSignals,
    charCount: trimmedTranscript.length,
  };
}

export function getLiveRecordingActivationInsight({
  minFragmentChars = 80,
  maxSignals = 3,
  ...input
}: LiveRecordingActivationInsightInput): RecordingActivationInsight | null {
  const isRememberedCapture = input.captureIntent === 'remembered';
  const hasRememberedSignal = Boolean(
    input.transcript.trim()
    || input.approximatePeriod
    || input.strongestFragment
    || (input.rememberedKind && input.rememberedKind !== 'old')
  );

  if (isRememberedCapture && !hasRememberedSignal) {
    return null;
  }

  const insight = getRecordingActivationInsight({
    ...input,
    maxSignals,
  });

  if (!insight) {
    return null;
  }

  if (insight.tone === 'fragment' && insight.charCount < minFragmentChars) {
    return null;
  }

  return insight;
}
