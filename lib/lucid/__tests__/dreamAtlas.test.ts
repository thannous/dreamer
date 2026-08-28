import {
  LUCID_DREAM_ATLAS_MAX_NODES,
  LUCID_DREAM_ATLAS_MAX_SOURCES_PER_NODE,
  LUCID_DREAM_ATLAS_VERSION,
  buildLucidDreamAtlas,
  canAccessLucidDreamAtlasSources,
  canDeleteLucidDreamAtlasSign,
  compareLucidDreamAtlasIds,
  deleteLucidDreamAtlasNode,
  hideLucidDreamAtlasNode,
  isLucidDreamAtlasId,
  isLucidDreamAtlasSourceId,
  listLucidDreamAtlasNodes,
  mergeLucidDreamAtlasNodes,
  normalizeLucidDreamAtlasPreferences,
  resolveLucidDreamAtlasRehearsalSignId,
  parseLucidDreamAtlasExport,
  rebuildLucidDreamAtlasAfterDreamDeleted,
  renameLucidDreamAtlasNode,
  serializeLucidDreamAtlasPreferences,
  type LucidDreamAtlasSnapshot,
} from '@/lib/lucid/dreamAtlas';
import type { LucidReconciledDreamSign } from '@/lib/lucid/dreamSigns';

const NOW = Date.UTC(2026, 7, 28, 9, 0, 0);

function sign(
  overrides: Partial<LucidReconciledDreamSign> & Pick<LucidReconciledDreamSign, 'id' | 'sourceDreamIds'>
): LucidReconciledDreamSign {
  return {
    id: overrides.id,
    label: overrides.label ?? 'Marie',
    category: overrides.category ?? 'person',
    distinctDreamCount: overrides.distinctDreamCount ?? overrides.sourceDreamIds.length,
    sourceDreamIds: overrides.sourceDreamIds,
    evidence: overrides.evidence ?? [],
    decision: overrides.decision ?? 'confirmed',
    displayLabel: overrides.displayLabel ?? overrides.label ?? 'Marie',
  };
}

function dreams(...ids: number[]) {
  return ids.map((id) => ({ id }));
}

function nodeIds(snapshot: LucidDreamAtlasSnapshot): string[] {
  return snapshot.nodes.map((node) => node.id);
}

