import { describe, expect, it, jest } from '@jest/globals';
import type { DreamAnalysis } from '@/lib/types';
import { createDreamChatSend, type DreamChatSendRequest } from '../dreamChatSend';

type Ports = Parameters<ReturnType<typeof createDreamChatSend>['send']>[1];
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
};

function setup() {
  let ids = 0;
  const dream: DreamAnalysis = {
    id: 17, remoteId: 88, clientRequestId: 'dream-one', transcript: 'A garden',
    title: 'Garden', dreamType: 'Everyday Dream', interpretation: 'A place to rest',
    shareableQuote: '', imageUrl: '', chatHistory: [],
  };
  const ports = {
    createId: () => `generated-${++ids}`,
    now: () => 1000,
    getFingerprint: jest.fn(async (): Promise<string> => 'device'),
    syncDream: jest.fn(async (): Promise<DreamAnalysis> => ({ ...dream, id: 18, remoteId: 89 })),
    updateDream: jest.fn(async (): Promise<void> => {}),
    applyServerDream: jest.fn(async (): Promise<void> => {}),
    requestReply: jest.fn(async (): ReturnType<Ports['requestReply']> => ({ text: 'What did the garden feel like?', message: { id: 'reply-one' } })),
  };
  const request: DreamChatSendRequest = {
    dream, userId: 'user-one', mock: false, text: 'Tell me about its symbols',
    displayText: 'Symbols', language: 'en', requestId: 'turn-one',
    meta: { category: 'symbols' }, baseMessages: [],
    onAccepted: jest.fn(), onReply: jest.fn(), onDelta: jest.fn(),
  };
  return { operation: createDreamChatSend(), request, ports };
}

