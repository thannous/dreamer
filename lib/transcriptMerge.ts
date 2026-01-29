export type TranscriptMergeResult = { text: string; truncated: boolean };

export const normalizeTranscriptText = (text: string) => text.replace(/\s+/g, ' ').trim();

export const normalizeForComparison = (text: string) =>
  normalizeTranscriptText(text)
    // Ignore lightweight punctuation so edits that only tweak commas/periods
    // don't cause duplicate concatenation when the recognizer replays the transcript.
    .replace(/[.,!?;:…]/g, '')
    .toLowerCase();

type CombineTranscriptParams = {
  base: string;
  addition: string;
  maxChars: number;
  devLog?: boolean;
};

const clampTranscript = (text: string, maxChars: number): TranscriptMergeResult => {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  return { text: text.slice(0, maxChars), truncated: true };
};

export function combineTranscript({
  base,
  addition,
  maxChars,
  devLog = false,
}: CombineTranscriptParams): TranscriptMergeResult {
  const trimmedAddition = addition.trim();
  if (!trimmedAddition) {
    return clampTranscript(base, maxChars);
  }
  const trimmedBase = base.trim();

  if (devLog) {
    console.log('[combineTranscript]', {
      baseLength: trimmedBase.length,
      additionLength: trimmedAddition.length,
      baseSample: trimmedBase.substring(0, 20) + '...',
      additionSample: trimmedAddition.substring(0, 20) + '...',
    });
  }

  const hasNearPrefixMatch = (source: string, candidate: string) => {
    // Allow a small divergence near the end (e.g., STT rewrites the last word or adds one more)
    const sourceTokens = source.split(' ');
    const candidateTokens = candidate.split(' ');
    if (sourceTokens.length < 3) return false;

    let matchCount = 0;
    const limit = Math.min(sourceTokens.length, candidateTokens.length);
    for (; matchCount < limit; matchCount += 1) {
      if (sourceTokens[matchCount] !== candidateTokens[matchCount]) break;
    }

    const remainingSource = sourceTokens.length - matchCount;
    const minPrefixMatches = Math.max(3, sourceTokens.length - 2);

    // We accept if most of the prefix matches (all but the last 1-2 tokens) and candidate is at least as long.
    return matchCount >= minPrefixMatches && remainingSource <= 2 && candidateTokens.length >= sourceTokens.length;
  };

  if (trimmedBase) {
    const normalizedBase = normalizeForComparison(trimmedBase);
    const normalizedAddition = normalizeForComparison(trimmedAddition);

    // If STT re-sends text we already have, keep the existing transcript to avoid duplicates.
    if (normalizedBase.includes(normalizedAddition)) {
      return clampTranscript(trimmedBase, maxChars);
    }

    // When the recognizer returns the whole transcript plus new words, keep the expanded text once.
    if (normalizedAddition.startsWith(normalizedBase) || hasNearPrefixMatch(normalizedBase, normalizedAddition)) {
      return clampTranscript(trimmedAddition, maxChars);
    }

    // If only the last line is being incrementally extended or lightly corrected, replace that line instead of stacking.
    const baseLines = trimmedBase.split('\n');
    const lastLine = baseLines[baseLines.length - 1]?.trim() ?? '';
    if (lastLine) {
      const normalizedLastLine = normalizeForComparison(lastLine);
      if (normalizedAddition.startsWith(normalizedLastLine) || hasNearPrefixMatch(normalizedLastLine, normalizedAddition)) {
        baseLines[baseLines.length - 1] = trimmedAddition;
        return clampTranscript(baseLines.join('\n'), maxChars);
      }
    }
  }

  const combined = trimmedBase ? `${trimmedBase}\n${trimmedAddition}` : trimmedAddition;
  return clampTranscript(combined, maxChars);
}
