import { mergeDreamSnapshot } from '../dreamSnapshotMerge';
import type { DreamAnalysis } from '../types';

const dream = (id: number, remoteId?: number): DreamAnalysis => ({
  id, remoteId, title: 'original', transcript: 'complete transcript', interpretation: '',
  shareableQuote: '', imageUrl: '', chatHistory: [], dreamType: 'Symbolic Dream',
});

describe('mergeDreamSnapshot', () => {
  it('keeps local edits, additions and deletions while accepting unrelated server changes', () => {
    const baseline = [dream(1, 11), dream(2, 12), dream(3, 13)];
    const local = [{ ...baseline[0], title: 'local edit' }, baseline[2], dream(4)];
    const remote = [...baseline.slice(0, 2), { ...baseline[2], title: 'server edit' }, dream(5, 15)];
    const result = mergeDreamSnapshot(baseline, local, remote);
    expect(result).toEqual(expect.arrayContaining([
      local[0], local[2], { ...baseline[2], title: 'server edit' }, remote[3],
    ]));
    expect(result).toHaveLength(4);
    expect(result.some((row) => row.remoteId === 12)).toBe(false);
  });

  it('does not collapse separate remote rows with the same timestamp identifier', () => {
    const first = dream(1, 11);
    const second = dream(1, 12);
    expect(mergeDreamSnapshot([first, second], [{ ...first, title: 'local' }, second], [first, second]))
      .toEqual(expect.arrayContaining([{ ...first, title: 'local' }, second]));
  });

  it('matches a local create to its receipt by client request identity', () => {
    const local = { ...dream(1), clientRequestId: 'stable' };
    expect(mergeDreamSnapshot([], [local], [{ ...local, id: 2, remoteId: 12 }])).toEqual([local]);
  });
});
