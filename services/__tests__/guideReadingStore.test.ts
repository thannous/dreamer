import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { activateGuideReadingScope, suspendGuideReadingScope, forgetGuideReading, flushGuideReadingForTests, guideReadingStorageKey, resetGuideReadingForTests, retryGuideReading, syncGuideReading, updateGuideReading } from '@/services/guideReadingStore';
import { mergeGuideReading, type GuideReadingEntries } from '@/lib/guideReading';

const mockStore = new Map<string, string>();
let mockReadFails = false;
let mockWriteFails = false;
let mockFailKey: string | null = null;
const mockRemoteRead = jest.fn();
const mockRemoteWrite = jest.fn();
jest.mock('@/lib/env', () => ({ isMockModeEnabled: () => false }));
jest.mock('@/services/guideReadingRemote', () => ({ readRemoteGuideReading: (...args: unknown[]) => (mockRemoteRead as (...args: unknown[]) => unknown)(...args), writeRemoteGuideReading: (...args: unknown[]) => (mockRemoteWrite as (...args: unknown[]) => unknown)(...args) }));
jest.mock('@/services/lucidKeyValueStorage', () => ({ getLucidKeyValueStorage: () => ({
  getItem: async (key: string) => { if (mockReadFails) throw Error('unreadable'); return mockStore.get(key) ?? null; },
  removeItem: async (key: string) => { mockStore.delete(key); },
  setItem: async (key: string, value: string) => { if (mockWriteFails || mockFailKey === key) throw Error('full'); mockStore.set(key, value); },
}) }));
const stored = (scope: 'guest' | `user:${string}`) => JSON.parse(mockStore.get(guideReadingStorageKey(scope)) ?? '{}');

