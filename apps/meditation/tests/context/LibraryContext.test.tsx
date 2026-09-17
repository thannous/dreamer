import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { LibraryProvider, useLibrary, useLibraryMetadata, useLibraryCommands } from '@/context/LibraryContext';
import { INITIAL_LIBRARY, type LibraryState } from '@/lib/types';
import { StorageKey } from '@/services/storageService';

const seedStorage = async (value: unknown) =>
  AsyncStorage.setItem(StorageKey.favorites, JSON.stringify(value));

const readStorage = async (): Promise<LibraryState | null> => {
  const raw = await AsyncStorage.getItem(StorageKey.favorites);
  return raw === null ? null : (JSON.parse(raw) as LibraryState);
};

const mountLibrary = async () => {
  const view = renderHook(() => useLibrary(), { wrapper: LibraryProvider });
  await waitFor(() => expect(view.result.current.loaded).toBe(true));
  return view;
};

describe('LibraryProvider', () => {
  it('starts empty', async () => {
    const { result } = await mountLibrary();
    expect(result.current.favorites).toEqual([]);
    expect(result.current.isFavorite('sleep-descent')).toBe(false);
  });

  it('restores what was saved before', async () => {
    await seedStorage({ ...INITIAL_LIBRARY, favorites: ['sleep-descent'] });
    const { result } = await mountLibrary();
    expect(result.current.isFavorite('sleep-descent')).toBe(true);
  });

  describe('two toggles in the same tick', () => {
    // Same regression class as OnboardingContext: favourites are toggled fast,
    // in lists, so a stale read would silently drop one of two taps.
    it('keeps both when two different sessions are saved back to back', async () => {
      const { result } = await mountLibrary();

      await act(async () => {
        result.current.toggleFavorite('sleep-descent');
        result.current.toggleFavorite('focus-deep');
      });

      expect(result.current.favorites).toEqual(['sleep-descent', 'focus-deep']);
    });

    it('persists both, not just the last one', async () => {
      const { result } = await mountLibrary();

      await act(async () => {
        result.current.toggleFavorite('sleep-descent');
        result.current.toggleFavorite('focus-deep');
      });

      await waitFor(async () =>
        expect((await readStorage())?.favorites).toEqual(['sleep-descent', 'focus-deep'])
      );
    });

    it('cancels itself when the same session is toggled twice', async () => {
      const { result } = await mountLibrary();

      await act(async () => {
        result.current.toggleFavorite('sleep-descent');
        result.current.toggleFavorite('sleep-descent');
      });

      expect(result.current.favorites).toEqual([]);
    });
  });

  describe('practice log', () => {
    it('records a breathing exercise the same way as a session', async () => {
      const { result } = await mountLibrary();

      await act(async () => {
        await result.current.recordPractice({ patternId: 'four-seven-eight', seconds: 180 });
      });

      expect(result.current.practiceLog).toHaveLength(1);
      expect(result.current.practiceLog[0]).toMatchObject({
        patternId: 'four-seven-eight',
        seconds: 180,
      });
    });

    it('stamps the LOCAL calendar day, not UTC', async () => {
      const { result } = await mountLibrary();

      await act(async () => {
        await result.current.recordPractice({ seconds: 60 }, '2026-08-19');
      });

      expect(result.current.practiceLog[0].dateISO).toBe('2026-08-19');
      // A 23:40 practice must belong to that evening, not to the next day.
      expect(result.current.practiceLog[0].dateISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('keeps entries in order and does not overwrite earlier ones', async () => {
      const { result } = await mountLibrary();

      await act(async () => {
        await result.current.recordPractice({ seconds: 60 }, '2026-08-18');
      });
      await act(async () => {
        await result.current.recordPractice({ seconds: 120 }, '2026-08-19');
      });

      expect(result.current.practiceLog.map((entry) => entry.seconds)).toEqual([60, 120]);
    });

    it('caps the log so it cannot grow without bound', async () => {
      const { result } = await mountLibrary();

      await act(async () => {
        for (let index = 0; index < 405; index += 1) {
          await result.current.recordPractice({ seconds: index }, '2026-08-19');
        }
      });

      expect(result.current.practiceLog).toHaveLength(400);
      // The oldest entries are the ones dropped.
      expect(result.current.practiceLog[0].seconds).toBe(5);
    });
  });

  describe('progress', () => {
    it('records a position without counting a completion', async () => {
      const { result } = await mountLibrary();

      await act(async () => {
        await result.current.recordProgress('sleep-descent', 120);
      });

      expect(result.current.progress['sleep-descent']).toMatchObject({
        positionSec: 120,
        completedCount: 0,
      });
    });

    it('counts completions cumulatively', async () => {
      const { result } = await mountLibrary();

      await act(async () => {
        await result.current.recordProgress('sleep-descent', 600, true);
      });
      await act(async () => {
        await result.current.recordProgress('sleep-descent', 600, true);
      });

      expect(result.current.progress['sleep-descent'].completedCount).toBe(2);
    });

    it('survives state written by an older build', async () => {
      await seedStorage({ favorites: ['sleep-descent'] });
      const { result } = await mountLibrary();

      expect(result.current.progress).toEqual({});
      expect(result.current.favorites).toEqual(['sleep-descent']);
    });
  });
});

describe('library persistence recovery', () => {
  it('retains unread storage and retries hydration before allowing writes', async () => {
    const saved = { ...INITIAL_LIBRARY, favorites: ['sleep-descent'] };
    await seedStorage(saved);
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('read failed'));
    const view = renderHook(() => useLibrary(), { wrapper: LibraryProvider });
    await waitFor(() => expect(view.result.current.persistenceError).not.toBeNull());
    expect(view.result.current.loaded).toBe(false);
    await act(async () => { await view.result.current.toggleFavorite('other'); });
    expect(await readStorage()).toEqual(saved);
    await act(async () => { await view.result.current.retryPersistence(); });
    expect(view.result.current.loaded).toBe(true);
    expect(view.result.current.favorites).toEqual(['sleep-descent']);
  });

  it('retries an identical failed position without counting another completion or updating its timestamp', async () => {
    const view = await mountLibrary();
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk'));
    await act(async () => { await view.result.current.recordProgress('sleep-descent', 30); });
    const before = view.result.current.progress;
    expect(view.result.current.persistenceError).not.toBeNull();
    await act(async () => { await view.result.current.recordProgress('sleep-descent', 30); });
    expect(view.result.current.progress).toBe(before);
    expect(view.result.current.persistenceError).toBeNull();
    view.unmount();
    const restored = await mountLibrary();
    expect(restored.result.current.progress).toEqual(before);
  });
});

it('keeps metadata and command subscriptions stable during progress ticks', async () => {
  const view = renderHook(() => ({ library: useLibrary(), metadata: useLibraryMetadata(), commands: useLibraryCommands() }), { wrapper: LibraryProvider });
  await waitFor(() => expect(view.result.current.library.loaded).toBe(true));
  const metadata = view.result.current.metadata;
  const commands = view.result.current.commands;
  await act(async () => { await commands.recordProgress('sleep-descent', 5); });
  expect(view.result.current.metadata).toBe(metadata);
  expect(view.result.current.commands).toBe(commands);
  expect(view.result.current.library.progress['sleep-descent'].positionSec).toBe(5);
});
