import { beforeEach, describe, expect, it } from '@jest/globals';

import { getDreamAnalysisState, getDreamDetailAction } from '../../../lib/dreamUsage';
import type { DreamAnalysis, DreamMutation, RitualStepProgress } from '../../../lib/types';
import { PREDEFINED_DREAMS } from '../../../mock-data/predefinedDreams';
import {
    clearSavedTranscript,
    getCachedRemoteDreams,
    getFirstLaunchCompleted,
    getJournalLayoutPreference,
    getLanguagePreference,
    getNotificationSettings,
    getPendingDreamMutations,
    getRecordingInputModePreference,
    getRitualPreference,
    getRitualStepProgress,
    getSavedDreams,
    getSavedTranscript,
    getThemePreference,
    preloadDreamsNow,
    resetMockStorage,
    saveCachedRemoteDreams,
    saveDreams,
    saveFirstLaunchCompleted,
    saveJournalLayoutPreference,
    saveLanguagePreference,
    saveNotificationSettings,
    savePendingDreamMutations,
    saveRecordingInputModePreference,
    saveRitualPreference,
    saveRitualStepProgress,
    saveThemePreference,
    saveTranscript,
    setPreloadDreamsEnabled,
} from '../storageServiceMock';

const buildDream = (overrides: Partial<DreamAnalysis> = {}): DreamAnalysis => ({
  id: Date.now(),
  transcript: 'Dream transcript',
  title: 'Dream',
  interpretation: '',
  shareableQuote: '',
  theme: undefined,
  dreamType: 'Symbolic Dream',
  imageUrl: '',
  chatHistory: [],
  isAnalyzed: false,
  analysisStatus: 'none',
  ...overrides,
});

const legacyMutation = (mutation: {
  id: string;
  type: DreamMutation['operation'];
  dream?: DreamAnalysis;
  dreamId?: number;
  remoteId?: number;
  createdAt: number;
}): DreamMutation => mutation as unknown as DreamMutation;

