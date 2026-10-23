import { matchesDreamTarget as sameIdentity } from './dreamIdentity';
import type { DreamAnalysis } from './types';

/** Server failures win. A legacy server without the new column keeps a matching cached reason. */
export function retainedImageJobError(remote: DreamAnalysis, local?: DreamAnalysis): string | undefined {
  if (remote.imageUrl || !remote.imageGenerationFailed) return undefined;
  if (Object.prototype.hasOwnProperty.call(remote, 'imageJobErrorCode')) return remote.imageJobErrorCode;
  return remote.analysisRequestId === local?.analysisRequestId ? local?.imageJobErrorCode : undefined;
}

/** Device-only capture sources and legacy diagnostics survive a remote refresh. */
export function retainCaptureSources(remote: DreamAnalysis[], local: DreamAnalysis[]): DreamAnalysis[] {
  return remote.map((dream) => {
    const cached = local.find((candidate) => sameIdentity(candidate, dream));
    return {
      ...dream,
      ...(cached?.captureOriginalTranscript ? { captureOriginalTranscript: cached.captureOriginalTranscript } : {}),
      ...(dream.imageGenerationFailed ? { imageJobErrorCode: retainedImageJobError(dream, cached) } : {}),
    };
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
