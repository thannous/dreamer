import type { PostgrestError } from '@supabase/supabase-js';

export const formatError = (error: PostgrestError | null, defaultMessage: string): CodedError => {
  const message = error?.message?.trim() ? error.message : defaultMessage;
  const err = new Error(message) as CodedError;
  if (error?.code) {
    err.code = error.code;
  }
  return err;
};

export type CodedError = Error & { code?: string };
