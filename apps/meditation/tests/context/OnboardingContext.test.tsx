import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { OnboardingProvider, useOnboarding } from '@/context/OnboardingContext';
import { INITIAL_ONBOARDING, type OnboardingState } from '@/lib/types';
import { StorageKey } from '@/services/storageService';

/** Seeds the device with whatever an earlier run — or an older build — left. */
const seedStorage = async (value: unknown) =>
  AsyncStorage.setItem(StorageKey.onboarding, JSON.stringify(value));

const readStorage = async (): Promise<OnboardingState | null> => {
  const raw = await AsyncStorage.getItem(StorageKey.onboarding);
  return raw === null ? null : (JSON.parse(raw) as OnboardingState);
};

/** Mounts the provider and waits for the stored state to be read. */
const mountOnboarding = async () => {
  const view = renderHook(() => useOnboarding(), { wrapper: OnboardingProvider });
  await waitFor(() => expect(view.result.current.loaded).toBe(true));

  return view;
};

describe('OnboardingProvider', () => {
  describe('two updates in the same tick', () => {
    // The regression this guards: `update` used to read React state, so two
    // taps before the next render both saw the pre-tap value and the first
    // selection was silently dropped. `stateRef` is what makes them add up.
    it('keeps both goals when two are selected back to back', async () => {
      const { result } = await mountOnboarding();

      await act(async () => {
        result.current.update((current) => ({ goals: [...current.goals, 'sleep'] }));
        result.current.update((current) => ({ goals: [...current.goals, 'stress'] }));
      });

      expect(result.current.state.goals).toEqual(['sleep', 'stress']);
    });

    it('persists both goals, not just the last one', async () => {
      const { result } = await mountOnboarding();

      await act(async () => {
        result.current.update((current) => ({ goals: [...current.goals, 'sleep'] }));
        result.current.update((current) => ({ goals: [...current.goals, 'stress'] }));
      });

      await expect(readStorage()).resolves.toMatchObject({ goals: ['sleep', 'stress'] });
    });

    it('adds one goal and drops another in the same tick', async () => {
      await seedStorage({ ...INITIAL_ONBOARDING, goals: ['sleep'] });
      const { result } = await mountOnboarding();

      await act(async () => {
        result.current.update((current) => ({ goals: [...current.goals, 'focus'] }));
        result.current.update((current) => ({
          goals: current.goals.filter((goal) => goal !== 'sleep'),
        }));
      });

      expect(result.current.state.goals).toEqual(['focus']);
    });

    it('does not lose an object patch dispatched alongside another', async () => {
      const { result } = await mountOnboarding();

      await act(async () => {
        result.current.update({ experience: 'regular' });
        result.current.update({ dailyIntentionMin: 15 });
      });

      expect(result.current.state).toMatchObject({
        experience: 'regular',
        dailyIntentionMin: 15,
      });
    });

    it('survives a whole step being answered in one tick', async () => {
      const { result } = await mountOnboarding();

      await act(async () => {
        result.current.update((current) => ({ goals: [...current.goals, 'sleep'] }));
        result.current.update((current) => ({ goals: [...current.goals, 'stress'] }));
        result.current.update((current) => ({ goals: [...current.goals, 'anxiety'] }));
        result.current.update({ experience: 'beginner' });
        result.current.update({ reminder: { enabled: true, hour: 22, minute: 0 } });
      });

      expect(result.current.state).toMatchObject({
        goals: ['sleep', 'stress', 'anxiety'],
        experience: 'beginner',
        reminder: { enabled: true, hour: 22, minute: 0 },
      });
    });
  });

  describe('restoring', () => {
    it('starts from the defaults on a fresh install', async () => {
      const { result } = await mountOnboarding();

      expect(result.current.state).toEqual(INITIAL_ONBOARDING);
    });

    it('restores the state written by an earlier session', async () => {
      const stored: OnboardingState = {
        completed: true,
        goals: ['sleep', 'gratitude'],
        experience: 'occasional',
        dailyIntentionMin: 20,
        reminder: { enabled: true, hour: 7, minute: 15 },
      };
      await seedStorage(stored);

      const { result } = await mountOnboarding();

      expect(result.current.state).toEqual(stored);
    });

    // State written by an older build is missing the keys added since; those
    // must come from the defaults instead of arriving as `undefined`.
    it('merges state from an older build over the defaults', async () => {
      await seedStorage({ completed: true, goals: ['focus'] });

      const { result } = await mountOnboarding();

      expect(result.current.state).toEqual({
        ...INITIAL_ONBOARDING,
        completed: true,
        goals: ['focus'],
      });
      expect(result.current.state.reminder).toEqual(INITIAL_ONBOARDING.reminder);
    });

    it('falls back to the defaults when the stored value is corrupt', async () => {
      // storageService warns in dev; the warning is the expected path here.
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      await AsyncStorage.setItem(StorageKey.onboarding, 'not json');

      const { result } = await mountOnboarding();

      expect(result.current.state).toEqual(INITIAL_ONBOARDING);
      expect(warn).toHaveBeenCalled();
    });

    it('reports `loaded` only once storage has been read', async () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper: OnboardingProvider });

      expect(result.current.loaded).toBe(false);

      await waitFor(() => expect(result.current.loaded).toBe(true));
    });

    it('keeps an update made on top of a restored state', async () => {
      await seedStorage({ ...INITIAL_ONBOARDING, goals: ['sleep'] });
      const { result } = await mountOnboarding();

      await act(async () => {
        await result.current.update((current) => ({ goals: [...current.goals, 'focus'] }));
      });

      expect(result.current.state.goals).toEqual(['sleep', 'focus']);
    });
  });

  describe('complete', () => {
    it('marks onboarding as completed without touching the answers', async () => {
      await seedStorage({ ...INITIAL_ONBOARDING, goals: ['sleep'], dailyIntentionMin: 10 });
      const { result } = await mountOnboarding();

      await act(async () => {
        await result.current.complete();
      });

      expect(result.current.state.completed).toBe(true);
      expect(result.current.state.goals).toEqual(['sleep']);
      await expect(readStorage()).resolves.toMatchObject({
        completed: true,
        goals: ['sleep'],
        dailyIntentionMin: 10,
      });
    });
  });

  describe('reset', () => {
    it('clears the answers and the completed flag', async () => {
      await seedStorage({
        completed: true,
        goals: ['sleep', 'stress'],
        experience: 'regular',
        dailyIntentionMin: 20,
        reminder: { enabled: true, hour: 7, minute: 15 },
      });
      const { result } = await mountOnboarding();

      await act(async () => {
        await result.current.reset();
      });

      expect(result.current.state).toEqual(INITIAL_ONBOARDING);
      await expect(readStorage()).resolves.toEqual(INITIAL_ONBOARDING);
    });

    it('lets a fresh run start over after a reset', async () => {
      const { result } = await mountOnboarding();

      await act(async () => {
        await result.current.update({ completed: true, goals: ['sleep'] });
        await result.current.reset();
        await result.current.update((current) => ({ goals: [...current.goals, 'focus'] }));
      });

      expect(result.current.state).toEqual({ ...INITIAL_ONBOARDING, goals: ['focus'] });
    });
  });

  describe('outside the provider', () => {
    it('hands back inert defaults rather than throwing', async () => {
      const { result } = renderHook(() => useOnboarding());

      expect(result.current.state).toEqual(INITIAL_ONBOARDING);
      expect(result.current.loaded).toBe(false);
      await expect(result.current.update({ goals: ['sleep'] })).resolves.toBeUndefined();
    });
  });
});
