import type { DreamAnalysis } from './types';

export type DreamTarget = number | Pick<DreamAnalysis, 'id' | 'remoteId' | 'clientRequestId'>;

export const matchesDreamTarget = (dream: Exclude<DreamTarget, number>, target: DreamTarget): boolean => {
  if (typeof target === 'number') return dream.id === target;
  if (target.remoteId != null && dream.remoteId != null) return dream.remoteId === target.remoteId;
  if (target.clientRequestId && dream.clientRequestId) return dream.clientRequestId === target.clientRequestId;
  if (target.remoteId != null || dream.remoteId != null || target.clientRequestId || dream.clientRequestId) return false;
  return dream.id === target.id;
};

export const resolveDreamTarget = (dreams: DreamAnalysis[], target: DreamTarget): DreamAnalysis | undefined => {
  const selector = typeof target !== 'number' && target.remoteId == null && !target.clientRequestId ? target.id : target;
  const matches = dreams.filter((dream) => matchesDreamTarget(dream, selector));
  return matches.length === 1 ? matches[0] : undefined;
};

export const getDreamIdentityKey = (target: DreamTarget): string => {
  if (typeof target === 'number') return `local:${target}`;
  if (target.remoteId != null) return `remote:${target.remoteId}`;
  if (target.clientRequestId) return `client:${target.clientRequestId}`;
  return `local:${target.id}`;
};
