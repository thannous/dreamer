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
      expect(Object.keys(world.artwork).sort()).toEqual([
        'completion',
        'journey',
        'purchase',
        'trainer',
      ]);
      expect(world.artwork).toEqual(
        expect.objectContaining({
          journey: expect.anything(),
          trainer: expect.anything(),
          completion: expect.anything(),
          purchase: expect.anything(),
        })
      );
      expect(world.atmosphere.scrimOpacity).toBeGreaterThanOrEqual(0);
      expect(world.atmosphere.scrimOpacity).toBeLessThanOrEqual(1);
      expect(Number.isFinite(world.atmosphere.centreScrimOpacity)).toBe(true);
      expect(world.atmosphere.centreScrimOpacity).toBeGreaterThanOrEqual(0);
      expect(world.atmosphere.centreScrimOpacity).toBeLessThanOrEqual(1);
      expect(world.atmosphere.overlayOpacity).toBeGreaterThanOrEqual(0);
      expect(world.atmosphere.overlayOpacity).toBeLessThanOrEqual(1);
    }
  });

  it('exposes exactly three free and three one-time purchase worlds', () => {
    const free = WORLD_IDS.filter((id) => WORLD_BY_ID[id].access === 'free');
    const purchase = WORLD_IDS.filter((id) => WORLD_BY_ID[id].access === 'purchase');

    expect(free).toHaveLength(3);
    expect(purchase).toHaveLength(3);
    expect(free).toEqual(['constellation', 'dawn', 'forest']);
    expect(purchase).toEqual(['tide', 'sanctuary', 'cloud']);
  });

  it('accepts only registered ids and keeps the default registered', () => {
    expect(isWorldId(DEFAULT_WORLD_ID)).toBe(true);

    for (const id of WORLD_IDS) expect(isWorldId(id)).toBe(true);

    expect(isWorldId('')).toBe(false);
    expect(isWorldId('ocean')).toBe(false);
    expect(isWorldId(null)).toBe(false);
    expect(isWorldId('tide')).toBe(true);
    expect(isWorldId('sanctuary')).toBe(true);
    expect(isWorldId('cloud')).toBe(true);
  });
});
