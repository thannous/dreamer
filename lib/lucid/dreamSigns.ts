import type { DreamAnalysis } from '@/lib/types';
import {
  LUCID_DREAM_SIGN_DECISIONS,
  type LucidDreamSignDecision,
  type LucidDreamSignDecisionRecord,
} from '@/lib/lucid/dreamSignModel';
import type { LucidLocale } from '@/lib/lucid/model';

export { LUCID_DREAM_SIGN_DECISIONS } from '@/lib/lucid/dreamSignModel';
export type { LucidDreamSignDecision, LucidDreamSignDecisionRecord } from '@/lib/lucid/dreamSignModel';

export const LUCID_DREAM_SIGN_MIN_DISTINCT_DREAMS = 2 as const;
export const LUCID_DREAM_SIGN_MAX_EVIDENCE_SNIPPETS = 3 as const;
export const LUCID_DREAM_SIGN_MAX_SNIPPET_CHARS = 96 as const;
export const LUCID_DREAM_SIGN_MAX_LABEL_CHARS = 80 as const;
export const LUCID_DREAM_SIGN_MAX_CANDIDATES = 200 as const;

export const LUCID_DREAM_SIGN_CATEGORIES = [
  'person',
  'place',
  'object',
  'emotion',
  'anomaly',
  'action',
] as const;

export type LucidDreamSignCategory = (typeof LUCID_DREAM_SIGN_CATEGORIES)[number];

export type LucidDreamSignEvidence = {
  sourceDreamId: string;
  snippet: string;
};

export type LucidDreamSignCandidate = {
  id: string;
  label: string;
  category: LucidDreamSignCategory | null;
  distinctDreamCount: number;
  sourceDreamIds: string[];
  evidence: LucidDreamSignEvidence[];
};

export type LucidReconciledDreamSign = LucidDreamSignCandidate & {
  decision: LucidDreamSignDecision;
  displayLabel: string;
};

export type LucidActiveDreamSign = {
  id: string;
  label: string;
  category: LucidDreamSignCategory | null;
  distinctDreamCount: number;
  sourceDreamIds: string[];
};

type PhraseSpec = {
  tokens: readonly string[];
  category: LucidDreamSignCategory;
};

const STOPWORDS: Readonly<Record<LucidLocale, ReadonlySet<string>>> = {
  en: new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'did', 'do',
    'for', 'from', 'had', 'has', 'have', 'he', 'her', 'him', 'his', 'i', 'in',
    'into', 'is', 'it', 'its', 'me', 'my', 'of', 'on', 'or', 'our', 'she', 'so',
    'that', 'the', 'their', 'them', 'then', 'there', 'they', 'this', 'to', 'was',
    'we', 'were', 'with', 'you', 'your', 'about', 'after', 'again', 'all', 'also',
    'am', 'because', 'before', 'could', 'if', 'just', 'like', 'not', 'now', 'one',
    'over', 'some', 'still', 'than', 'too', 'very', 'when', 'where', 'which',
    'while', 'who', 'would', 'dream', 'dreams', 'dreamed', 'dreamt', 'saw', 'see',
    'seen', 'felt', 'feel', 'went', 'go', 'going', 'came', 'come', 'back', 'around',
    'something', 'someone', 'thing', 'things',
  ]),
  fr: new Set([
    'a', 'ai', 'au', 'aux', 'avec', 'ce', 'ces', 'cet', 'cette', 'dans', 'de',
    'des', 'du', 'elle', 'en', 'et', 'il', 'ils', 'je', 'la', 'le', 'les', 'leur',
    'ma', 'mais', 'me', 'mes', 'mon', 'ne', 'nos', 'notre', 'nous', 'on', 'ou',
    'par', 'pas', 'plus', 'pour', 'que', 'qui', 'sa', 'se', 'ses', 'son', 'sur',
    'ta', 'te', 'tes', 'toi', 'ton', 'tu', 'un', 'une', 'y', 'est', 'suis', 'sont',
    'etaient', 'etait', 'ete', 'etre', 'avait', 'avaient', 'j', 'l', 'd', 'n', 's',
    'c', 'qu', 'reve', 'reves', 'rever', 'vu', 'vois', 'voir', 'vais', 'aller',
    'venu', 'venir', 'chose', 'choses', 'quelque', 'quelques',
  ]),
  es: new Set([
    'a', 'al', 'con', 'de', 'del', 'el', 'en', 'es', 'esta', 'estas', 'este',
    'estos', 'hay', 'la', 'las', 'le', 'les', 'lo', 'los', 'me', 'mi', 'mis',
    'no', 'nos', 'nuestra', 'nuestro', 'o', 'para', 'pero', 'por', 'que', 'se',
    'su', 'sus', 'te', 'tu', 'tus', 'un', 'una', 'unas', 'unos', 'y', 'yo',
    'era', 'eran', 'fue', 'fui', 'ser', 'estar', 'estaba', 'estaban', 'sueno',
    'suenos', 'sonar', 'vi', 'ver', 'voy', 'ir', 'cosa', 'cosas', 'algo', 'alguien',
  ]),
  de: new Set([
    'aber', 'als', 'am', 'an', 'auch', 'auf', 'aus', 'bei', 'bin', 'bist', 'das',
    'dem', 'den', 'der', 'des', 'die', 'du', 'ein', 'eine', 'einem', 'einen',
    'einer', 'es', 'fur', 'hatte', 'ich', 'im', 'in', 'ist', 'mit', 'nach', 'nicht',
    'noch', 'oder', 'sein', 'sie', 'sind', 'so', 'und', 'uns', 'von', 'war',
    'waren', 'was', 'wie', 'wir', 'zu', 'zum', 'zur', 'traum', 'traume', 'traumen',
    'sah', 'sehen', 'ging', 'gehen', 'kam', 'kommen', 'etwas', 'jemand', 'ding',
  ]),
  it: new Set([
    'a', 'al', 'alla', 'alle', 'che', 'ci', 'con', 'da', 'dal', 'dalla', 'dei',
    'del', 'della', 'delle', 'di', 'e', 'era', 'erano', 'gli', 'ha', 'hai', 'ho',
    'i', 'il', 'in', 'io', 'la', 'le', 'lo', 'ma', 'me', 'mi', 'mia', 'mie', 'mio',
    'nel', 'nella', 'non', 'o', 'per', 'quella', 'quelle', 'quello', 'questa',
    'queste', 'questo', 'se', 'si', 'sua', 'sue', 'suo', 'suoi', 'un',
    'una', 'uno', 'sono', 'sogno', 'sogni', 'sognare', 'visto', 'vedere', 'vado',
    'andare', 'cosa', 'cose', 'qualcosa', 'qualcuno',
  ]),
};

