import type { DreamAnalysis } from '@/lib/types';

export const DREAM_ANALYSIS_TRANSCRIPT_HASH_VERSION = 'v1';
export const ANALYSIS_TRANSCRIPT_HASH_KEY = 'analysisTranscriptHash';

const ANALYSIS_TRANSCRIPT_HASH_MAX_LENGTH = 80;
const FNV1A_OFFSET = 0x811c9dc5;
const FNV1A_PRIME = 0x01000193;

export type DreamAnalysisFreshness = 'fresh' | 'stale' | 'legacy_unknown' | 'not_analyzed';

type DreamAnalysisFreshnessInput = Pick<
  DreamAnalysis,
  | 'transcript'
  | 'interpretation'
  | 'isAnalyzed'
  | 'analysisStatus'
  | 'analyzedAt'
  | 'analysisTranscriptHash'
  | 'analysisDetails'
>;

export function normalizeDreamTranscriptForHash(transcript: string): string {
  return transcript.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

export function isAnalysisTranscriptHash(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= ANALYSIS_TRANSCRIPT_HASH_MAX_LENGTH;
}

const fnv1a32Hex = (input: string): string => {
  let hash = FNV1A_OFFSET;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, FNV1A_PRIME);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export function hashDreamTranscript(transcript: string): string {
  const normalized = normalizeDreamTranscriptForHash(transcript);
  return `${DREAM_ANALYSIS_TRANSCRIPT_HASH_VERSION}:${fnv1a32Hex(normalized)}`;
}

export function readDreamAnalysisTranscriptHash(
  dream: Pick<DreamAnalysis, 'analysisTranscriptHash' | 'analysisDetails'> | null | undefined
): string | undefined {
  if (isAnalysisTranscriptHash(dream?.analysisTranscriptHash)) {
    return dream.analysisTranscriptHash;
  }
  const nested = dream?.analysisDetails?.[ANALYSIS_TRANSCRIPT_HASH_KEY];
  return isAnalysisTranscriptHash(nested) ? nested : undefined;
}

export function stampDreamAnalysisTranscript(dream: DreamAnalysis, transcript: string): DreamAnalysis {
  const analysisTranscriptHash = hashDreamTranscript(transcript);
  return {
    ...dream,
    analysisTranscriptHash,
    analysisDetails: {
      ...(dream.analysisDetails ?? {}),
      [ANALYSIS_TRANSCRIPT_HASH_KEY]: analysisTranscriptHash,
    },
  };
}

const hasCompletedAnalysis = (dream: DreamAnalysisFreshnessInput): boolean => {
  const hasAnalysisContent = Boolean(dream.interpretation?.trim());
  const hasValidAnalysisTimestamp =
    typeof dream.analyzedAt === 'number' && Number.isFinite(dream.analyzedAt);
  const hasLegacyCompletedAnalysis = Boolean(
    dream.analysisStatus == null &&
      dream.isAnalyzed === true &&
      hasValidAnalysisTimestamp &&
      hasAnalysisContent
  );
  const rawStatus = dream.analysisStatus ?? (hasLegacyCompletedAnalysis ? 'done' : 'none');
  return Boolean(
    rawStatus === 'done' &&
      dream.isAnalyzed === true &&
      hasValidAnalysisTimestamp &&
      hasAnalysisContent
  );
};

export function getDreamAnalysisFreshness(
  dream: DreamAnalysisFreshnessInput | null | undefined
): DreamAnalysisFreshness {
  if (!dream || !hasCompletedAnalysis(dream)) {
    return 'not_analyzed';
  }

  const storedHash = readDreamAnalysisTranscriptHash(dream);
  if (!storedHash) {
    return 'legacy_unknown';
  }

  return storedHash === hashDreamTranscript(dream.transcript ?? '') ? 'fresh' : 'stale';
}
