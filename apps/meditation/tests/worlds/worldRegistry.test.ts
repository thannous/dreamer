import {
  DEFAULT_WORLD_ID,
  isWorldId,
  WORLD_BY_ID,
  WORLD_IDS,
} from '@/constants/worlds';

describe('meditation world registry', () => {
  it('exposes one complete entry for every public world id', () => {
    expect(Object.keys(WORLD_BY_ID).sort()).toEqual([...WORLD_IDS].sort());

    for (const id of WORLD_IDS) {
      const world = WORLD_BY_ID[id];

      expect(world.id).toBe(id);
      expect(world.nameKey).toBe(`world.${id}.name`);
      expect(world.descriptionKey).toBe(`world.${id}.description`);
      expect(world.thumbnail).toEqual(expect.anything());
      expect(Object.keys(world.artwork).sort()).toEqual(['completion', 'journey', 'trainer']);
      expect(world.artwork).toEqual(
        expect.objectContaining({
          journey: expect.anything(),
          trainer: expect.anything(),
          completion: expect.anything(),
        })
      );
      expect(world.atmosphere.scrimOpacity).toBeGreaterThanOrEqual(0);
      expect(world.atmosphere.scrimOpacity).toBeLessThanOrEqual(1);
      expect(world.atmosphere.overlayOpacity).toBeGreaterThanOrEqual(0);
      expect(world.atmosphere.overlayOpacity).toBeLessThanOrEqual(1);
    }
  });

  it('ships both a nocturnal and a luminous world without changing the contract', () => {
    expect(WORLD_IDS.map((id) => WORLD_BY_ID[id].appearance).sort()).toEqual([
      'dark',
      'light',
    ]);
  });

  it('accepts only registered ids and keeps the default registered', () => {
    expect(isWorldId(DEFAULT_WORLD_ID)).toBe(true);

    for (const id of WORLD_IDS) expect(isWorldId(id)).toBe(true);

    expect(isWorldId('')).toBe(false);
    expect(isWorldId('ocean')).toBe(false);
    expect(isWorldId(null)).toBe(false);
  });
});
