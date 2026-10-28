import { isDreamTextTooLong } from '@/lib/dreamTextLimit';
import { createExternalStore } from '@/lib/externalStore';
import { isTranscriptSaveable } from '@/lib/recordingDraftProgress';
import type { DreamAnalysis } from '@/lib/types';

export type CaptureToSave = {
  transcript: string;
  originalTranscript?: string;
  voiced: boolean;
};

export type CaptureSaveState =
  | { status: 'idle'; dream: null }
  | { status: 'saving'; dream: DreamAnalysis | null }
  | { status: 'failed'; dream: DreamAnalysis | null; error: unknown }
  | { status: 'saved'; dream: DreamAnalysis };

export class CaptureSaveValidationError extends Error {
  constructor(readonly reason: 'empty' | 'too_long') {
    super(`Capture cannot be saved: ${reason}`);
    this.name = 'CaptureSaveValidationError';
  }
}

type SaveRequest = {
  /** Finish active dictation before reading the final capture. */
  prepare: () => Promise<CaptureToSave>;
  buildDream: (transcript: string) => DreamAnalysis;
  persist: (dream: DreamAnalysis) => Promise<DreamAnalysis>;
};

const IDLE: CaptureSaveState = { status: 'idle', dream: null };

/** One capture's durable save, independent of React, native APIs and enrichment. */
export function createCaptureSave() {
  const { getSnapshot, subscribe, publish } = createExternalStore(IDLE);

  return {
    getSnapshot,
    subscribe,
    reset: () => {
      // A new draft must not unlock a write whose outcome is still unknown.
      if (getSnapshot().status === 'saving') return;
      publish(IDLE);
    },
    save: async ({ prepare, buildDream, persist }: SaveRequest) => {
      // Reserve before preparing: stopping native speech is asynchronous too.
      // Keep the saved state locked until navigation or an explicit new capture.
      const previous = getSnapshot();
      if (previous.status === 'saving' || previous.status === 'saved') return null;
      const previousDream = previous.dream;
      publish({ status: 'saving', dream: previousDream });
      try {
        const capture = await prepare();
        if (!isTranscriptSaveable(capture.transcript)) throw new CaptureSaveValidationError('empty');
        const transcript = capture.transcript.trim();
        if (isDreamTextTooLong(transcript)) throw new CaptureSaveValidationError('too_long');

        // A failed/ambiguous write is retried with the same create identity.
        const draft = previousDream?.transcript === transcript ? previousDream : buildDream(transcript);
        const dream = capture.originalTranscript === undefined
          ? draft : { ...draft, captureOriginalTranscript: capture.originalTranscript };
        publish({ status: 'saving', dream });
        const saved = await persist(dream);
        publish({ status: 'saved', dream: saved });
        return { dream: saved, capture: { ...capture, transcript } };
      } catch (error) {
        publish({ status: 'failed', dream: getSnapshot().dream, error });
        throw error;
      }
    },
  };
}
