import { WORLD_SOUND_BY_ID } from '@/content/worldSounds';
import { WORLD_IDS } from '@/constants/worlds';

describe('world sound personalities', () => {
  it('defines a restrained local profile for every world', () => {
    expect(Object.keys(WORLD_SOUND_BY_ID)).toEqual(expect.arrayContaining([...WORLD_IDS]));

    WORLD_IDS.forEach((worldId) => {
      const profile = WORLD_SOUND_BY_ID[worldId];
      expect(profile.primary.volume).toBeGreaterThan(0);
      expect(profile.primary.volume).toBeLessThanOrEqual(0.3);
      if (profile.secondary) expect(profile.secondary.volume).toBeLessThanOrEqual(0.3);
      expect(profile.cueVolume).toBeLessThanOrEqual(0.3);
    });
  });

});