describe('dream chat transaction', () => {
  // These controlled boundaries cover late sync/network acknowledgements that
  // cannot be scheduled reliably by the browser journey.
  it('keeps one turn in flight through persistence and caches the server-committed reply', async () => {
    const { operation, request, ports } = setup();
    const committed = deferred<unknown>();
    const persisting = deferred<void>();
    ports.applyServerDream.mockImplementation(async () => { persisting.resolve(); return committed.promise; });
    const first = operation.send(request, ports);
    await persisting.promise;
    expect(operation.getSnapshot()).toMatchObject({ status: 'sending', phase: 'persisting', requestId: 'turn-one' });
    expect(await operation.send({ ...request, requestId: 'turn-two' }, ports)).toEqual({ status: 'ignored' });
    expect(ports.requestReply).toHaveBeenCalledTimes(1);
    expect(ports.updateDream).not.toHaveBeenCalled();
    expect(ports.applyServerDream.mock.calls[0][0].chatHistory).toEqual([
      expect.objectContaining({ id: 'turn-one', role: 'user', text: 'Symbols', meta: { category: 'symbols' } }),
      expect.objectContaining({ id: 'reply-one', role: 'model' }),
    ]);
    committed.resolve(undefined);
    expect(await first).toMatchObject({ status: 'sent', synced: false });
  });

  it('sends guest context and saves locally even if fingerprint lookup fails', async () => {
    const { operation, request, ports } = setup();
    ports.getFingerprint.mockRejectedValue(new Error('Fingerprint unavailable'));
    await operation.send({ ...request, userId: undefined, dream: { ...request.dream, remoteId: undefined } }, ports);
    expect(ports.requestReply.mock.calls[0]).toEqual([
      '17', request.text, 'en', expect.objectContaining({ transcript: 'A garden', chatHistory: [expect.objectContaining({ id: 'turn-one' })] }),
      undefined, expect.objectContaining({ clientRequestId: 'turn-one' }),
    ]);
    expect(ports.updateDream).toHaveBeenCalledTimes(1);
    expect(ports.applyServerDream).not.toHaveBeenCalled();
  });

  it('persists a create identity before auto-sync and uses the returned server identity for chat', async () => {
    const { operation, request, ports } = setup();
    const unsynced = { ...request.dream, remoteId: undefined, clientRequestId: undefined };
    const result = await operation.send({ ...request, dream: unsynced }, ports);
    expect(ports.updateDream.mock.calls[0]).toEqual([expect.objectContaining({ clientRequestId: 'generated-1' }), unsynced]);
    expect(ports.syncDream.mock.calls[0]).toEqual([ports.updateDream.mock.calls[0][0], 'user-one']);
    expect(ports.updateDream).toHaveBeenCalledTimes(2);
    expect(ports.requestReply.mock.calls[0][0]).toBe('89');
    expect(request.onAccepted).toHaveBeenCalledWith(null);
    expect(result).toMatchObject({ status: 'sent', synced: true, dream: { remoteId: 89 } });
  });

  it('does not continue an auto-sync after the screen/account is left', async () => {
    const { operation, request, ports } = setup();
    const sync = deferred<DreamAnalysis>();
    ports.syncDream.mockReturnValue(sync.promise);
    const pending = operation.send({ ...request, dream: { ...request.dream, remoteId: undefined } }, ports);
    operation.cancel();
    sync.resolve({ ...request.dream, remoteId: 98 });
    expect(await pending).toEqual({ status: 'cancelled' });
    expect(ports.updateDream).not.toHaveBeenCalled();
    expect(ports.requestReply).not.toHaveBeenCalled();
    expect(request.onReply).not.toHaveBeenCalled();
  });

  it('does not send guest text if cancelled during fingerprint lookup', async () => {
    const { operation, request, ports } = setup();
    const fingerprint = deferred<string>();
    ports.getFingerprint.mockReturnValue(fingerprint.promise);
    const pending = operation.send({ ...request, userId: undefined }, ports);
    operation.cancel();
    fingerprint.resolve('device');
    expect(await pending).toEqual({ status: 'cancelled' });
    expect(ports.requestReply).not.toHaveBeenCalled();
  });

  it('returns the failed pending turn and preserves its request identity on retry', async () => {
    const { operation, request, ports } = setup();
    const error = new Error('Connection lost');
    ports.requestReply.mockRejectedValueOnce(error);
    expect(await operation.send(request, ports)).toMatchObject({ status: 'failed', error,
      pendingMessages: [expect.objectContaining({ id: 'turn-one' })] });
    expect(ports.applyServerDream).not.toHaveBeenCalled();
    expect(await operation.send(request, ports)).toMatchObject({ status: 'sent' });
    expect(ports.requestReply.mock.calls.map((call: Parameters<Ports['requestReply']>) => call[5]?.clientRequestId)).toEqual(['turn-one', 'turn-one']);
    expect(ports.applyServerDream.mock.calls[0][0].chatHistory).toHaveLength(2);
  });

  it('ignores old stream fragments and responses after a replacement turn starts', async () => {
    const { operation, request, ports } = setup();
    const reply = deferred<{ text: string }>();
    ports.requestReply.mockReturnValueOnce(reply.promise);
    const pending = operation.send(request, ports);
    const firstOptions = ports.requestReply.mock.calls[0][5]!;
    firstOptions.onDelta?.('First fragment');
    expect(request.onDelta).toHaveBeenCalledTimes(1);
    operation.cancel();
    expect(firstOptions.signal?.aborted).toBe(true);
    await operation.send({ ...request, requestId: 'replacement' }, ports);
    firstOptions.onDelta?.('Late fragment');
    reply.resolve({ text: 'Late response' });
    expect(await pending).toEqual({ status: 'cancelled' });
    expect(request.onDelta).toHaveBeenCalledTimes(1);
    expect(request.onReply).toHaveBeenCalledTimes(1);
    expect(ports.applyServerDream).toHaveBeenCalledTimes(1);
    expect(operation.getSnapshot()).toEqual({ status: 'sent', requestId: 'replacement' });
  });

  it('does not acknowledge success when persistence rejects after the visible reply', async () => {
    const { operation, request, ports } = setup();
    const error = new Error('Cache write failed');
    ports.applyServerDream.mockRejectedValue(error);
    expect(await operation.send(request, ports)).toMatchObject({ status: 'failed', error });
    expect(operation.getSnapshot()).toEqual({ status: 'failed', requestId: 'turn-one', error });
  });
});