const SHARED_STOPWORDS = new Set(
  Object.values(STOPWORDS).flatMap((words) => [...words])
);

const PHRASES: readonly PhraseSpec[] = [
  { tokens: ['escalier', 'infini'], category: 'anomaly' },
  { tokens: ['infinite', 'staircase'], category: 'anomaly' },
  { tokens: ['escalera', 'infinita'], category: 'anomaly' },
  { tokens: ['unendliche', 'treppe'], category: 'anomaly' },
  { tokens: ['scala', 'infinita'], category: 'anomaly' },
  { tokens: ['dents', 'qui', 'tombent'], category: 'anomaly' },
  { tokens: ['falling', 'teeth'], category: 'anomaly' },
  { tokens: ['dientes', 'que', 'se', 'caen'], category: 'anomaly' },
  { tokens: ['zahne', 'fallen'], category: 'anomaly' },
  { tokens: ['denti', 'che', 'cadono'], category: 'anomaly' },
  { tokens: ['ne', 'peux', 'pas', 'courir'], category: 'anomaly' },
  { tokens: ['cannot', 'run'], category: 'anomaly' },
  { tokens: ['no', 'puedo', 'correr'], category: 'anomaly' },
  { tokens: ['kann', 'nicht', 'laufen'], category: 'anomaly' },
  { tokens: ['non', 'riesco', 'a', 'correre'], category: 'anomaly' },
  { tokens: ['voler', 'au', 'dessus'], category: 'action' },
  { tokens: ['flying', 'over'], category: 'action' },
  { tokens: ['volando', 'sobre'], category: 'action' },
  { tokens: ['volare', 'sopra'], category: 'action' },
];

