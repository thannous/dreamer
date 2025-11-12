import { beforeEach, describe, expect, it } from 'vitest';

import {
  getSavedDreams,
  preloadDreamsNow,
  resetMockStorage,
  setPreloadDreamsEnabled,
} from '@/services/mocks/storageServiceMock';
import { PREDEFINED_DREAMS } from '@/mock-data/predefinedDreams';

describe('storageServiceMock dream preloading', () => {
  beforeEach(() => {
    resetMockStorage();
    setPreloadDreamsEnabled(false);
  });

  it('returns an empty journal by default when preloading is disabled', async () => {
    const dreams = await getSavedDreams();
    expect(dreams).toHaveLength(0);
  });

  it('loads predefined dreams only when preloading is enabled', async () => {
    setPreloadDreamsEnabled(true);
    preloadDreamsNow();

    const dreams = await getSavedDreams();
    expect(dreams).toHaveLength(PREDEFINED_DREAMS.length);
  });

  it('resets back to an empty journal after disabling preloading again', async () => {
    setPreloadDreamsEnabled(true);
    preloadDreamsNow();
    await getSavedDreams();

    setPreloadDreamsEnabled(false);
    resetMockStorage();

    const dreams = await getSavedDreams();
    expect(dreams).toHaveLength(0);
  });
});
