import type { DreamAnalysis } from './types';

const sameIdentity = (a: DreamAnalysis, b: DreamAnalysis): boolean => {
  if (a.remoteId != null && b.remoteId != null) return a.remoteId === b.remoteId;
  if (a.clientRequestId && b.clientRequestId) return a.clientRequestId === b.clientRequestId;
  return a.id === b.id;
};

/** Apply only local changes since the read began, retaining unrelated server rows. */
export const mergeDreamSnapshot = (
  baseline: DreamAnalysis[],
  local: DreamAnalysis[],
  remote: DreamAnalysis[]
): DreamAnalysis[] => {
  let merged = [...remote];
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