const CATEGORY_LEXICON: Readonly<Record<LucidDreamSignCategory, readonly string[]>> = {
  person: [
    'marie', 'pierre', 'luca', 'sofia', 'anna', 'father', 'mother', 'sister',
    'brother', 'friend', 'teacher', 'pere', 'mere', 'soeur', 'frere', 'ami',
    'amie', 'professeur', 'padre', 'madre', 'hermana', 'hermano', 'amigo',
    'amiga', 'profesor', 'vater', 'mutter', 'schwester', 'bruder', 'freund',
    'freundin', 'lehrer', 'sorella', 'fratello', 'amico', 'amica', 'insegnante',
  ],
  place: [
    'ecole', 'school', 'escuela', 'schule', 'scuola', 'maison', 'house', 'casa',
    'haus', 'plage', 'beach', 'playa', 'strand', 'spiaggia', 'foret', 'forest',
    'bosque', 'wald', 'foresta', 'gare', 'station', 'estacion', 'bahnhof',
    'stazione', 'aeroport', 'airport', 'aeropuerto', 'flughafen', 'aeroporto',
    'escalier', 'staircase', 'stairs', 'escalera', 'treppe', 'scala', 'ville',
    'city', 'ciudad', 'stadt', 'citta',
  ],
  object: [
    'miroir', 'mirror', 'espejo', 'spiegel', 'specchio', 'telephone', 'phone',
    'telefono', 'telefon', 'montre', 'watch', 'reloj', 'uhr', 'orologio',
    'cle', 'key', 'llave', 'schlussel', 'chiave', 'livre', 'book', 'libro',
    'buch', 'voiture', 'car', 'coche', 'auto', 'macchina', 'porte', 'door',
    'puerta', 'tur', 'porta',
  ],
  emotion: [
    'peur', 'fear', 'miedo', 'angst', 'paura', 'joie', 'joy', 'alegria',
    'freude', 'gioia', 'colere', 'anger', 'rabia', 'wut', 'rabbia', 'tristesse',
    'sadness', 'tristeza', 'trauer', 'tristezza', 'panique', 'panic', 'panico',
    'panik',
  ],
  anomaly: [
    'voler', 'flying', 'fly', 'volando', 'fliegen', 'volare', 'invisible',
    'durchsichtig', 'invisibile',
  ],
  action: [
    'courir', 'running', 'run', 'correr', 'laufen', 'correre', 'tomber',
    'falling', 'caer', 'fallen', 'cadere', 'chercher', 'searching', 'buscar',
    'suchen', 'cercare', 'nager', 'swimming', 'nadar', 'schwimmen', 'nuotare',
  ],
};

