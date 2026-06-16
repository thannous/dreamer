import { describe, expect, it, jest } from '@jest/globals';

import type { DreamAnalysis, DreamMutation } from '../types';
import {
  sortDreams,
  generateMutationId,
  generateUUID,
  isNotFoundError,
  normalizeDreamImages,
  normalizeDreamMemoryMetadata,
  normalizeDreamList,
  upsertDream,
  removeDream,
  hasPendingMutationsForDream,
  applyPendingMutations,
  resolveDreamListUpdater,
  areDreamMemoryMetadataEqual,
  areDreamsEqualForLocalState,
  buildRememberedDream,
} from '../dreamUtils';

// Mock imageUtils
jest.mock('../imageUtils', () => ({
  getThumbnailUrl: jest.fn((url: string) => url ? `${url}?thumb` : undefined),
}));

const buildDream = (overrides: Partial<DreamAnalysis> = {}): DreamAnalysis => ({
  id: Date.now(),
  transcript: 'Test dream',
  title: 'Test Title',
  interpretation: 'Test interpretation',
  shareableQuote: 'Test quote',
  imageUrl: '',
  chatHistory: [],
  dreamType: 'Symbolic Dream',
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

describe('dreamUtils', () => {
  describe('sortDreams', () => {
    it('given unsorted dreams when sorting then returns descending by id', () => {
      const dreams = [
        buildDream({ id: 100 }),
        buildDream({ id: 300 }),
        buildDream({ id: 200 }),
      ];

      const result = sortDreams(dreams);

      expect(result.map((d) => d.id)).toEqual([300, 200, 100]);
    });

    it('given empty array when sorting then returns empty array', () => {
      expect(sortDreams([])).toEqual([]);
    });

    it('given single dream when sorting then returns same dream', () => {
      const dreams = [buildDream({ id: 123 })];
      const result = sortDreams(dreams);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(123);
    });

    it('does not mutate original array', () => {
      const original = [buildDream({ id: 1 }), buildDream({ id: 2 })];
      const copy = [...original];
      sortDreams(original);
      expect(original).toEqual(copy);
    });
  });

  describe('generateMutationId', () => {
    it('generates unique ids', () => {
      const id1 = generateMutationId();
      const id2 = generateMutationId();
      expect(id1).not.toBe(id2);
    });

    it('generates string id with timestamp prefix', () => {
      const before = Date.now();
      const id = generateMutationId();
      const after = Date.now();

      const timestamp = parseInt(id.split('-')[0], 10);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('generateUUID', () => {
    it('generates valid UUID v4 format', () => {
      const uuid = generateUUID();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuid).toMatch(uuidRegex);
    });

    it('generates unique UUIDs', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('isNotFoundError', () => {
    it('given NOT_FOUND code when checking then returns true', () => {
      const error = { code: 'NOT_FOUND' };
      expect(isNotFoundError(error)).toBe(true);
    });

    it('given different code when checking then returns false', () => {
      const error = { code: 'OTHER_ERROR' };
      expect(isNotFoundError(error)).toBe(false);
    });

    it('given null when checking then returns false', () => {
      expect(isNotFoundError(null)).toBe(false);
    });

    it('given undefined when checking then returns false', () => {
      expect(isNotFoundError(undefined)).toBe(false);
    });

    it('given non-object when checking then returns false', () => {
      expect(isNotFoundError('NOT_FOUND')).toBe(false);
    });

    it('given object without code when checking then returns false', () => {
      expect(isNotFoundError({ message: 'Not found' })).toBe(false);
    });
  });

  describe('normalizeDreamImages', () => {
    it('given dream with imageUrl when normalizing then derives thumbnail', () => {
      const dream = buildDream({ imageUrl: 'https://example.com/image.jpg' });
      const result = normalizeDreamImages(dream);

      expect(result.thumbnailUrl).toBe('https://example.com/image.jpg?thumb');
      expect(result.imageGenerationFailed).toBe(false);
    });

    it('given dream without imageUrl when normalizing then clears thumbnail', () => {
      const dream = buildDream({ imageUrl: '', thumbnailUrl: 'old-thumb' });
      const result = normalizeDreamImages(dream);

      expect(result.thumbnailUrl).toBeUndefined();
    });

    it('given dream with failed image when normalizing then preserves failed flag', () => {
      const dream = buildDream({ imageUrl: '', imageGenerationFailed: true });
      const result = normalizeDreamImages(dream);

      expect(result.imageGenerationFailed).toBe(true);
    });

    it('given dream with whitespace imageUrl when normalizing then treats as empty', () => {
      const dream = buildDream({ imageUrl: '   ' });
      const result = normalizeDreamImages(dream);

      expect(result.thumbnailUrl).toBeUndefined();
    });

    it('given normalized dream when normalizing again then returns same object reference', () => {
      const dream = buildDream({
        imageUrl: 'https://example.com/img.jpg',
        thumbnailUrl: 'https://example.com/img.jpg?thumb',
        imageGenerationFailed: false,
      });
      const result = normalizeDreamImages(dream);

      expect(result).toBe(dream);
    });

    it('given dream needing no changes when normalizing then returns same object reference', () => {
      const dream = buildDream({ imageUrl: '', thumbnailUrl: undefined });
      const result = normalizeDreamImages(dream);

      expect(result).toBe(dream);
    });
  });

  describe('normalizeDreamList', () => {
    it('given list of dreams when normalizing then normalizes all', () => {
      const dreams = [
        buildDream({ id: 1, imageUrl: 'https://example.com/1.jpg' }),
        buildDream({ id: 2, imageUrl: 'https://example.com/2.jpg' }),
      ];

      const result = normalizeDreamList(dreams);

      expect(result).toHaveLength(2);
      expect(result[0].thumbnailUrl).toBe('https://example.com/1.jpg?thumb');
      expect(result[1].thumbnailUrl).toBe('https://example.com/2.jpg?thumb');
    });

    it('given empty list when normalizing then returns empty list', () => {
      expect(normalizeDreamList([])).toEqual([]);
    });

    it('given list with no changes needed when normalizing then returns same array reference', () => {
      const dreams = [
        buildDream({ imageUrl: '', thumbnailUrl: undefined }),
      ];
      const result = normalizeDreamList(dreams);

      expect(result).toBe(dreams);
    });

    it('given list with changes needed when normalizing then returns new array', () => {
      const dreams = [
        buildDream({ imageUrl: 'https://example.com/img.jpg', thumbnailUrl: undefined }),
      ];
      const result = normalizeDreamList(dreams);

      expect(result).not.toBe(dreams);
      expect(result[0].thumbnailUrl).toBeDefined();
    });
  });

  describe('dream memory metadata', () => {
    it('given unknown persisted metadata when normalizing then keeps only supported fields', () => {
      const result = normalizeDreamMemoryMetadata({
        origin: 'remembered',
        anchorDream: true,
        dejaVu: true,
        recurring: true,
        rememberedKind: 'recurring',
        approximatePeriod: 'childhood',
        strongestFragment: 'place',
        lingeringEmotion: '  wonder  ',
        recurrenceNote: '  Same hallway  ',
        createdFrom: 'profile',
        createdFromOnboarding: true,
        ignored: 'value',
      } as any);

      expect(result).toEqual({
        version: 1,
        origin: 'remembered',
        anchorDream: true,
        dejaVu: true,
        recurring: true,
        rememberedKind: 'recurring',
        approximatePeriod: 'childhood',
        strongestFragment: 'place',
        lingeringEmotion: 'wonder',
        recurrenceNote: 'Same hallway',
        createdFrom: 'profile',
      });
    });

    it('given captured metadata without remembered signals when normalizing then returns undefined', () => {
      expect(normalizeDreamMemoryMetadata({ origin: 'captured' })).toBeUndefined();
    });

    it('keeps legacy onboarding flag when no createdFrom source is present', () => {
      expect(
        normalizeDreamMemoryMetadata({
          origin: 'remembered',
          createdFromOnboarding: true,
        })
      ).toMatchObject({
        origin: 'remembered',
        createdFromOnboarding: true,
      });
    });

    it('compares normalized memory metadata instead of raw object identity', () => {
      expect(
        areDreamMemoryMetadataEqual(
          { origin: 'remembered', rememberedKind: 'recurring' },
          { version: 1, origin: 'remembered', rememberedKind: 'recurring', recurring: true }
        )
      ).toBe(true);
    });

    it('given memory changes when comparing local dreams then returns false', () => {
      const base = buildDream({ id: 1 });
      const remembered = buildDream({
        id: 1,
        memory: {
          origin: 'remembered',
          anchorDream: true,
          rememberedKind: 'old',
        },
      });

      expect(areDreamsEqualForLocalState(base, remembered)).toBe(false);
    });
  });

  describe('buildRememberedDream', () => {
    it('builds an anchor dream that remains a normal dream entry', () => {
      const dream = buildRememberedDream('I still remember the blue house.', {
        defaultTitle: 'Souvenir de rêve',
        rememberedKind: 'old',
        approximatePeriod: 'childhood',
        strongestFragment: 'place',
        lingeringEmotion: 'nostalgia',
        createdFromOnboarding: true,
        now: () => 123,
      });

      expect(dream.id).toBe(123);
      expect(dream.title).toBe('I still remember the blue house.');
      expect(dream.dreamType).toBe('Symbolic Dream');
      expect(dream.isAnalyzed).toBe(false);
      expect(dream.memory).toEqual({
        version: 1,
        origin: 'remembered',
        anchorDream: true,
        dejaVu: true,
        rememberedKind: 'old',
        approximatePeriod: 'childhood',
        strongestFragment: 'place',
        lingeringEmotion: 'nostalgia',
        createdFrom: 'onboarding',
        createdFromOnboarding: true,
      });
    });

    it('defaults route-created remembered dreams to journal source', () => {
      const dream = buildRememberedDream('The old garden came back.', {
        defaultTitle: 'Dream memory',
        rememberedKind: 'old',
      });

      expect(dream.memory).toMatchObject({
        origin: 'remembered',
        createdFrom: 'journal',
      });
      expect(dream.memory?.createdFromOnboarding).toBeUndefined();
    });

    it('keeps profile-created remembered dreams out of onboarding cohorts', () => {
      const dream = buildRememberedDream('A recurring staircase.', {
        defaultTitle: 'Dream memory',
        rememberedKind: 'recurring',
        createdFrom: 'profile',
        createdFromOnboarding: true,
      });

      expect(dream.memory).toMatchObject({
        origin: 'remembered',
        recurring: true,
        createdFrom: 'profile',
      });
      expect(dream.memory?.createdFromOnboarding).toBeUndefined();
    });

    it('maps remembered recurring, nightmare and lucid dreams to canonical dream types', () => {
      expect(buildRememberedDream('Again', { defaultTitle: 'Dream', rememberedKind: 'recurring' }).dreamType).toBe('Recurring Dream');
      expect(buildRememberedDream('Fear', { defaultTitle: 'Dream', rememberedKind: 'nightmare' }).dreamType).toBe('Nightmare');
      expect(buildRememberedDream('Aware', { defaultTitle: 'Dream', rememberedKind: 'lucid' }).dreamType).toBe('Lucid Dream');
    });
  });

  describe('upsertDream', () => {
    it('given new dream when upserting then prepends to list', () => {
      const existing = [buildDream({ id: 1 }), buildDream({ id: 2 })];
      const newDream = buildDream({ id: 3 });

      const result = upsertDream(existing, newDream);

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe(3);
    });

    it('given existing dream id when upserting then updates in place', () => {
      const existing = [
        buildDream({ id: 1, title: 'Original' }),
        buildDream({ id: 2 }),
      ];
      const updated = buildDream({ id: 1, title: 'Updated' });

      const result = upsertDream(existing, updated);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Updated');
    });

    it('given matching remoteId when upserting then updates by remoteId', () => {
      const existing = [
        buildDream({ id: 1, remoteId: 100, title: 'Original' }),
        buildDream({ id: 2 }),
      ];
      const updated = buildDream({ id: 999, remoteId: 100, title: 'Updated' });

      const result = upsertDream(existing, updated);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Updated');
    });

    it('given empty list when upserting then returns single item', () => {
      const dream = buildDream({ id: 1 });
      const result = upsertDream([], dream);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(dream);
    });
  });

  describe('removeDream', () => {
    it('given matching id when removing then removes dream', () => {
      const dreams = [
        buildDream({ id: 1 }),
        buildDream({ id: 2 }),
        buildDream({ id: 3 }),
      ];

      const result = removeDream(dreams, 2);

      expect(result).toHaveLength(2);
      expect(result.map((d) => d.id)).toEqual([1, 3]);
    });

    it('given matching remoteId when removing then removes dream', () => {
      const dreams = [
        buildDream({ id: 1, remoteId: 100 }),
        buildDream({ id: 2 }),
      ];

      const result = removeDream(dreams, 999, 100);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    it('given non-matching id when removing then returns unchanged list', () => {
      const dreams = [buildDream({ id: 1 }), buildDream({ id: 2 })];
      const result = removeDream(dreams, 999);

      expect(result).toHaveLength(2);
    });

    it('given empty list when removing then returns empty list', () => {
      expect(removeDream([], 1)).toEqual([]);
    });
  });

  describe('hasPendingMutationsForDream', () => {
    it('given create mutation for dream when checking then returns true', () => {
      const mutations: DreamMutation[] = [
        legacyMutation({ id: 'm1', type: 'create', dream: buildDream({ id: 123 }), createdAt: Date.now() }),
      ];

      expect(hasPendingMutationsForDream(mutations, 123)).toBe(true);
    });

    it('given update mutation for dream when checking then returns true', () => {
      const mutations: DreamMutation[] = [
        legacyMutation({ id: 'm1', type: 'update', dream: buildDream({ id: 456 }), createdAt: Date.now() }),
      ];

      expect(hasPendingMutationsForDream(mutations, 456)).toBe(true);
    });

    it('given delete mutation for dream when checking then returns true', () => {
      const mutations: DreamMutation[] = [
        legacyMutation({ id: 'm1', type: 'delete', dreamId: 789, createdAt: Date.now() }),
      ];

      expect(hasPendingMutationsForDream(mutations, 789)).toBe(true);
    });

    it('given no mutations for dream when checking then returns false', () => {
      const mutations: DreamMutation[] = [
        legacyMutation({ id: 'm1', type: 'create', dream: buildDream({ id: 100 }), createdAt: Date.now() }),
      ];

      expect(hasPendingMutationsForDream(mutations, 999)).toBe(false);
    });

    it('given empty mutations when checking then returns false', () => {
      expect(hasPendingMutationsForDream([], 123)).toBe(false);
    });
  });

  describe('applyPendingMutations', () => {
    it('given create mutation when applying then adds dream', () => {
      const source = [buildDream({ id: 1 })];
      const newDream = buildDream({ id: 2 });
      const mutations: DreamMutation[] = [
        legacyMutation({ id: 'm1', type: 'create', dream: newDream, createdAt: Date.now() }),
      ];

      const result = applyPendingMutations(source, mutations);

      expect(result).toHaveLength(2);
      expect(result.map((d) => d.id)).toEqual([2, 1]); // Sorted descending
    });

    it('given update mutation when applying then updates dream', () => {
      const source = [buildDream({ id: 1, title: 'Original' })];
      const mutations: DreamMutation[] = [
        legacyMutation({ id: 'm1', type: 'update', dream: buildDream({ id: 1, title: 'Updated' }), createdAt: Date.now() }),
      ];

      const result = applyPendingMutations(source, mutations);

      expect(result[0].title).toBe('Updated');
    });

    it('given delete mutation when applying then removes dream', () => {
      const source = [buildDream({ id: 1 }), buildDream({ id: 2 })];
      const mutations: DreamMutation[] = [
        legacyMutation({ id: 'm1', type: 'delete', dreamId: 1, createdAt: Date.now() }),
      ];

      const result = applyPendingMutations(source, mutations);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    it('given empty mutations when applying then returns sorted source', () => {
      const source = [buildDream({ id: 1 }), buildDream({ id: 3 }), buildDream({ id: 2 })];
      const result = applyPendingMutations(source, []);

      expect(result.map((d) => d.id)).toEqual([3, 2, 1]);
    });

    it('given multiple mutations when applying then applies in order', () => {
      const source: DreamAnalysis[] = [];
      const mutations: DreamMutation[] = [
        legacyMutation({ id: 'm1', type: 'create', dream: buildDream({ id: 1 }), createdAt: 1 }),
        legacyMutation({ id: 'm2', type: 'create', dream: buildDream({ id: 2 }), createdAt: 2 }),
        legacyMutation({ id: 'm3', type: 'delete', dreamId: 1, createdAt: 3 }),
      ];

      const result = applyPendingMutations(source, mutations);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });
  });

  describe('resolveDreamListUpdater', () => {
    it('given array updater when resolving then returns array', () => {
      const newList = [buildDream({ id: 1 })];
      const current = [buildDream({ id: 2 })];

      const result = resolveDreamListUpdater(newList, current);

      expect(result).toBe(newList);
    });

    it('given function updater when resolving then calls with current', () => {
      const current = [buildDream({ id: 1 })];
      const updater = (list: DreamAnalysis[]) => [...list, buildDream({ id: 2 })];

      const result = resolveDreamListUpdater(updater, current);

      expect(result).toHaveLength(2);
    });
  });
});
