import { matchesDreamTarget as sameIdentity } from './dreamIdentity';
import type { DreamAnalysis } from './types';

/** Server failures win. A legacy server without the new column keeps a matching cached reason. */
export function retainedImageJobError(remote: DreamAnalysis, local?: DreamAnalysis): string | undefined {
  const continuationFailure = retainedAnalysisImageIntent(remote, local)?.failureCode;
  if (continuationFailure) return continuationFailure;
  if (remote.imageUrl || !remote.imageGenerationFailed) return undefined;
  if (Object.prototype.hasOwnProperty.call(remote, 'imageJobErrorCode')) return remote.imageJobErrorCode;
  return remote.analysisRequestId === local?.analysisRequestId ? local?.imageJobErrorCode : undefined;
}

/** A continuation belongs to one exact analyzed transcript and server request. */
export function retainedAnalysisImageIntent(remote: DreamAnalysis, local?: DreamAnalysis): DreamAnalysis['analysisImageIntent'] {
  const intent = local?.analysisImageIntent;
  return intent && intent.remoteDreamId === remote.remoteId &&
    intent.analysisRequestId === remote.analysisRequestId && intent.transcript === remote.transcript &&
    (!intent.failureCode || remote.imageUrl === local?.imageUrl)
    ? intent : undefined;
}

/** Device-only capture sources and legacy diagnostics survive a remote refresh. */
export function retainCaptureSources(remote: DreamAnalysis[], local: DreamAnalysis[]): DreamAnalysis[] {
  return remote.map((dream) => {
    const cached = local.find((candidate) => sameIdentity(candidate, dream));
    return {
      ...dream,
      ...(retainedAnalysisImageIntent(dream, cached) ? {
        analysisImageIntent: retainedAnalysisImageIntent(dream, cached),
        // The requested continuation has not yet been durably admitted.
        ...(dream.analysisStatus === 'done' && !retainedAnalysisImageIntent(dream, cached)?.failureCode
          ? { analysisStatus: 'pending' as const } : {}),
      } : {}),
      ...(cached?.captureOriginalTranscript ? { captureOriginalTranscript: cached.captureOriginalTranscript } : {}),
      ...(dream.imageGenerationFailed || retainedAnalysisImageIntent(dream, cached)?.failureCode
        ? { imageJobErrorCode: retainedImageJobError(dream, cached) } : {}),
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