const CATEGORY_TOKEN_MAP: ReadonlyMap<string, LucidDreamSignCategory> = (() => {
  const map = new Map<string, LucidDreamSignCategory>();
  for (const category of LUCID_DREAM_SIGN_CATEGORIES) {
    for (const token of CATEGORY_LEXICON[category]) {
      if (!map.has(token)) map.set(token, category);
    }
  }
  return map;
})();

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeLucidDreamSignText(raw: string): string {
  return stripDiacritics(String(raw ?? '').toLowerCase())
    .replace(/['’`]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(raw: string): string[] {
  const normalized = normalizeLucidDreamSignText(raw);
  return normalized
    ? normalized.split(' ').filter((token) => token.length <= LUCID_DREAM_SIGN_MAX_LABEL_CHARS)
    : [];
}

function isStopword(token: string): boolean {
  return token.length < 3 || SHARED_STOPWORDS.has(token);
}

function isStableDreamId(value: unknown): value is number | string {
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'string' && value.trim().length > 0;
}

export function toLucidDreamSignSourceId(dream: Pick<DreamAnalysis, 'id'> | number | string): string {
  if (typeof dream === 'number' || typeof dream === 'string') {
    return String(dream).trim();
  }
  return String(dream.id);
}

function dreamSignIdFromNormalized(normalized: string): string {
  return `sign:${normalized.replace(/\s+/g, '_')}`;
}

function normalizedCandidateText(raw: string): string | null {
  const normalized = normalizeLucidDreamSignText(raw);
  return normalized.length > 0 && normalized.length <= LUCID_DREAM_SIGN_MAX_LABEL_CHARS
    ? normalized
    : null;
}

function titleCaseLabel(normalized: string): string {
  return normalized
    .split(' ')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function compareIds(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function uniqueSortedIds(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort(compareIds);
}

function clipSnippet(raw: string): string {
  const compact = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (compact.length <= LUCID_DREAM_SIGN_MAX_SNIPPET_CHARS) return compact;
  return `${compact.slice(0, LUCID_DREAM_SIGN_MAX_SNIPPET_CHARS - 1).trimEnd()}...`;
}

function extractSnippet(sourceText: string, phrase: string): string {
  const haystack = sourceText.replace(/\s+/g, ' ').trim();
  if (!haystack) return '';
  const normalizedHaystack = normalizeLucidDreamSignText(haystack);
  const normalizedPhrase = normalizeLucidDreamSignText(phrase);
  const index = normalizedHaystack.indexOf(normalizedPhrase);
  if (index < 0) return clipSnippet(haystack);

  const rawLower = stripDiacritics(haystack.toLowerCase());
  let cursor = 0;
  let start = 0;
  let end = haystack.length;
  for (let i = 0; i < rawLower.length; i += 1) {
    const char = rawLower[i];
    if (/[a-z0-9]/.test(char)) {
      if (cursor === index) start = i;
      if (cursor === index + normalizedPhrase.length - 1) {
        end = i + 1;
        break;
      }
      cursor += 1;
    } else if (
      cursor > 0 &&
      cursor < normalizedPhrase.length &&
      /\s/.test(char) &&
      normalizedHaystack[cursor] === ' '
    ) {
      cursor += 1;
      if (cursor === index + normalizedPhrase.length) {
        end = i;
        break;
      }
    }
  }
  const windowStart = Math.max(0, start - 24);
  const windowEnd = Math.min(haystack.length, end + 24);
  const prefix = windowStart > 0 ? '...' : '';
  const suffix = windowEnd < haystack.length ? '...' : '';
  return clipSnippet(`${prefix}${haystack.slice(windowStart, windowEnd).trim()}${suffix}`);
}

function classifyTokens(tokens: readonly string[]): LucidDreamSignCategory | null {
  for (const phrase of PHRASES) {
    if (
      phrase.tokens.length === tokens.length &&
      phrase.tokens.every((token, index) => token === tokens[index])
    ) {
      return phrase.category;
    }
  }
  if (tokens.length === 1) {
    return CATEGORY_TOKEN_MAP.get(tokens[0]) ?? null;
  }
  const categories = tokens
    .map((token) => CATEGORY_TOKEN_MAP.get(token))
    .filter((category): category is LucidDreamSignCategory => category != null);
  return categories[0] ?? null;
}

function tokensMatchAt(haystack: readonly string[], start: number, needle: readonly string[]): boolean {
  if (start < 0 || start + needle.length > haystack.length) return false;
  return needle.every((token, index) => haystack[start + index] === token);
}

type RawMention = {
  normalized: string;
  label: string;
  category: LucidDreamSignCategory | null;
};

function collectMentions(
  dream: Pick<DreamAnalysis, 'title' | 'transcript' | 'symbols' | 'emotions'>
): RawMention[] {
  const sourceText = `${dream.title ?? ''}\n${dream.transcript ?? ''}`;
  const tokens = tokenize(sourceText);
  const sourceLabels = new Map<string, string>();
  for (const rawToken of sourceText.match(/[\p{L}\p{N}]+/gu) ?? []) {
    const normalized = normalizedCandidateText(rawToken);
    if (normalized && !sourceLabels.has(normalized)) sourceLabels.set(normalized, rawToken);
  }
  const mentions = new Map<string, RawMention>();

  const addMention = (mention: RawMention) => {
    if (!mention.normalized) return;
    const existing = mentions.get(mention.normalized);
    if (!existing) {
      mentions.set(mention.normalized, mention);
      return;
    }
    if (!existing.category && mention.category) {
      mentions.set(mention.normalized, { ...existing, category: mention.category });
    }
  };

  for (const phrase of PHRASES) {
    for (let i = 0; i < tokens.length; i += 1) {
      if (!tokensMatchAt(tokens, i, phrase.tokens)) continue;
      const normalized = phrase.tokens.join(' ');
      addMention({
        normalized,
        label: titleCaseLabel(normalized),
        category: phrase.category,
      });
    }
  }

  for (const token of tokens) {
    if (isStopword(token)) continue;
    addMention({
      normalized: token,
      label: sourceLabels.get(token) ?? titleCaseLabel(token),
      category: CATEGORY_TOKEN_MAP.get(token) ?? null,
    });
  }

  for (const symbol of dream.symbols ?? []) {
    const rawName = typeof symbol?.name === 'string' ? symbol.name : '';
    const normalized = normalizedCandidateText(rawName);
    if (!normalized || isStopword(normalized)) continue;
    addMention({
      normalized,
      label: rawName.replace(/\s+/g, ' ').trim() || titleCaseLabel(normalized),
      category: classifyTokens(normalized.split(' ')),
    });
  }

  for (const emotion of dream.emotions ?? []) {
    const rawName = typeof emotion?.name === 'string' ? emotion.name : '';
    const normalized = normalizedCandidateText(rawName);
    if (!normalized || isStopword(normalized)) continue;
    addMention({
      normalized,
      label: rawName.replace(/\s+/g, ' ').trim() || titleCaseLabel(normalized),
      category: 'emotion',
    });
  }

  return [...mentions.values()];
}

function sourceTextForDream(dream: Pick<DreamAnalysis, 'title' | 'transcript'>): string {
  const title = String(dream.title ?? '').trim();
  const transcript = String(dream.transcript ?? '').trim();
  return [title, transcript].filter(Boolean).join('. ');
}

export function extractLucidDreamSignCandidates(
  dreams: readonly Pick<
    DreamAnalysis,
    'id' | 'title' | 'transcript' | 'symbols' | 'emotions'
  >[],
  options?: { minDistinctDreams?: number }
): LucidDreamSignCandidate[] {
  const minDistinctDreams = options?.minDistinctDreams ?? LUCID_DREAM_SIGN_MIN_DISTINCT_DREAMS;
  const grouped = new Map<
    string,
    {
      label: string;
      labelSourceDreamId: string;
      category: LucidDreamSignCategory | null;
      sourceDreamIds: Set<string>;
      evidence: LucidDreamSignEvidence[];
    }
  >();

  for (const dream of dreams) {
    if (!isStableDreamId(dream?.id)) continue;
    const sourceDreamId = toLucidDreamSignSourceId(dream);
    if (sourceDreamId.length > 128) continue;
    const sourceText = sourceTextForDream(dream);
    const mentions = collectMentions(dream);

    for (const mention of mentions) {
      const current = grouped.get(mention.normalized);
      const snippet = extractSnippet(sourceText, mention.normalized);
      if (!current) {
        grouped.set(mention.normalized, {
          label: mention.label,
          labelSourceDreamId: sourceDreamId,
          category: mention.category,
          sourceDreamIds: new Set([sourceDreamId]),
          evidence: snippet ? [{ sourceDreamId, snippet }] : [],
        });
        continue;
      }
      current.sourceDreamIds.add(sourceDreamId);
      if (compareIds(sourceDreamId, current.labelSourceDreamId) < 0) {
        current.label = mention.label;
        current.labelSourceDreamId = sourceDreamId;
      }
      if (!current.category && mention.category) current.category = mention.category;
      if (snippet && !current.evidence.some((item) => item.sourceDreamId === sourceDreamId)) {
        current.evidence.push({ sourceDreamId, snippet });
      }
    }
  }

  return [...grouped.entries()]
    .map(([normalized, value]) => {
      const sourceDreamIds = uniqueSortedIds([...value.sourceDreamIds]);
      return {
        id: dreamSignIdFromNormalized(normalized),
        label: value.label,
        category: value.category,
        distinctDreamCount: sourceDreamIds.length,
        sourceDreamIds,
        evidence: [...value.evidence]
          .sort((left, right) => compareIds(left.sourceDreamId, right.sourceDreamId))
          .slice(0, LUCID_DREAM_SIGN_MAX_EVIDENCE_SNIPPETS),
      };
    })
    .filter((candidate) => candidate.distinctDreamCount >= minDistinctDreams)
    .sort((left, right) => {
      if (right.distinctDreamCount !== left.distinctDreamCount) {
        return right.distinctDreamCount - left.distinctDreamCount;
      }
      return compareIds(left.id, right.id);
    })
    .slice(0, LUCID_DREAM_SIGN_MAX_CANDIDATES);
}

function sanitizeCustomLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length > 0 && compact.length <= LUCID_DREAM_SIGN_MAX_LABEL_CHARS
    ? compact
    : null;
}

export function reconcileLucidDreamSignDecisions(
  candidates: readonly LucidDreamSignCandidate[],
  decisions: readonly LucidDreamSignDecisionRecord[]
): LucidReconciledDreamSign[] {
  const byId = new Map<string, LucidDreamSignDecisionRecord>();
  for (const record of decisions) {
    if (!record || typeof record.id !== 'string' || record.id.trim().length === 0) continue;
    if (!LUCID_DREAM_SIGN_DECISIONS.includes(record.decision)) continue;
    byId.set(record.id, record);
  }

  return candidates.map((candidate) => {
    const record = byId.get(candidate.id);
    const customLabel = sanitizeCustomLabel(record?.customLabel);
    const decision = record?.decision ?? 'pending';
    return {
      ...candidate,
      decision,
      displayLabel: customLabel ?? candidate.label,
    };
  });
}

export function getActiveLucidDreamSigns(
  candidates: readonly LucidDreamSignCandidate[],
  decisions: readonly LucidDreamSignDecisionRecord[] = []
): LucidActiveDreamSign[] {
  return reconcileLucidDreamSignDecisions(candidates, decisions)
    .filter((sign) => sign.decision === 'confirmed')
    .map((sign) => ({
      id: sign.id,
      label: sign.displayLabel,
      category: sign.category,
      distinctDreamCount: sign.distinctDreamCount,
      sourceDreamIds: sign.sourceDreamIds,
    }));
}
