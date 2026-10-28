import { createCaptureReviewPreparation } from '../captureReviewPreparation';

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
};

describe('capture review preparation', () => {
  // Native final speech and an ignored network abort cannot reliably be timed in a UI journey.
  it('locks before stopping speech and takes the final source only once', async () => {
    const operation = createCaptureReviewPreparation();
    const stopped = deferred<string>();
    const readSource = jest.fn(() => stopped.promise);
    const weave = jest.fn(async () => null);
    const first = operation.prepare({ readSource, weave });
    expect(await operation.prepare({ readSource, weave })).toBeNull();
    expect(readSource).toHaveBeenCalledTimes(1);
    stopped.resolve('The final spoken words.');
    expect(await first).toEqual({ source: 'The final spoken words.', text: 'The final spoken words.' });
  });

  it('does not format a draft whose account or screen closed while speech was stopping', async () => {
    const operation = createCaptureReviewPreparation();
    const stopped = deferred<string>();
    const weave = jest.fn(async () => 'An old account.');
    const pending = operation.prepare({ readSource: () => stopped.promise, weave });
    operation.cancel();
    stopped.resolve('An old account.');
    expect(await pending).toBeNull();
    expect(weave).not.toHaveBeenCalled();
  });

  it('ignores a late formatter response without unlocking the replacement capture', async () => {
    const operation = createCaptureReviewPreparation();
    const oldResult = deferred<string>();
    const newResult = deferred<string>();
    let oldSignal: AbortSignal | undefined;
    const old = operation.prepare({ readSource: async () => 'Old source', weave: (_source, signal) => {
      oldSignal = signal;
      return oldResult.promise;
    } });
    await Promise.resolve();
    operation.cancel();
    const current = operation.prepare({ readSource: async () => 'Current source', weave: () => newResult.promise });
    await Promise.resolve();
    oldResult.resolve('Obsolete proposal');
    expect(await old).toBeNull();
    expect(oldSignal?.aborted).toBe(true);
    expect(operation.getSnapshot()).toEqual({ status: 'formatting', source: 'Current source' });
    newResult.resolve('Current proposal');
    expect(await current).toEqual({ source: 'Current source', text: 'Current proposal', woven: true });
  });

  it('retains the original source and allows another attempt after invalid provider output', async () => {
    const operation = createCaptureReviewPreparation();
    const readSource = async () => 'A story worth preserving.';
    await expect(operation.prepare({ readSource, weave: async () => '   ' })).rejects.toThrow('Invalid formatted narrative');
    expect(operation.getSnapshot().status).toBe('failed');
    expect(await operation.prepare({ readSource, weave: async () => null })).toEqual({
      source: 'A story worth preserving.', text: 'A story worth preserving.',
    });
  });

  it('leaves an empty capture out of the formatter', async () => {
    const operation = createCaptureReviewPreparation();
    const weave = jest.fn(async () => null);
    expect(await operation.prepare({ readSource: async () => '  ', weave })).toBeNull();
    expect(weave).not.toHaveBeenCalled();
    expect(operation.getSnapshot()).toEqual({ status: 'idle' });
  });
});
