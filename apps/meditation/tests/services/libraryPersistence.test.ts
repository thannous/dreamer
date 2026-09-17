import AsyncStorage from '@react-native-async-storage/async-storage';
import { INITIAL_LIBRARY, PRACTICE_LOG_MAX, type LibraryState } from '@/lib/types';
import { createLibraryPersistence } from '@/services/libraryPersistence';
import { StorageKey } from '@/services/storageService';

const originalWrite = (AsyncStorage.setItem as jest.Mock).getMockImplementation()!;
const originalRead = (AsyncStorage.getItem as jest.Mock).getMockImplementation()!;
afterEach(() => {
  (AsyncStorage.setItem as jest.Mock).mockImplementation(originalWrite);
  (AsyncStorage.getItem as jest.Mock).mockImplementation(originalRead);
});

const seed = async (state: unknown) => AsyncStorage.setItem(StorageKey.favorites, JSON.stringify(state));
const library = (): LibraryState => ({ favorites: ['sleep-descent'], progress: {
  'sleep-descent': { positionSec: 30, completedCount: 2, lastPlayedISO: '2026-09-08' },
}, practiceLog: [{ dateISO: '2026-09-08', seconds: 300 }] });

describe('split library persistence', () => {
  it('migrates legacy data and restores it from a fresh persistence instance', async () => {
    const original = library();
    await seed(original);
    const persistence = createLibraryPersistence();
    expect(await persistence.load()).toEqual(original);
    await persistence.save(original);
    expect(JSON.parse((await AsyncStorage.getItem(StorageKey.favorites))!)).not.toHaveProperty('progress');
    expect(await createLibraryPersistence().load()).toEqual(original);
  });

  it('keeps the full legacy copy when the progress write fails; same-value retry persists', async () => {
    const original = library(); await seed(original);
    const persistence = createLibraryPersistence(); await persistence.load();
    const spy = jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk'));
    await expect(persistence.save(original)).rejects.toThrow('disk');
    expect(JSON.parse((await AsyncStorage.getItem(StorageKey.favorites))!)).toEqual(original);
    await persistence.save(original); spy.mockImplementation(originalWrite);
    expect(await createLibraryPersistence().load()).toEqual(original);
  });

  it('recovers interruption after progress copy without losing legacy favorites/history', async () => {
    const original = library(); await seed(original);
    const persistence = createLibraryPersistence(); await persistence.load();
    const write = originalWrite;
    const spy = jest.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, value) => {
      if (key === StorageKey.favorites) throw new Error('interrupted');
      return write(key, value);
    });
    await expect(persistence.save(original)).rejects.toThrow('interrupted'); spy.mockImplementation(originalWrite);
    const fresh = createLibraryPersistence(); expect(await fresh.load()).toEqual(original);
    await fresh.save(original);
    expect(await createLibraryPersistence().load()).toEqual(original);
  });

  it.each(['read', 'json', 'schema', 'null'])('blocks writes after %s failure and can retry hydration', async (mode) => {
    const original = library(); await seed(original);
    let spy: jest.SpyInstance | undefined;
    if (mode === 'read') spy = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('read'));
    if (mode === 'json') await AsyncStorage.setItem(StorageKey.favorites, '{');
    if (mode === 'null') await seed(null);
    if (mode === 'schema') await seed({ favorites: 'invalid' });
    const before = await AsyncStorage.getItem(StorageKey.progress).catch(() => null);
    // Re-arm the read failure after the inspection above.
    if (mode === 'read') spy!.mockRejectedValueOnce(new Error('read'));
    const persistence = createLibraryPersistence();
    await expect(persistence.load()).rejects.toThrow();
    await expect(persistence.save(INITIAL_LIBRARY)).rejects.toThrow('loaded');
    expect(await AsyncStorage.getItem(StorageKey.progress)).toEqual(before);
    spy?.mockImplementation(originalRead); await seed(original);
    expect(await persistence.load()).toEqual(original);
  });

  it('serializes concurrent writes and retries after failure without letting older state win', async () => {
    const persistence = createLibraryPersistence(); await persistence.load();
    const first = library(); const second = { ...library(), favorites: ['newer'] };
    const spy = jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk'));
    const writes = await Promise.allSettled([persistence.save(first), persistence.save(second)]);
    expect(writes.map((result) => result.status)).toEqual(['rejected', 'fulfilled']); spy.mockImplementation(originalWrite);
    expect(await createLibraryPersistence().load()).toEqual(second);
    const noWrite = jest.spyOn(AsyncStorage, 'setItem').mockClear(); await persistence.save(second);
    expect(noWrite).not.toHaveBeenCalled(); noWrite.mockImplementation(originalWrite);
  });

  it('writes only progress for 120 five-second ticks with a full practice history', async () => {
    const state = library();
    state.practiceLog = Array.from({ length: PRACTICE_LOG_MAX }, () => ({ dateISO: '2026-09-08', sessionId: 'sleep-descent', seconds: 600 }));
    await seed(state); const persistence = createLibraryPersistence(); await persistence.load(); await persistence.save(state);
    const writes = jest.spyOn(AsyncStorage, 'setItem').mockClear(); let baselineBytes = 0;
    const stringify = jest.spyOn(JSON, 'stringify');
    for (let tick = 1; tick <= 120; tick++) {
      const next = { ...state, progress: { ...state.progress, 'sleep-descent': { ...state.progress['sleep-descent'], positionSec: tick * 5 } } };
      baselineBytes += JSON.stringify(next).length; await persistence.save(next);
    }
    const bytes = writes.mock.calls.reduce((sum, [, json]) => sum + json.length, 0);
    expect(writes).toHaveBeenCalledTimes(120);
    expect(writes.mock.calls.every(([key]) => key === StorageKey.progress)).toBe(true);
    expect(bytes).toBeLessThan(baselineBytes / 100);
    expect(stringify.mock.calls.filter(([value]) => value && typeof value === 'object' && 'version' in value && 'practiceLog' in value)).toHaveLength(0);
    stringify.mockRestore();
    console.info('TI526 bytes/120 ticks', { baselineBytes, splitBytes: bytes }); writes.mockImplementation(originalWrite);
  });
});
