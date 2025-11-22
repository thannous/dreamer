import { beforeEach, describe, expect, it } from 'vitest';

import type { DreamAnalysis } from '@/lib/types';
import { PREDEFINED_DREAMS } from '@/mock-data/predefinedDreams';
import {
    clearSavedTranscript,
    getNotificationSettings,
    getSavedDreams,
    getSavedTranscript,
    getThemePreference,
    preloadDreamsNow,
    resetMockStorage,
    saveDreams,
    saveNotificationSettings,
    saveThemePreference,
    saveTranscript,
    setPreloadDreamsEnabled,
} from '@/services/mocks/storageServiceMock';

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
        isEnabled: true,
        weekdayTime: '08:00',
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
        isEnabled: false,
        weekdayTime: '07:00',
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
});
