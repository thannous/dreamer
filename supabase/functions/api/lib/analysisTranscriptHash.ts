import { sha256Hex } from './sha256.ts';

/** Binds one analysis authorization to the exact transcript bytes supplied. */
export function hashAnalysisTranscript(transcript: string): Promise<string> {
  return sha256Hex(transcript);
}
