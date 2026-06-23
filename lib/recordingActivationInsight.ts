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

type RecordingActivationInsightInput = {
  transcript: string;
  captureIntent?: RecordingCaptureIntent;
  rememberedKind?: RememberedDreamKind;
  approximatePeriod?: DreamApproximatePeriod;
  strongestFragment?: DreamStrongestFragment;
  maxSignals?: number;
};

const MIN_FRAGMENT_CHARS = 18;

const KEYWORDS: Record<Exclude<RecordingActivationInsightSignalId, 'memory'>, string[]> = {
  emotion: [
    'angoiss',
    'calme',
    'colere',
    'heureu',
    'joy',
    'peur',
    'sad',
    'stress',
    'triste',
    'anx',
    'afraid',
    'angry',
    'scared',
    'happy',
    'fear',
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
  ],
  recurrence: [
    'encore',
    'meme reve',
    'plusieurs fois',
    'recurrent',
    'reviens',
    'revient',
    'souvent',
    'toujours',
    'again',
    'always',
    'recurring',
    'same dream',
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

const pushUnique = (
  signals: RecordingActivationInsightSignalId[],
  signal: RecordingActivationInsightSignalId | undefined,
) => {
  if (signal && !signals.includes(signal)) {
    signals.push(signal);
  }
};

const hasAnyKeyword = (normalizedText: string, keywords: string[]) => {
  if (!normalizedText) {
    return false;
  }

  return keywords.some((keyword) => normalizedText.includes(keyword));
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
