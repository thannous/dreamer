import { describe, expect, it } from 'vitest';

import {
  LUCID_DREAM_ATLAS_MAX_NODES,
  buildLucidDreamAtlas,
  deleteLucidDreamAtlasNode,
  hideLucidDreamAtlasNode,
  listLucidDreamAtlasNodes,
  mergeLucidDreamAtlasNodes,
  rebuildLucidDreamAtlasAfterDreamDeleted,
  renameLucidDreamAtlasNode,
} from '../../lib/lucid/dreamAtlas';
import type { LucidReconciledDreamSign } from '../../lib/lucid/dreamSigns';

const SIGN_COUNT = 180;
const DREAM_COUNT = 1_200;
const SOURCES_PER_SIGN = 8;
const RUNS = 8;
const WARMUP_RUNS = 2;
const MAX_AVG_MS = 400;
const NOW = Date.UTC(2026, 7, 28, 10, 0, 0);
const CATEGORIES = ['person', 'object', 'place', 'anomaly', 'emotion', 'action'] as const;

const dreams = Array.from({ length: DREAM_COUNT }, (_, index) => ({
  id: NOW - index * 60_000,
}));

const signs: LucidReconciledDreamSign[] = Array.from({ length: SIGN_COUNT }, (_, index) => {
  const sourceDreamIds = Array.from({ length: SOURCES_PER_SIGN }, (__, sourceIndex) =>
    String(dreams[(index * 3 + sourceIndex * 11) % DREAM_COUNT].id)
  );
  const confirmed = index % 11 !== 0;
  return {
    id: `sign:node${index}`,
    label: `Sign ${index}`,
    category: CATEGORIES[index % CATEGORIES.length],
    distinctDreamCount: sourceDreamIds.length,
    sourceDreamIds,
    evidence: [],
    decision: confirmed ? 'confirmed' : 'pending',
    displayLabel: `Sign ${index}`,
  };
});

const preferences = {
  version: 1 as const,
  renamed: Object.fromEntries(
    Array.from({ length: 18 }, (_, index) => [`sign:node${index * 7}`, `Renamed ${index * 7}`])
  ),
  hidden: Array.from({ length: 12 }, (_, index) => `sign:node${index * 13}`),
  merges: Object.fromEntries(
    Array.from({ length: 20 }, (_, index) => [`sign:node${index * 2 + 1}`, `sign:node${index * 2}`])
  ),
  deleted: ['sign:node4', 'sign:node88'],
};

const getNow = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

function runAtlasPass() {
  const snapshot = buildLucidDreamAtlas({ signs, dreams, preferences });
  const listed = listLucidDreamAtlasNodes(snapshot);
  const remainingDreams = dreams.slice(1);
  const rebuilt = rebuildLucidDreamAtlasAfterDreamDeleted(snapshot, signs, remainingDreams);
  const renamed = renameLucidDreamAtlasNode(
    rebuilt,
    listed[0]?.id ?? 'sign:node0',
    'Atlas node',
    signs,
    remainingDreams
  );
  const hidden = hideLucidDreamAtlasNode(
    renamed,
    listed[1]?.id ?? 'sign:node2',
    true,
    signs,
    remainingDreams
  );
  const merged = mergeLucidDreamAtlasNodes(
    hidden,
    listed[2]?.id ?? 'sign:node6',
    listed[3]?.id ?? 'sign:node8',
    signs,
    remainingDreams
  );
  return deleteLucidDreamAtlasNode(
    merged,
    listed[4]?.id ?? 'sign:node10',
    signs,
    remainingDreams
  );
}

describe('perf(lucidDreamAtlas)', () => {
  it('keeps a bounded confirmed corpus under an algorithmic regression budget', () => {
    const sample = runAtlasPass();
    expect(sample.nodes.length).toBeGreaterThan(20);
    expect(sample.nodes.length).toBeLessThanOrEqual(LUCID_DREAM_ATLAS_MAX_NODES);
    expect(listLucidDreamAtlasNodes(sample).length).toBeGreaterThan(0);

    for (let index = 0; index < WARMUP_RUNS; index += 1) {
      runAtlasPass();
    }

    const start = getNow();
    for (let index = 0; index < RUNS; index += 1) {
      runAtlasPass();
    }
    const avgMs = (getNow() - start) / RUNS;

    console.log(
      `[perf] lucidDreamAtlas avg ${avgMs.toFixed(2)}ms over ${RUNS} runs (signs=${SIGN_COUNT}, dreams=${DREAM_COUNT}, sources/sign=${SOURCES_PER_SIGN})`
    );
    expect(avgMs).toBeGreaterThan(0);
    expect(avgMs).toBeLessThan(MAX_AVG_MS);
  });
});
