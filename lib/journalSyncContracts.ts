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
};

