import type { DreamAnalysis } from './types';

/**
 * Recall drafts follow their original client identity through remote promotion.
 * Never infer their owner from collection cardinality: a later page or deletion
 * must not move a draft. Old numeric sidecars lack account ownership evidence and
 * are deliberately left untouched for identified dreams, rather than reassigned.
 */
export function getDreamRecallStorageId(
  dream: Pick<DreamAnalysis, 'id' | 'remoteId' | 'clientRequestId'>,
  accountId: string | null,
): string {
  const scope = accountId ?? 'guest';
  if (dream.clientRequestId) return `${scope}:client:${dream.clientRequestId}`;
  if (dream.remoteId != null) return `${scope}:remote:${dream.remoteId}`;
  return String(dream.id);
}
