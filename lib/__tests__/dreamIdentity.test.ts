import { matchesDreamTarget, resolveDreamTarget } from '../dreamIdentity';
import { applyPendingMutations, removeDream, upsertDream } from '../dreamUtils';
import type { DreamAnalysis, DreamMutation } from '../types';
const first = { id: 100, remoteId: 1, clientRequestId: 'first', title: 'first' } as DreamAnalysis;
const second = { id: 100, remoteId: 2, clientRequestId: 'second', title: 'second' } as DreamAnalysis;
it('resolves strong identities and refuses ambiguous legacy timestamps', () => {
  expect(resolveDreamTarget([first, second], 100)).toBeUndefined();
  expect(resolveDreamTarget([first, second], second)).toBe(second);
  expect(matchesDreamTarget(first, { ...second, clientRequestId: 'first' })).toBe(false);
});
it('upserts and removes only one remote row when timestamps collide', () => {
  expect(upsertDream([first, second], { ...second, title: 'changed' })).toEqual([first, { ...second, title: 'changed' }]);
  expect(removeDream([first, second], second)).toEqual([first]);
  expect(removeDream([first, second], 100)).toEqual([first, second]);
});
it('applies only the selected durable tombstone', () => {
  const deletion = { operation: 'delete', status: 'pending', payload: { dreamId: 100, remoteId: 2, tombstone: second } } as DreamMutation;
  expect(applyPendingMutations([first, second], [deletion])).toEqual([first]);
});
