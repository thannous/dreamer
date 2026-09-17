import { matchesDreamTarget as sameIdentity } from './dreamIdentity';
import type { DreamAnalysis } from './types';

/** Device-only capture sources survive a remote refresh without overriding server content. */
export function retainCaptureSources(remote: DreamAnalysis[], local: DreamAnalysis[]): DreamAnalysis[] {
  return remote.map((dream) => {
    const cached = local.find((candidate) => sameIdentity(candidate, dream));
    return cached?.captureOriginalTranscript
      ? { ...dream, captureOriginalTranscript: cached.captureOriginalTranscript }
      : dream;
  });
}

/** Apply only local changes since the read began, retaining unrelated server rows. */
export const mergeDreamSnapshot = (
  baseline: DreamAnalysis[],
  local: DreamAnalysis[],
  remote: DreamAnalysis[]
): DreamAnalysis[] => {
  let merged = retainCaptureSources(remote, local);
  baseline.forEach((before) => {
    const after = local.find((dream) => sameIdentity(before, dream));
    if (!after || JSON.stringify(after) !== JSON.stringify(before)) {
      merged = merged.filter((dream) => !sameIdentity(before, dream));
      if (after) merged.push(after);
    }
  });
  local.forEach((dream) => {
    if (!baseline.some((before) => sameIdentity(before, dream))) {
      merged = merged.filter((remoteDream) => !sameIdentity(remoteDream, dream));
      merged.push(dream);
    }
  });
  return merged;
};
