import type { DreamAnalysis, DreamMutation } from './types';

export type SyncMutationResultStatus = 'ack' | 'conflict' | 'failed';

export type SyncMutationResult = {
  mutationId: string;
  clientRequestId: string;
  operation: DreamMutation['operation'];
  status: SyncMutationResultStatus;
  dream?: DreamAnalysis;
  remoteId?: number;
  error?: string;
  /** An ACK persisted the legacy fields but omitted notes; its receipt cannot be reused. */
  incompleteAck?: { remoteId: number; revisionId: string };
};
