import type { PostgrestError } from '@supabase/supabase-js';
import type { DreamAnalysis } from './types';

export const formatError = (error: PostgrestError | null, defaultMessage: string): CodedError => {
  const message = error?.message?.trim() ? error.message : defaultMessage;
  const err = new Error(message) as CodedError;
  if (error?.code) {
    err.code = error.code;
  }
  return err;
};

export type CodedError = Error & { code?: string };

/** A legacy write committed known fields but could not persist personal notes. */
export class IncompleteJournalAckError extends Error {
  constructor(message: string, readonly identity: { remoteId: number; revisionId: string },
    readonly migrationRecovery?: DreamAnalysis['migrationRecovery']) {
    super(message);
    this.name = 'IncompleteJournalAckError';
  }
}
