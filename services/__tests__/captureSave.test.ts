import { describe, expect, it } from '@jest/globals';
import { DREAM_TRANSCRIPT_MAX_CHARS } from '@/constants/limits';
import type { DreamAnalysis } from '@/lib/types';
import { CaptureSaveValidationError, createCaptureSave, type CaptureToSave } from '../captureSave';

const capture = (transcript = 'A blue door beside the lake'): CaptureToSave => ({ transcript, voiced: false });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
};

function setup() {
  const operation = createCaptureSave();
  const built: DreamAnalysis[] = [];
  const writes: DreamAnalysis[] = [];
  const buildDream = (transcript: string): DreamAnalysis => {
    const dream: DreamAnalysis = {
      id: built.length + 1, clientRequestId: `capture-${built.length + 1}`,
      transcript, title: 'Dream', interpretation: '', shareableQuote: '', imageUrl: '',
      chatHistory: [], dreamType: 'Everyday Dream',
    };
    built.push(dream);
    return dream;
  };
  const persist = async (dream: DreamAnalysis) => { writes.push(dream); return dream; };
  const request = { prepare: async () => capture(), buildDream, persist };
  return { operation, request, built, writes };
}

describe('durable capture save', () => {
  // UI journeys cannot deterministically overlap a native stop and an unknown
  // storage acknowledgement. These contracts control those two boundaries.
  it('reserves the capture before speech stops and saves its final words only once', async () => {
    const { operation, request, built, writes } = setup();
    const stopped = deferred<CaptureToSave>();
    const acknowledged = deferred<DreamAnalysis>();
    const written = deferred<DreamAnalysis>();
    let preparations = 0;
    const pendingRequest = {
      ...request,
      prepare: () => { preparations += 1; return stopped.promise; },
      persist: (dream: DreamAnalysis) => {
        writes.push(dream);
        written.resolve(dream);
        return acknowledged.promise;
      },
    };
    const first = operation.save(pendingRequest);
    expect(await operation.save(pendingRequest)).toBeNull();
    operation.reset();
    expect(await operation.save(pendingRequest)).toBeNull();
    expect(preparations).toBe(1);
    expect(built).toHaveLength(0);

    stopped.resolve({ transcript: '  The final spoken words  ', originalTranscript: 'My original exchanges', voiced: true });
    const dream = await written.promise;
    expect(dream).toMatchObject({ transcript: 'The final spoken words', captureOriginalTranscript: 'My original exchanges' });
    expect(await operation.save(pendingRequest)).toBeNull();
    acknowledged.resolve({ ...dream, remoteId: 17 });
    expect(await first).toMatchObject({ dream: { remoteId: 17 }, capture: { voiced: true } });
    expect(await operation.save(request)).toBeNull();
    expect(writes).toHaveLength(1);
  });

  it('reuses the same identity when the first write succeeded but its acknowledgement was lost', async () => {
    const { operation, request, built } = setup();
    const journal = new Map<string, DreamAnalysis>();
    let attempts = 0;
    const failure = new Error('Acknowledgement lost');
    const retryable = {
      ...request,
      persist: async (dream: DreamAnalysis) => {
        journal.set(dream.clientRequestId!, dream);
        if (++attempts === 1) throw failure;
        return dream;
      },
    };
    await expect(operation.save(retryable)).rejects.toBe(failure);
    expect(operation.getSnapshot()).toMatchObject({ status: 'failed', dream: { clientRequestId: 'capture-1' } });
    const saved = await operation.save(retryable);
    expect(saved?.dream.clientRequestId).toBe('capture-1');
    expect(built).toHaveLength(1);
    expect(journal.size).toBe(1);
    expect(operation.getSnapshot().status).toBe('saved');
  });

  it('saves the edited draft after a failed write instead of replaying stale text', async () => {
    const { operation, request } = setup();
    await expect(operation.save({ ...request, persist: async () => { throw new Error('Storage unavailable'); } })).rejects.toThrow();
    const saved = await operation.save({ ...request, prepare: async () => capture('A red door') });
    expect(saved?.dream).toMatchObject({ transcript: 'A red door', clientRequestId: 'capture-2' });
  });

  it.each([
    ['empty', '   \n '],
    ['too_long', 'a'.repeat(DREAM_TRANSCRIPT_MAX_CHARS + 1)],
  ] as const)('keeps an invalid %s capture out of persistence', async (reason: 'empty' | 'too_long', transcript: string) => {
    const { operation, request, built, writes } = setup();
    await expect(operation.save({ ...request, prepare: async () => capture(transcript) }))
      .rejects.toEqual(new CaptureSaveValidationError(reason));
    expect(built).toHaveLength(0);
    expect(writes).toHaveLength(0);
  });

  it('allows retry after speech finalization fails without having written an incomplete draft', async () => {
    const { operation, request, writes } = setup();
    await expect(operation.save({ ...request, prepare: async () => { throw new Error('Stop failed'); } })).rejects.toThrow('Stop failed');
    expect(writes).toHaveLength(0);
    await operation.save(request);
    expect(writes).toHaveLength(1);
  });

  it('only creates another dream when a new capture is explicitly started', async () => {
    const { operation, request, writes } = setup();
    await operation.save(request);
    operation.reset();
    const saved = await operation.save(request);
    expect(saved?.dream.clientRequestId).toBe('capture-2');
    expect(writes).toHaveLength(2);
  });
});