describe('lucid dream atlas domain', () => {
  const confirmedMarie = sign({
    id: 'sign:marie',
    sourceDreamIds: [String(NOW), String(NOW + 1_000)],
    displayLabel: 'Marie',
  });
  const confirmedMirror = sign({
    id: 'sign:miroir',
    label: 'Miroir',
    displayLabel: 'Miroir',
    category: 'object',
    sourceDreamIds: [String(NOW + 2_000), String(NOW + 3_000)],
  });
  const pendingStairs = sign({
    id: 'sign:escalier_infini',
    label: 'Escalier infini',
    displayLabel: 'Escalier infini',
    category: 'anomaly',
    decision: 'pending',
    sourceDreamIds: [String(NOW), String(NOW + 4_000)],
  });
  const rejectedFear = sign({
    id: 'sign:peur',
    label: 'Peur',
    displayLabel: 'Peur',
    category: 'emotion',
    decision: 'rejected',
    sourceDreamIds: [String(NOW + 1_000), String(NOW + 5_000)],
  });

  it('builds nodes from confirmed signs only', () => {
    const snapshot = buildLucidDreamAtlas({
      signs: [confirmedMarie, pendingStairs, rejectedFear, confirmedMirror],
      dreams: dreams(NOW, NOW + 1_000, NOW + 2_000, NOW + 3_000, NOW + 4_000, NOW + 5_000),
    });
    expect(nodeIds(snapshot)).toEqual(['sign:miroir', 'sign:marie']);
    expect(snapshot.nodes.every((node) => node.distinctDreamCount === node.sourceDreamIds.length)).toBe(true);
  });

  it('excludes pending and rejected signs even when they have sources', () => {
    const snapshot = buildLucidDreamAtlas({
      signs: [pendingStairs, rejectedFear],
      dreams: dreams(NOW, NOW + 4_000, NOW + 5_000),
    });
    expect(snapshot.nodes).toEqual([]);
  });

  it('computes distinct frequency, canonical last appearance and sorted source ids', () => {
    const snapshot = buildLucidDreamAtlas({
      signs: [
        sign({
          id: 'sign:marie',
          sourceDreamIds: [String(NOW + 1_000), String(NOW), String(NOW + 1_000)],
        }),
      ],
      dreams: dreams(NOW, NOW + 1_000),
    });
    expect(snapshot.nodes[0]).toMatchObject({
      id: 'sign:marie',
      distinctDreamCount: 2,
      sourceDreamIds: [String(NOW), String(NOW + 1_000)],
      lastAppearanceAt: NOW + 1_000,
    });
  });

  it('renames, hides and unhides without mutating the input snapshot', () => {
    const snapshot = buildLucidDreamAtlas({
      signs: [confirmedMarie],
      dreams: dreams(NOW, NOW + 1_000),
    });
    const frozen = JSON.parse(JSON.stringify(snapshot));
    const renamed = renameLucidDreamAtlasNode(snapshot, 'sign:marie', 'Marie au miroir', [confirmedMarie], dreams(NOW, NOW + 1_000));
    const hidden = hideLucidDreamAtlasNode(renamed, 'sign:marie', true, [confirmedMarie], dreams(NOW, NOW + 1_000));
    const visible = hideLucidDreamAtlasNode(hidden, 'sign:marie', false, [confirmedMarie], dreams(NOW, NOW + 1_000));

    expect(snapshot).toEqual(frozen);
    expect(renamed.nodes[0]?.label).toBe('Marie au miroir');
    expect(hidden.nodes[0]?.hidden).toBe(true);
    expect(listLucidDreamAtlasNodes(hidden)).toEqual([]);
    expect(listLucidDreamAtlasNodes(hidden, { includeHidden: true })[0]?.hidden).toBe(true);
    expect(visible.nodes[0]?.hidden).toBe(false);
    expect(visible.preferences.renamed['sign:marie']).toBe('Marie au miroir');
  });

  it('merges relation-safe with deterministic source union and no self, cycle or orphan', () => {
    const snapshot = buildLucidDreamAtlas({
      signs: [confirmedMarie, confirmedMirror],
      dreams: dreams(NOW, NOW + 1_000, NOW + 2_000, NOW + 3_000),
    });
    const merged = mergeLucidDreamAtlasNodes(
      snapshot,
      'sign:miroir',
      'sign:marie',
      [confirmedMarie, confirmedMirror],
      dreams(NOW, NOW + 1_000, NOW + 2_000, NOW + 3_000)
    );
    expect(nodeIds(merged)).toEqual(['sign:marie']);
    expect(merged.nodes[0]?.sourceDreamIds).toEqual([
      String(NOW),
      String(NOW + 1_000),
      String(NOW + 2_000),
      String(NOW + 3_000),
    ]);
    expect(merged.nodes[0]?.distinctDreamCount).toBe(4);
    expect(merged.nodes[0]?.lastAppearanceAt).toBe(NOW + 3_000);
    expect(merged.preferences.merges['sign:miroir']).toBe('sign:marie');
    expect(
      resolveLucidDreamAtlasRehearsalSignId({
        nodeId: 'sign:marie',
        sourceDreamId: String(NOW + 2_000),
        signs: [confirmedMarie, confirmedMirror],
        preferences: merged.preferences,
      })
    ).toBe('sign:miroir');
    expect(
      resolveLucidDreamAtlasRehearsalSignId({
        nodeId: 'sign:marie',
        sourceDreamId: String(NOW),
        signs: [confirmedMarie, confirmedMirror],
        preferences: merged.preferences,
      })
    ).toBe('sign:marie');
    expect(
      resolveLucidDreamAtlasRehearsalSignId({
        nodeId: 'sign:marie',
        sourceDreamId: String(NOW + 9_000),
        signs: [confirmedMarie, confirmedMirror],
        preferences: merged.preferences,
      })
    ).toBeNull();

    const self = mergeLucidDreamAtlasNodes(merged, 'sign:marie', 'sign:marie', [confirmedMarie, confirmedMirror], dreams(NOW, NOW + 1_000, NOW + 2_000, NOW + 3_000));
    expect(self.preferences.merges).toEqual(merged.preferences.merges);

    const cycle = mergeLucidDreamAtlasNodes(merged, 'sign:marie', 'sign:miroir', [confirmedMarie, confirmedMirror], dreams(NOW, NOW + 1_000, NOW + 2_000, NOW + 3_000));
    expect(cycle.preferences.merges['sign:miroir']).toBe('sign:marie');
    expect(cycle.preferences.merges['sign:marie']).toBeUndefined();

    const orphan = mergeLucidDreamAtlasNodes(snapshot, 'sign:ghost', 'sign:marie', [confirmedMarie, confirmedMirror], dreams(NOW, NOW + 1_000, NOW + 2_000, NOW + 3_000));
    expect(orphan.preferences.merges).toEqual({});
  });

  it('keeps an explicit rename after merge', () => {
    const snapshot = buildLucidDreamAtlas({
      signs: [confirmedMarie, confirmedMirror],
      dreams: dreams(NOW, NOW + 1_000, NOW + 2_000, NOW + 3_000),
    });
    const renamed = renameLucidDreamAtlasNode(
      snapshot,
      'sign:marie',
      'Marie au miroir',
      [confirmedMarie, confirmedMirror],
      dreams(NOW, NOW + 1_000, NOW + 2_000, NOW + 3_000)
    );
    const merged = mergeLucidDreamAtlasNodes(
      renamed,
      'sign:miroir',
      'sign:marie',
      [confirmedMarie, confirmedMirror],
      dreams(NOW, NOW + 1_000, NOW + 2_000, NOW + 3_000)
    );
    expect(merged.nodes[0]?.label).toBe('Marie au miroir');
    expect(merged.preferences.renamed['sign:marie']).toBe('Marie au miroir');
  });

  it('deletes a sign without deleting source dreams', () => {
    const sourceDreams = dreams(NOW, NOW + 1_000, NOW + 2_000, NOW + 3_000);
    const snapshot = buildLucidDreamAtlas({
      signs: [confirmedMarie, confirmedMirror],
      dreams: sourceDreams,
    });
    const deleted = deleteLucidDreamAtlasNode(
      snapshot,
      'sign:marie',
      [confirmedMarie, confirmedMirror],
      sourceDreams
    );
    expect(nodeIds(deleted)).toEqual(['sign:miroir']);
    expect(deleted.preferences.deleted).toEqual(['sign:marie']);
    expect(sourceDreams.map((dream) => dream.id)).toEqual([NOW, NOW + 1_000, NOW + 2_000, NOW + 3_000]);
  });

  it('recalculates after a source dream is removed and drops nodes with no remaining sources', () => {
    const snapshot = buildLucidDreamAtlas({
      signs: [confirmedMarie, confirmedMirror],
      dreams: dreams(NOW, NOW + 1_000, NOW + 2_000, NOW + 3_000),
    });
    const remainingDreams = dreams(NOW + 2_000, NOW + 3_000);
    const remainingSigns = [
      sign({ id: 'sign:marie', sourceDreamIds: [] }),
      sign({
        id: 'sign:miroir',
        label: 'Miroir',
        displayLabel: 'Miroir',
        category: 'object',
        sourceDreamIds: [String(NOW + 2_000), String(NOW + 3_000)],
      }),
    ];
    const rebuilt = rebuildLucidDreamAtlasAfterDreamDeleted(snapshot, remainingSigns, remainingDreams);
    expect(nodeIds(rebuilt)).toEqual(['sign:miroir']);
    expect(rebuilt.nodes[0]).toMatchObject({
      distinctDreamCount: 2,
      lastAppearanceAt: NOW + 3_000,
      sourceDreamIds: [String(NOW + 2_000), String(NOW + 3_000)],
    });
  });

  it('normalizes corrupted persisted state and versioned export', () => {
    const snapshot = buildLucidDreamAtlas({
      signs: [confirmedMarie, confirmedMirror],
      dreams: dreams(NOW, NOW + 1_000, NOW + 2_000, NOW + 3_000),
      preferences: {
        version: 99,
        renamed: { 'sign:marie': '   ', bad: 12 },
        hidden: ['sign:marie', null, 'sign:marie'],
        merges: { 'sign:marie': 'sign:marie', 'sign:ghost': 'sign:ghost', from: { into: true } },
        deleted: [12, ''],
      },
    });
    expect(snapshot.preferences).toEqual({
      version: LUCID_DREAM_ATLAS_VERSION,
      renamed: {},
      hidden: [],
      merges: {},
      deleted: [],
    });
    expect(parseLucidDreamAtlasExport({ version: 1, extra: true, preferences: snapshot.preferences })).toEqual({
      version: LUCID_DREAM_ATLAS_VERSION,
      preferences: {
        version: LUCID_DREAM_ATLAS_VERSION,
        renamed: {},
        hidden: [],
        merges: {},
        deleted: [],
      },
    });
    const exported = serializeLucidDreamAtlasPreferences(snapshot.preferences);
    expect(exported.version).toBe(LUCID_DREAM_ATLAS_VERSION);
    expect(Object.keys(exported)).toEqual(['version', 'preferences']);
  });

  it('produces a deterministic equivalent list from the same model', () => {
    const snapshot = buildLucidDreamAtlas({
      signs: [confirmedMarie, confirmedMirror],
      dreams: dreams(NOW, NOW + 1_000, NOW + 2_000, NOW + 3_000),
    });
    const reversed = buildLucidDreamAtlas({
      signs: [confirmedMirror, confirmedMarie],
      dreams: dreams(NOW + 3_000, NOW + 2_000, NOW + 1_000, NOW),
    });
    expect(listLucidDreamAtlasNodes(snapshot)).toEqual(listLucidDreamAtlasNodes(reversed));
    expect(listLucidDreamAtlasNodes(snapshot).map((item) => item.id)).toEqual(['sign:miroir', 'sign:marie']);
  });

  it('does not gate source access or sign deletion on entitlement', () => {
    expect(canAccessLucidDreamAtlasSources({ entitlement: 'free' })).toBe(true);
    expect(canAccessLucidDreamAtlasSources({ entitlement: 'premium' })).toBe(true);
    expect(canDeleteLucidDreamAtlasSign({ entitlement: 'guest' })).toBe(true);
    const source = `${canAccessLucidDreamAtlasSources.toString()}${canDeleteLucidDreamAtlasSign.toString()}`;
    expect(source).not.toMatch(/entitlement|premium|quota/i);
  });

  it('does not mutate input signs or dreams', () => {
    const signs = [confirmedMarie, confirmedMirror];
    const sourceDreams = dreams(NOW, NOW + 1_000, NOW + 2_000, NOW + 3_000);
    const frozenSigns = JSON.parse(JSON.stringify(signs));
    const frozenDreams = JSON.parse(JSON.stringify(sourceDreams));
    buildLucidDreamAtlas({ signs, dreams: sourceDreams });
    renameLucidDreamAtlasNode(
      buildLucidDreamAtlas({ signs, dreams: sourceDreams }),
      'sign:marie',
      'Marie au miroir',
      signs,
      sourceDreams
    );
    expect(signs).toEqual(frozenSigns);
    expect(sourceDreams).toEqual(frozenDreams);
  });

  it('caps node count deterministically for large confirmed corpora', () => {
    const signs = Array.from({ length: LUCID_DREAM_ATLAS_MAX_NODES + 25 }, (_, index) =>
      sign({
        id: `sign:token_${String(index).padStart(3, '0')}`,
        label: `Token ${index}`,
        displayLabel: `Token ${index}`,
        sourceDreamIds: [String(NOW + index), String(NOW + index + 10_000)],
      })
    );
    const sourceDreams = signs.flatMap((item) => item.sourceDreamIds.map((id) => ({ id: Number(id) })));
    const snapshot = buildLucidDreamAtlas({ signs, dreams: sourceDreams });
    const again = buildLucidDreamAtlas({ signs: [...signs].reverse(), dreams: [...sourceDreams].reverse() });
    expect(snapshot.nodes).toHaveLength(LUCID_DREAM_ATLAS_MAX_NODES);
    expect(again.nodes).toEqual(snapshot.nodes);
    expect(snapshot.nodes[0]?.lastAppearanceAt).toBeGreaterThanOrEqual(snapshot.nodes.at(-1)?.lastAppearanceAt ?? 0);
  });

  it('keeps canonical target metadata when rebuilding a merge in reverse sign order', () => {
    const sourceDreams = dreams(NOW, NOW + 1_000, NOW + 2_000, NOW + 3_000);
    const snapshot = buildLucidDreamAtlas({
      signs: [confirmedMarie, confirmedMirror],
      dreams: sourceDreams,
    });
    const merged = mergeLucidDreamAtlasNodes(
      snapshot,
      'sign:miroir',
      'sign:marie',
      [confirmedMarie, confirmedMirror],
      sourceDreams
    );
    const rebuilt = buildLucidDreamAtlas({
      signs: [confirmedMirror, confirmedMarie],
      dreams: sourceDreams,
      preferences: merged.preferences,
    });
    expect(rebuilt.nodes).toHaveLength(1);
    expect(rebuilt.nodes[0]).toMatchObject({
      id: 'sign:marie',
      label: 'Marie',
      category: 'person',
      sourceDreamIds: [String(NOW), String(NOW + 1_000), String(NOW + 2_000), String(NOW + 3_000)],
    });
  });

  it('drops orphan merge targets instead of creating ghost nodes', () => {
    const snapshot = buildLucidDreamAtlas({
      signs: [confirmedMarie, confirmedMirror],
      dreams: dreams(NOW, NOW + 1_000, NOW + 2_000, NOW + 3_000),
      preferences: {
        version: LUCID_DREAM_ATLAS_VERSION,
        renamed: { 'sign:ghost': 'Spectre' },
        hidden: ['sign:ghost'],
        merges: { 'sign:marie': 'sign:ghost' },
        deleted: ['sign:ghost'],
      },
    });
    expect(nodeIds(snapshot)).toEqual(['sign:miroir', 'sign:marie']);
    expect(snapshot.nodes.some((node) => node.id === 'sign:ghost')).toBe(false);
    expect(snapshot.preferences.merges).toEqual({});
    expect(snapshot.preferences.renamed).toEqual({});
    expect(snapshot.preferences.hidden).toEqual([]);
    expect(snapshot.nodes.find((node) => node.id === 'sign:marie')).toMatchObject({
      id: 'sign:marie',
      label: 'Marie',
      category: 'person',
    });
  });

  it('keeps every merged member tombstoned after the aggregate is deleted', () => {
    const sourceDreams = dreams(NOW, NOW + 1_000, NOW + 2_000, NOW + 3_000);
    const snapshot = buildLucidDreamAtlas({
      signs: [confirmedMarie, confirmedMirror],
      dreams: sourceDreams,
    });
    const merged = mergeLucidDreamAtlasNodes(
      snapshot,
      'sign:miroir',
      'sign:marie',
      [confirmedMarie, confirmedMirror],
      sourceDreams
    );
    const deleted = deleteLucidDreamAtlasNode(merged, 'sign:marie', [confirmedMarie, confirmedMirror], sourceDreams);
    expect(nodeIds(deleted)).toEqual([]);
    expect(deleted.preferences.deleted).toEqual(['sign:marie', 'sign:miroir']);
    expect(deleted.preferences.merges).toEqual({});
    const rebuilt = rebuildLucidDreamAtlasAfterDreamDeleted(deleted, [confirmedMarie, confirmedMirror], sourceDreams);
    expect(nodeIds(rebuilt)).toEqual([]);
    expect(rebuilt.preferences.deleted).toEqual(['sign:marie', 'sign:miroir']);
  });

  it('ignores rename hide and delete on ghost ids', () => {
    const sourceDreams = dreams(NOW, NOW + 1_000, NOW + 2_000, NOW + 3_000);
    const snapshot = buildLucidDreamAtlas({
      signs: [confirmedMarie, confirmedMirror],
      dreams: sourceDreams,
    });
    const frozen = JSON.parse(JSON.stringify(snapshot.preferences));
    const renamed = renameLucidDreamAtlasNode(snapshot, 'sign:ghost', 'Spectre', [confirmedMarie, confirmedMirror], sourceDreams);
    const hidden = hideLucidDreamAtlasNode(snapshot, 'sign:ghost', true, [confirmedMarie, confirmedMirror], sourceDreams);
    const deleted = deleteLucidDreamAtlasNode(snapshot, 'sign:ghost', [confirmedMarie, confirmedMirror], sourceDreams);
    expect(renamed.preferences).toEqual(frozen);
    expect(hidden.preferences).toEqual(frozen);
    expect(deleted.preferences).toEqual(frozen);
    expect(nodeIds(renamed)).toEqual(['sign:miroir', 'sign:marie']);
  });

  it('exposes copied sourceDreamIds on the equivalent list without sharing the node array', () => {
    const snapshot = buildLucidDreamAtlas({
      signs: [confirmedMarie],
      dreams: dreams(NOW, NOW + 1_000),
    });
    const listed = listLucidDreamAtlasNodes(snapshot);
    expect(listed[0]?.sourceDreamIds).toEqual(snapshot.nodes[0]?.sourceDreamIds);
    expect(listed[0]?.sourceDreamIds).not.toBe(snapshot.nodes[0]?.sourceDreamIds);
    listed[0]?.sourceDreamIds.push('mutated');
    expect(snapshot.nodes[0]?.sourceDreamIds).toEqual([String(NOW), String(NOW + 1_000)]);
  });

  it('filters available sources before capping and keeps the most recent ones', () => {
    const overflow = LUCID_DREAM_ATLAS_MAX_SOURCES_PER_NODE + 20;
    const allIds = Array.from({ length: overflow }, (_, index) => NOW + index);
    const available = allIds.slice(-LUCID_DREAM_ATLAS_MAX_SOURCES_PER_NODE);
    const snapshot = buildLucidDreamAtlas({
      signs: [
        sign({
          id: 'sign:marie',
          sourceDreamIds: allIds.map(String),
        }),
      ],
      dreams: available.map((id) => ({ id })),
    });
    expect(snapshot.nodes[0]?.sourceDreamIds).toHaveLength(LUCID_DREAM_ATLAS_MAX_SOURCES_PER_NODE);
    expect(snapshot.nodes[0]?.sourceDreamIds[0]).toBe(String(available[0]));
    expect(snapshot.nodes[0]?.lastAppearanceAt).toBe(available[available.length - 1]);
    expect(snapshot.nodes[0]?.sourceDreamIds.includes(String(allIds[0]))).toBe(false);
  });

  it('sorts labels by codepoint rather than locale and strips extra preference keys', () => {
    expect(compareLucidDreamAtlasIds('A cote', 'Aa')).toBeLessThan(0);
    expect(compareLucidDreamAtlasIds('a', 'B')).toBeGreaterThan(0);
    const snapshot = buildLucidDreamAtlas({
      signs: [confirmedMarie, confirmedMirror],
      dreams: dreams(NOW, NOW + 1_000, NOW + 2_000, NOW + 3_000),
      preferences: {
        version: LUCID_DREAM_ATLAS_VERSION,
        renamed: {},
        hidden: [],
        merges: {},
        deleted: [],
        extra: 'drop-me',
      },
    });
    expect(snapshot.preferences).toEqual({
      version: LUCID_DREAM_ATLAS_VERSION,
      renamed: {},
      hidden: [],
      merges: {},
      deleted: [],
    });
  });

  it('normalizes empty, partial, extra-key and unknown-version preferences without recursion', () => {
    expect(normalizeLucidDreamAtlasPreferences({})).toEqual({
      version: LUCID_DREAM_ATLAS_VERSION,
      renamed: {},
      hidden: [],
      merges: {},
      deleted: [],
    });
    expect(normalizeLucidDreamAtlasPreferences({ hidden: ['sign:marie'] })).toEqual({
      version: LUCID_DREAM_ATLAS_VERSION,
      renamed: {},
      hidden: ['sign:marie'],
      merges: {},
      deleted: [],
    });
    expect(
      normalizeLucidDreamAtlasPreferences({
        version: LUCID_DREAM_ATLAS_VERSION,
        renamed: { 'sign:marie': 'Marie au miroir' },
        extra: 'drop-me',
      })
    ).toEqual({
      version: LUCID_DREAM_ATLAS_VERSION,
      renamed: { 'sign:marie': 'Marie au miroir' },
      hidden: [],
      merges: {},
      deleted: [],
    });
    expect(normalizeLucidDreamAtlasPreferences({ version: 99, hidden: ['sign:marie'] })).toEqual({
      version: LUCID_DREAM_ATLAS_VERSION,
      renamed: {},
      hidden: [],
      merges: {},
      deleted: [],
    });
  });

  it('keeps canonical timestamp source ids and rejects invalid node or source ids', () => {
    const snapshot = buildLucidDreamAtlas({
      signs: [
        sign({
          id: 'sign:marie',
          sourceDreamIds: [String(NOW), String(NOW + 1_000), '0', '-12', '12.5', 'not-a-time', ''],
        }),
        sign({
          id: '__proto__',
          sourceDreamIds: [String(NOW), String(NOW + 1_000)],
        }),
        sign({
          id: 'constructor',
          sourceDreamIds: [String(NOW), String(NOW + 1_000)],
        }),
        sign({
          id: 'toString',
          sourceDreamIds: [String(NOW), String(NOW + 1_000)],
        }),
        sign({
          id: 'ghost',
          sourceDreamIds: [String(NOW), String(NOW + 1_000)],
        }),
        sign({
          id: 'sign:',
          sourceDreamIds: [String(NOW), String(NOW + 1_000)],
        }),
        sign({
          id: `sign:${'x'.repeat(130)}`,
          sourceDreamIds: [String(NOW), String(NOW + 1_000)],
        }),
      ],
      dreams: dreams(NOW, NOW + 1_000, 0, -12),
    });
    expect(snapshot.nodes).toHaveLength(1);
    expect(snapshot.nodes[0]?.sourceDreamIds).toEqual([String(NOW), String(NOW + 1_000)]);
    expect(isLucidDreamAtlasId('sign:marie')).toBe(true);
    expect(isLucidDreamAtlasId('__proto__')).toBe(false);
    expect(isLucidDreamAtlasId('constructor')).toBe(false);
    expect(isLucidDreamAtlasId('toString')).toBe(false);
    expect(isLucidDreamAtlasId('ghost')).toBe(false);
    expect(isLucidDreamAtlasId('sign:')).toBe(false);
    expect(isLucidDreamAtlasId(`sign:${'x'.repeat(130)}`)).toBe(false);
    expect(isLucidDreamAtlasSourceId(String(NOW))).toBe(true);
    expect(isLucidDreamAtlasSourceId('0')).toBe(false);
    expect(isLucidDreamAtlasSourceId('-12')).toBe(false);
    expect(isLucidDreamAtlasSourceId('12.5')).toBe(false);
    expect(isLucidDreamAtlasSourceId('not-a-time')).toBe(false);
    const frozen = JSON.parse(JSON.stringify(snapshot.preferences));
    const renamed = renameLucidDreamAtlasNode(snapshot, 'ghost', 'Spectre', [confirmedMarie], dreams(NOW, NOW + 1_000));
    const hidden = hideLucidDreamAtlasNode(snapshot, '__proto__', true, [confirmedMarie], dreams(NOW, NOW + 1_000));
    const deleted = deleteLucidDreamAtlasNode(snapshot, 'constructor', [confirmedMarie], dreams(NOW, NOW + 1_000));
    expect(renamed.preferences).toEqual(frozen);
    expect(hidden.preferences).toEqual(frozen);
    expect(deleted.preferences).toEqual(frozen);
  });
});