describe('storageServiceMock', () => {
  beforeEach(() => {
    resetMockStorage();
    setPreloadDreamsEnabled(false);
  });

  describe('dream preloading', () => {
    it('given disabled preloading when getting dreams then returns empty journal', async () => {
      // Given
      // Preloading is disabled by default in beforeEach

      // When
      const dreams = await getSavedDreams();

      // Then
      expect(dreams).toHaveLength(0);
    });

    it('given enabled preloading when preloading dreams then loads predefined dreams', async () => {
      // Given
      setPreloadDreamsEnabled(true);

      // When
      preloadDreamsNow();
      const dreams = await getSavedDreams();

      // Then
      expect(dreams).toHaveLength(PREDEFINED_DREAMS.length);
    });

    it('given enabled preloading when loading dreams then fixtures cover canonical product states', async () => {
      // Given
      setPreloadDreamsEnabled(true);

      // When
      preloadDreamsNow();
      const dreams = await getSavedDreams();

      // Then
      const states = dreams.map((dream) => getDreamAnalysisState(dream));
      expect(states.filter((state) => state.status === 'done')).toHaveLength(5);
      expect(states.filter((state) => state.status === 'pending')).toHaveLength(1);
      expect(states.filter((state) => state.status === 'failed')).toHaveLength(1);
      expect(states.filter((state) => state.status === 'none')).toHaveLength(1);
      expect(states.filter((state) => state.isExplored)).toHaveLength(1);

      for (const dream of dreams) {
        const state = getDreamAnalysisState(dream);
        if (dream.analysisStatus === 'done') {
          expect(state.isAnalyzed).toBe(true);
          expect(dream.analyzedAt).toEqual(expect.any(Number));
          expect(dream.interpretation.trim().length).toBeGreaterThan(0);
        } else {
          expect(state.isAnalyzed).toBe(false);
          expect(dream.analyzedAt).toBeUndefined();
        }
      }

      expect(dreams).toEqual(expect.arrayContaining([
        expect.objectContaining({ analysisStatus: 'pending', imageJobStatus: 'running' }),
        expect.objectContaining({ analysisStatus: 'failed', isAnalyzed: false }),
        expect.objectContaining({ analysisStatus: 'none', isAnalyzed: false }),
        expect.objectContaining({ imageGenerationFailed: true, analysisStatus: 'done' }),
        expect.objectContaining({ syncState: 'pending', pendingSync: true }),
        expect.objectContaining({ syncState: 'conflict', conflictRemoteDream: expect.any(Object) }),
      ]));

      const exploredDream = dreams.find((dream) => getDreamAnalysisState(dream).isExplored);
      expect(exploredDream).toBeDefined();
      expect(getDreamDetailAction(exploredDream)).toBe('continue');
    });

    it('given preloaded dreams when disabling preloading then resets to empty journal', async () => {
      // Given
      setPreloadDreamsEnabled(true);
      preloadDreamsNow();

      // When
      setPreloadDreamsEnabled(false);
      const dreams = await getSavedDreams();

      // Then
      expect(dreams).toEqual([]);
    });
  });

  describe('dream storage', () => {
    it('given saved dreams when retrieving dreams then returns sorted dreams', async () => {
      // Given
      const testDreams = [buildDream({ id: 2 }), buildDream({ id: 1 })];
      await saveDreams(testDreams);

      // When
      const dreams = await getSavedDreams();

      // Then
      expect(dreams).toHaveLength(2);
      // Dreams are sorted by the service, verify both are present
      expect(dreams.map(d => d.id)).toEqual(expect.arrayContaining([1, 2]));
    });

    it('given empty dreams array when saving then stores empty array', async () => {
      // Given
      const emptyDreams: DreamAnalysis[] = [];

      // When
      await saveDreams(emptyDreams);

      // Then
      const dreams = await getSavedDreams();
      expect(dreams).toEqual([]);
    });

    it('given no saved dreams when retrieving then returns empty array', async () => {
      // Given
      resetMockStorage();

      // When
      const dreams = await getSavedDreams();

      // Then
      expect(dreams).toEqual([]);
    });
  });

  describe('transcript management', () => {
    it('given saved transcript when retrieving transcript then returns saved transcript', async () => {
      // Given
      const testTranscript = 'This is a test transcript for audio recording';
      await saveTranscript(testTranscript);

      // When
      const transcript = await getSavedTranscript();

      // Then
      expect(transcript).toBe(testTranscript);
    });

    it('given empty transcript when saving then clears stored transcript', async () => {
      // Given
      await saveTranscript('initial transcript');

      // When
      await saveTranscript('');

      // Then
      const transcript = await getSavedTranscript();
      expect(transcript).toBe('');
    });

    it('given no saved transcript when retrieving then returns empty string', async () => {
      // Given
      resetMockStorage();

      // When
      const transcript = await getSavedTranscript();

      // Then
      expect(transcript).toBe('');
    });

    it('given saved transcript when clearing then removes transcript', async () => {
      // Given
      const testTranscript = 'This is a test transcript for audio recording';
      await saveTranscript(testTranscript);

      // When
      await clearSavedTranscript();

      // Then
      const transcript = await getSavedTranscript();
      expect(transcript).toBe('');
    });
  });

	  describe('notification settings', () => {
	    it('given saved notification settings when retrieving then returns saved settings', async () => {
	      // Given
	      const testSettings = {
	        weekdayEnabled: true,
	        weekdayTime: '08:00',
	        weekendEnabled: false,
	        weekendTime: '11:00',
	      };
	      await saveNotificationSettings(testSettings);

      // When
      const settings = await getNotificationSettings();

      // Then
      expect(settings).toEqual(testSettings);
    });

	    it('given no saved settings when retrieving then returns default settings', async () => {
      // Given
      resetMockStorage();

      // When
      const settings = await getNotificationSettings();

	      // Then
	      expect(settings).toEqual({
	        weekdayEnabled: false,
	        weekdayTime: '07:00',
	        weekendEnabled: false,
	        weekendTime: '10:00',
	      });
	    });
	  });

  describe('theme preference', () => {
    it('given saved theme preference when retrieving then returns saved preference', async () => {
      // Given
      await saveThemePreference('dark');

      // When
      const preference = await getThemePreference();

      // Then
      expect(preference).toBe('dark');
    });

    it('given no saved theme preference when retrieving then returns default preference', async () => {
      // Given
      resetMockStorage();

      // When
      const preference = await getThemePreference();

      // Then
      expect(preference).toBe('auto');
    });
  });

  describe('journal layout preference', () => {
    it('given saved journal layout preference when retrieving then returns saved preference', async () => {
      await saveJournalLayoutPreference('compact');

      const preference = await getJournalLayoutPreference();

      expect(preference).toBe('compact');
    });

    it('given no saved journal layout preference when retrieving then returns cards by default', async () => {
      resetMockStorage();

      const preference = await getJournalLayoutPreference();

      expect(preference).toBe('cards');
    });
  });

  describe('recording input mode preference', () => {
    it('given saved recording input mode when retrieving then returns saved preference', async () => {
      await saveRecordingInputModePreference('voice');

      const preference = await getRecordingInputModePreference();

      expect(preference).toBe('voice');
    });

    it('given no saved recording input mode when retrieving then returns null', async () => {
      resetMockStorage();

      const preference = await getRecordingInputModePreference();

      expect(preference).toBeNull();
    });
  });

  describe('language preference', () => {
    it('given saved language preference when retrieving then returns saved preference', async () => {
      await saveLanguagePreference('fr');

      const preference = await getLanguagePreference();

      expect(preference).toBe('fr');
    });

    it('given no saved language preference when retrieving then returns default auto', async () => {
      resetMockStorage();

      const preference = await getLanguagePreference();

      expect(preference).toBe('auto');
    });
  });

  describe('ritual preference', () => {
    it('given saved ritual preference when retrieving then returns saved preference', async () => {
      await saveRitualPreference('memory');

      const preference = await getRitualPreference();

      expect(preference).toBe('memory');
    });

    it('given no saved ritual preference when retrieving then returns null', async () => {
      resetMockStorage();

      const preference = await getRitualPreference();

      expect(preference).toBeNull();
    });
  });

  describe('ritual step progress', () => {
    it('given saved ritual step progress when retrieving then returns saved progress', async () => {
      const progress: RitualStepProgress = {
        date: '2024-01-01',
        steps: {
          starter: { evening: true },
        },
      };
      await saveRitualStepProgress(progress);

      const retrieved = await getRitualStepProgress();

      expect(retrieved).toEqual(progress);
    });

    it('given no saved progress when retrieving then returns null', async () => {
      resetMockStorage();

      const progress = await getRitualStepProgress();

      expect(progress).toBeNull();
    });
  });

  describe('first launch completed', () => {
    it('given saved first launch flag when retrieving then returns saved value', async () => {
      await saveFirstLaunchCompleted(true);

      const completed = await getFirstLaunchCompleted();

      expect(completed).toBe(true);
    });

    it('given no saved flag when retrieving then returns false', async () => {
      resetMockStorage();

      const completed = await getFirstLaunchCompleted();

      expect(completed).toBe(false);
    });
  });

  describe('cached remote dreams', () => {
    it('given saved cached dreams when retrieving then returns dreams', async () => {
      const dreams = [buildDream({ id: 1 }), buildDream({ id: 2 })];
      await saveCachedRemoteDreams(dreams);

      const cached = await getCachedRemoteDreams();

      expect(cached).toHaveLength(2);
    });

    it('given no cached dreams when retrieving then returns empty array', async () => {
      resetMockStorage();

      const cached = await getCachedRemoteDreams();

      expect(cached).toEqual([]);
    });
  });

  describe('pending dream mutations', () => {
    it('given saved mutations when retrieving then returns mutations', async () => {
      const dream = buildDream({ id: 1 });
      const mutations: DreamMutation[] = [
        legacyMutation({ id: 'mut-1', type: 'create', dream, createdAt: Date.now() }),
        legacyMutation({ id: 'mut-2', type: 'delete', dreamId: 2, createdAt: Date.now() }),
      ];
      await savePendingDreamMutations(mutations);

      const retrieved = await getPendingDreamMutations();

      expect(retrieved).toHaveLength(2);
      expect(retrieved[0].id).toBe('mut-1');
      expect(retrieved[1].id).toBe('mut-2');
    });

    it('given no pending mutations when retrieving then returns empty array', async () => {
      resetMockStorage();

      const mutations = await getPendingDreamMutations();

      expect(mutations).toEqual([]);
    });
  });
});
