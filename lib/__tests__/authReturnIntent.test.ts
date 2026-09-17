const mockRead = jest.fn();
const mockWrite = jest.fn();
jest.mock('@/services/storageService', () => ({
  getPendingAuthReturn: () => mockRead(),
  savePendingAuthReturn: (value: string) => mockWrite(value),
}));

describe('authentication return intent', () => {
  let intent: typeof import('../authReturnIntent');
  beforeEach(() => {
    jest.resetModules();
    mockRead.mockReset().mockResolvedValue(null);
    mockWrite.mockReset().mockResolvedValue(undefined);
    intent = require('../authReturnIntent');
  });

  it.each([
    'https://evil.example/journal/42', '//evil.example/journal/42', '/auth/callback',
    '/settings', '/journal/0', '/journal/9007199254740992', '/journal/42?remoteId=0',
    '/journal/42?remoteId=7&remoteId=8', '/journal/42?next=analyze', '/journal/42#token',
    '/journal/42?clientRequestId=a%2Fb', '/journal/42?remoteId=7&redirect=https://evil.example',
  ])('rejects unsafe or ambiguous return %s', (value) => {
    expect(intent.normalizeAuthReturnDestination(value)).toBeNull();
  });

  it('retains stable dream identity and chat position while excluding side effects', () => {
    expect(intent.dreamAuthReturnDestination('dream-chat', {
      id: '1700000000000', remoteId: '42', clientRequestId: 'request-1', mode: 'free', messageId: 'message-3', saved: '1',
    })).toBe('/dream-chat/1700000000000?remoteId=42&clientRequestId=request-1&mode=free&messageId=message-3');
    expect(intent.dreamAuthReturnDestination('journal', { id: ['42', '43'] })).toBeNull();
  });

  it('restores a bounded intent across process recreation', async () => {
    const saved = { destination: '/journal/1700000000000?remoteId=42', createdAt: Date.now() };
    mockRead.mockResolvedValue(JSON.stringify(saved));
    await intent.restoreAuthReturnIntent();
    expect(intent.getAuthReturnSnapshot()).toEqual({ ready: true, intent: saved });
    expect(mockWrite).not.toHaveBeenCalled();
    expect(intent.parseAuthReturnIntent(JSON.stringify(saved), saved.createdAt + intent.AUTH_RETURN_TTL_MS)).toBeNull();
    expect(intent.parseAuthReturnIntent(JSON.stringify(saved), saved.createdAt - 1)).toBeNull();
  });

  it('does not publish an intent until durable storage accepts it', async () => {
    await intent.restoreAuthReturnIntent();
    mockWrite.mockRejectedValueOnce(new Error('disk unavailable'));
    await expect(intent.requestAuthReturn('/journal/42')).rejects.toThrow('disk unavailable');
    expect(intent.getAuthReturnSnapshot().intent).toBeNull();
  });

  it('does not delete anything when restoration fails', async () => {
    mockRead.mockRejectedValueOnce(new Error('disk unavailable'));
    await expect(intent.restoreAuthReturnIntent()).rejects.toThrow('disk unavailable');
    expect(mockWrite).not.toHaveBeenCalled();
    expect(intent.getAuthReturnSnapshot().ready).toBe(true);
  });

  it('acknowledges once and never clears a newer request with an older completion', async () => {
    await intent.restoreAuthReturnIntent();
    await intent.requestAuthReturn('/journal/42');
    const first = intent.getAuthReturnSnapshot().intent!;
    const replacement = intent.requestAuthReturn('/journal/43');
    const oldCompletion = intent.completeAuthReturn(first);
    await Promise.all([replacement, oldCompletion]);
    const second = intent.getAuthReturnSnapshot().intent!;
    expect(second.destination).toBe('/journal/43');
    mockWrite.mockClear();
    await Promise.all([intent.completeAuthReturn(second), intent.completeAuthReturn(second)]);
    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(mockWrite).toHaveBeenCalledWith('null');
    expect(intent.getAuthReturnSnapshot().intent).toBeNull();
  });

  it('does not acknowledge the same path with a different dream identity', () => {
    const pending = { destination: '/journal/1700000000000?remoteId=42', createdAt: Date.now() };
    expect(intent.isAuthReturnObserved(pending, '/journal/1700000000000', { remoteId: '43' })).toBe(false);
    expect(intent.isAuthReturnObserved(pending, '/journal/1700000000000', { remoteId: '42' })).toBe(true);
  });
});
