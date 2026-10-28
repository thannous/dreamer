import { buildCaptureNarrative, type CaptureReview } from '@/lib/captureReviewDraft';
import { createExternalStore } from '@/lib/externalStore';
import { isTranscriptSaveable } from '@/lib/recordingDraftProgress';

export type CaptureReviewPreparationState =
  | { status: 'idle' }
  | { status: 'stopping' }
  | { status: 'formatting'; source: string }
  | { status: 'failed'; error: unknown };

type Request = {
  /** Finalize speech before taking the immutable source snapshot. */
  readSource: () => Promise<string>;
  weave: (source: string, signal: AbortSignal) => Promise<string | null>;
};

const IDLE: CaptureReviewPreparationState = { status: 'idle' };

/** Speech is being finalized or the proposal written: the capture is not editable. */
export const isPreparingReview = (state: CaptureReviewPreparationState): boolean =>
  state.status === 'stopping' || state.status === 'formatting';

/** A proposal belongs to one source snapshot and may never outlive its capture. */
export function createCaptureReviewPreparation() {
  const { getSnapshot, subscribe, publish } = createExternalStore(IDLE);
  let active: AbortController | null = null;
  return {
    getSnapshot,
    subscribe,
    cancel: () => {
      active?.abort();
      active = null;
      publish(IDLE);
    },
    prepare: async ({ readSource, weave }: Request): Promise<CaptureReview | null> => {
      if (active) return null;
      const owner = new AbortController();
      active = owner;
      publish({ status: 'stopping' });
      try {
        const source = await readSource();
        if (active !== owner) return null;
        const text = buildCaptureNarrative(source);
        if (!isTranscriptSaveable(text)) return null;
        publish({ status: 'formatting', source });
        const woven = await weave(source, owner.signal);
        if (active !== owner) return null;
        if (woven !== null && !isTranscriptSaveable(woven)) throw new Error('Invalid formatted narrative');
        return woven ? { source, text: woven, woven: true } : { source, text };
      } catch (error) {
        if (active !== owner) return null;
        publish({ status: 'failed', error });
        throw error;
      } finally {
        if (active === owner) {
          active = null;
          if (getSnapshot().status !== 'failed') publish(IDLE);
        }
      }
    },
  };
}