describe('guide reading recovery and isolation (races not exercised by the UI journey)', () => {
  beforeEach(() => { resetGuideReadingForTests(); mockStore.clear(); mockReadFails = false; mockWriteFails = false; mockFailKey = null; mockRemoteRead.mockReset().mockResolvedValue({}); mockRemoteWrite.mockReset().mockResolvedValue({}); });
  it('transfers guest progress once to the first account without giving it to B', async () => {
    await activateGuideReadingScope('guest');
    updateGuideReading('guest', 'dream-journal', 2, true);
    await activateGuideReadingScope('user:a');
    await flushGuideReadingForTests();
    expect(stored('user:a')['dream-journal'].completedAt).toBeGreaterThan(0);
    expect(stored('guest')).toEqual({});
    await activateGuideReadingScope('user:b');
    expect(stored('user:b')).toEqual({});
  });
  it('retries the first claim write for A after auth loading without losing the transfer intent', async () => {
    await activateGuideReadingScope('guest');
    updateGuideReading('guest', 'dream-journal', 2);
    await flushGuideReadingForTests();
    suspendGuideReadingScope();
    mockFailKey = guideReadingStorageKey('guest');
    await activateGuideReadingScope('user:a', { transferGuest: true });
    expect(stored('guest').__claimOwner).toBeUndefined();
    expect(stored('user:a')).toEqual({});
    mockFailKey = null;
    await retryGuideReading('user:a');
    expect(stored('user:a')['dream-journal'].section).toBe(2);
    expect(stored('guest')).toEqual({});
    await activateGuideReadingScope('guest');
    await activateGuideReadingScope('user:b', { transferGuest: true });
    expect(stored('user:b')).toEqual({});
  });
  it('cannot reassign an undurable claim to B when A never retries', async () => {
    await activateGuideReadingScope('guest');
    updateGuideReading('guest', 'dream-journal', 2);
    await flushGuideReadingForTests();
    mockFailKey = guideReadingStorageKey('guest');
    await activateGuideReadingScope('user:a', { transferGuest: true });
    mockFailKey = null;
    await activateGuideReadingScope('user:b', { transferGuest: true });
    expect(stored('user:a')['dream-journal'].section).toBe(2);
    expect(stored('user:b')).toEqual({});
    expect(stored('guest')).toEqual({});
  });
  it('removes the failed first claim on account deletion so another account cannot inherit it', async () => {
    await activateGuideReadingScope('guest');
    updateGuideReading('guest', 'dream-journal', 2);
    await flushGuideReadingForTests();
    mockFailKey = guideReadingStorageKey('guest');
    await activateGuideReadingScope('user:a', { transferGuest: true });
    mockFailKey = null;
    await forgetGuideReading('a');
    await activateGuideReadingScope('user:b', { transferGuest: true });
    expect(stored('guest')).toEqual({});
    expect(stored('user:a')).toEqual({});
    expect(stored('user:b')).toEqual({});
  });
  it('does not claim unrelated guest data on a cold authenticated start or its retry', async () => {
    mockStore.set(guideReadingStorageKey('guest'), JSON.stringify({ 'dream-journal': { section: 2, updatedAt: 100 } }));
    await activateGuideReadingScope('user:a');
    await retryGuideReading('user:a');
    await activateGuideReadingScope('user:b');
    expect(stored('user:a')).toEqual({});
    expect(stored('user:b')).toEqual({});
    expect(stored('guest')['dream-journal'].section).toBe(2);
  });
  it('finishes an interrupted guest transfer for its reserved owner while opening B', async () => {
    await activateGuideReadingScope('guest');
    updateGuideReading('guest', 'dream-journal', 2, true);
    await flushGuideReadingForTests();
    mockFailKey = guideReadingStorageKey('user:a');
    await activateGuideReadingScope('user:a');
    expect(stored('guest').__claimOwner).toBe('user:a');
    mockFailKey = null;
    await activateGuideReadingScope('user:b');
    expect(stored('user:a')['dream-journal'].completedAt).toBeGreaterThan(0);
    expect(stored('user:b')).toEqual({});
    expect(stored('guest')).toEqual({});
  });
  it('persists an action to its original account even when switching before the write runs', async () => {
    await activateGuideReadingScope('user:a');
    updateGuideReading('user:a', 'dream-journal', 2, true);
    await activateGuideReadingScope('user:b');
    await flushGuideReadingForTests();
    expect(stored('user:a')['dream-journal'].completedAt).toBeGreaterThan(0);
    expect(stored('user:b')).toEqual({});
    expect(mockRemoteWrite).not.toHaveBeenCalled();
    expect(updateGuideReading('user:a', 'remember-dreams', 1)).toBe(false);
  });
  it('ignores a late remote response after account change and never writes it to the next account', async () => {
    let release!: (entries: GuideReadingEntries) => void;
    mockRemoteRead.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    await activateGuideReadingScope('user:a');
    const sync = syncGuideReading('user:a');
    // Flush the queued local write and let the remote read start without timers.
    for (let i = 0; i < 5; i++) await Promise.resolve();
    const change = activateGuideReadingScope('user:b');
    release({ 'dream-journal': { section: 3, updatedAt: 10, completedAt: 10 } });
    await sync; await change;
    expect(stored('user:b')).toEqual({});
    expect(mockRemoteWrite).not.toHaveBeenCalled();
  });
  it('keeps the cloud bookmark when a fresh device visits before its remote read resolves', async () => {
    let release!: (entries: GuideReadingEntries) => void;
    let began!: () => void;
    const started = new Promise<void>(resolve => { began = resolve; });
    mockRemoteRead.mockImplementationOnce(() => { began(); return new Promise(resolve => { release = resolve; }); });
    await activateGuideReadingScope('user:a');
    const sync = syncGuideReading('user:a');
    await started;
    updateGuideReading('user:a', 'dream-journal', 0);
    release({ 'dream-journal': { section: 3, updatedAt: 100 } });
    await sync; await flushGuideReadingForTests();
    expect(stored('user:a')['dream-journal']).toEqual({ section: 3, updatedAt: 100 });
    expect(mockRemoteWrite).toHaveBeenCalledWith('a', 'dream-journal', { section: 3, updatedAt: 100 });
    updateGuideReading('user:a', 'dream-journal', 0);
    await flushGuideReadingForTests();
    expect(stored('user:a')['dream-journal']).toEqual({ section: 3, updatedAt: 100 });
  });
  it('keeps an explicitly observed guest transition across auth loading and isolates later B', async () => {
    await activateGuideReadingScope('guest');
    updateGuideReading('guest', 'dream-journal', 2);
    await flushGuideReadingForTests();
    suspendGuideReadingScope();
    await activateGuideReadingScope('user:a', { transferGuest: true });
    suspendGuideReadingScope();
    await activateGuideReadingScope('guest', { transferGuest: false });
    await activateGuideReadingScope('user:b', { transferGuest: true });
    expect(stored('user:a')['dream-journal'].section).toBe(2);
    expect(stored('user:b')).toEqual({});
  });
  it('retains offline completion, retries after remote failure, and never claims visited means completed', async () => {
    mockRemoteRead.mockRejectedValueOnce(Error('offline'));
    await activateGuideReadingScope('user:a');
    updateGuideReading('user:a', 'dream-journal', 2, true);
    await flushGuideReadingForTests();
    expect(stored('user:a')['dream-journal'].completedAt).toBeGreaterThan(0);
    await retryGuideReading('user:a');
    expect(mockRemoteWrite).toHaveBeenCalledTimes(1);
    updateGuideReading('user:a', 'remember-dreams', 0);
    await flushGuideReadingForTests();
    expect(stored('user:a')['remember-dreams'].completedAt).toBeUndefined();
  });
  it('leaves unreadable storage intact and retries local writes after disk failure', async () => {
    const key = guideReadingStorageKey('guest');
    mockStore.set(key, JSON.stringify({ 'dream-journal': { section: 2, updatedAt: 20, completedAt: 10 } }));
    mockReadFails = true;
    await activateGuideReadingScope('guest');
    expect(updateGuideReading('guest', 'remember-dreams', 0)).toBe(false);
    mockReadFails = false;
    await retryGuideReading('guest');
    mockWriteFails = true;
    updateGuideReading('guest', 'remember-dreams', 2, true);
    await flushGuideReadingForTests();
    mockWriteFails = false;
    await retryGuideReading('guest');
    expect(stored('guest')['dream-journal'].completedAt).toBe(10);
    expect(stored('guest')['remember-dreams'].completedAt).toBeGreaterThan(0);
  });
  it('forgets a deleted account after queued writes without erasing another account', async () => {
    await activateGuideReadingScope('user:a');
    updateGuideReading('user:a', 'dream-journal', 2, true);
    mockStore.set(guideReadingStorageKey('guest'), JSON.stringify({ __claimOwner: 'user:a', 'dream-journal': { section: 2, updatedAt: 2 } }));
    const remove = forgetGuideReading('a');
    await activateGuideReadingScope('user:b');
    updateGuideReading('user:b', 'remember-dreams', 1);
    await remove; await flushGuideReadingForTests();
    expect(mockStore.has(guideReadingStorageKey('user:a'))).toBe(false);
    expect(mockStore.has(guideReadingStorageKey('guest'))).toBe(false);
    expect(stored('user:b')['remember-dreams'].section).toBe(1);
    expect(updateGuideReading('user:a', 'dream-journal', 3)).toBe(false);
  });
  it('keeps completion when an older or merely visited device merges a bookmark', () => {
    expect(mergeGuideReading({ 'dream-journal': { section: 3, updatedAt: 30, completedAt: 20 } },
      { 'dream-journal': { section: 0, updatedAt: 40 } })['dream-journal']).toEqual({ section: 3, updatedAt: 30, completedAt: 20 });
  });
});
