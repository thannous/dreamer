import type { DreamAnalysis } from '@/lib/types';
import {
  LUCID_DREAM_SIGN_CATEGORIES,
  LUCID_DREAM_SIGN_MAX_LABEL_CHARS,
  toLucidDreamSignSourceId,
  type LucidDreamSignCategory,
  type LucidReconciledDreamSign,
} from '@/lib/lucid/dreamSigns';

export const LUCID_DREAM_ATLAS_VERSION = 1 as const;
export const LUCID_DREAM_ATLAS_MAX_NODES = 200 as const;
export const LUCID_DREAM_ATLAS_MAX_SOURCES_PER_NODE = 500 as const;
export const LUCID_DREAM_ATLAS_MAX_LABEL_CHARS = LUCID_DREAM_SIGN_MAX_LABEL_CHARS;
export const LUCID_DREAM_ATLAS_MAX_NODE_ID_CHARS = 128 as const;

export type LucidDreamAtlasNodeId = string;
export type LucidDreamAtlasSourceId = string;

export type LucidDreamAtlasNode = {
  id: LucidDreamAtlasNodeId;
  label: string;
  category: LucidDreamSignCategory | null;
  distinctDreamCount: number;
  sourceDreamIds: LucidDreamAtlasSourceId[];
  lastAppearanceAt: number;
  hidden: boolean;
};

export type LucidDreamAtlasListItem = {
  id: LucidDreamAtlasNodeId;
  label: string;
  category: LucidDreamSignCategory | null;
  distinctDreamCount: number;
  sourceDreamIds: LucidDreamAtlasSourceId[];
  lastAppearanceAt: number;
  hidden: boolean;
};

export type LucidDreamAtlasRename = {
  nodeId: LucidDreamAtlasNodeId;
  label: string;
};

export type LucidDreamAtlasMerge = {
  fromId: LucidDreamAtlasNodeId;
  intoId: LucidDreamAtlasNodeId;
};

export type LucidDreamAtlasPreferences = {
  version: typeof LUCID_DREAM_ATLAS_VERSION;
  renamed: Record<string, string>;
  hidden: string[];
  merges: Record<string, string>;
  deleted: string[];
};

export type LucidDreamAtlasSnapshot = {
  version: typeof LUCID_DREAM_ATLAS_VERSION;
  nodes: LucidDreamAtlasNode[];
  preferences: LucidDreamAtlasPreferences;
};

export type LucidDreamAtlasExport = {
  version: typeof LUCID_DREAM_ATLAS_VERSION;
  preferences: LucidDreamAtlasPreferences;
};

const ALLOWED_PREFERENCE_KEYS = ['version', 'renamed', 'hidden', 'merges', 'deleted'] as const;
const ALLOWED_EXPORT_KEYS = ['version', 'preferences'] as const;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
const NODE_ID_PATTERN = /^sign:[A-Za-z0-9][A-Za-z0-9_-]{0,121}$/;

function createEmptyRecord<V>(): Record<string, V> {
  return Object.create(null) as Record<string, V>;
}

export function compareLucidDreamAtlasIds(left: string, right: string): number {
  if (left === right) return 0;
  const bound = Math.min(left.length, right.length);
  for (let index = 0; index < bound; index += 1) {
    const delta = left.charCodeAt(index) - right.charCodeAt(index);
    if (delta !== 0) return delta < 0 ? -1 : 1;
  }
  return left.length < right.length ? -1 : 1;
}

function uniqueSortedNodeIds(ids: readonly string[]): string[] {
  return [...new Set(ids.filter((id) => isLucidDreamAtlasId(id)))].sort(compareLucidDreamAtlasIds);
}

function uniqueSortedSourceIds(ids: readonly string[]): string[] {
  return [...new Set(ids.filter((id) => isLucidDreamAtlasSourceId(id)))].sort(compareLucidDreamAtlasIds);
}

function hasExactKeys(value: object, allowed: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === allowed.length && keys.every((key) => allowed.includes(key));
}

export function isLucidDreamAtlasId(value: unknown): value is LucidDreamAtlasNodeId {
  return (
    typeof value === 'string' &&
    value.trim() === value &&
    value.length > 5 &&
    value.length <= LUCID_DREAM_ATLAS_MAX_NODE_ID_CHARS &&
    !CONTROL_CHARS.test(value) &&
    NODE_ID_PATTERN.test(value)
  );
}

export function isLucidDreamAtlasSourceId(value: unknown): value is LucidDreamAtlasSourceId {
  if (typeof value !== 'string' || value.trim() !== value || !/^[1-9]\d*$/.test(value)) return false;
  const timestamp = Number(value);
  return Number.isSafeInteger(timestamp) && timestamp > 0;
}

function toCanonicalSourceId(value: unknown): string | null {
  if (typeof value === 'number') {
    return isLucidDreamAtlasSourceId(String(value)) ? String(value) : null;
  }
  const sourceId = typeof value === 'string' ? value.trim() : toLucidDreamSignSourceId(String(value ?? ''));
  return isLucidDreamAtlasSourceId(sourceId) ? sourceId : null;
}

function isAllowedCategory(value: unknown): value is LucidDreamSignCategory {
  return typeof value === 'string' && (LUCID_DREAM_SIGN_CATEGORIES as readonly string[]).includes(value);
}

function normalizeLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (CONTROL_CHARS.test(value)) return null;
  const label = value.replace(/\s+/g, ' ').trim();
  if (!label || label.length > LUCID_DREAM_ATLAS_MAX_LABEL_CHARS) return null;
  return label;
}

function clonePreferences(preferences: LucidDreamAtlasPreferences): LucidDreamAtlasPreferences {
  return {
    version: LUCID_DREAM_ATLAS_VERSION,
    renamed: Object.assign(createEmptyRecord<string>(), preferences.renamed),
    hidden: [...preferences.hidden],
    merges: Object.assign(createEmptyRecord<string>(), preferences.merges),
    deleted: [...preferences.deleted],
  };
}

export function createEmptyLucidDreamAtlasPreferences(): LucidDreamAtlasPreferences {
  return {
    version: LUCID_DREAM_ATLAS_VERSION,
    renamed: {},
    hidden: [],
    merges: {},
    deleted: [],
  };
}

function canonicalSourceTime(sourceId: string): number | null {
  return isLucidDreamAtlasSourceId(sourceId) ? Number(sourceId) : null;
}

function lastAppearanceAt(sourceDreamIds: readonly string[]): number {
  let latest = Number.NEGATIVE_INFINITY;
  for (const sourceId of sourceDreamIds) {
    const timestamp = canonicalSourceTime(sourceId);
    if (timestamp != null && timestamp > latest) latest = timestamp;
  }
  return Number.isFinite(latest) ? latest : 0;
}

function resolveMergeTarget(
  nodeId: string,
  merges: Readonly<Record<string, string>>,
  seen = new Set<string>()
): string | null {
  let current = nodeId;
  while (merges[current]) {
    if (seen.has(current)) return null;
    seen.add(current);
    current = merges[current];
    if (!isLucidDreamAtlasId(current)) return null;
    if (current === nodeId) return null;
  }
  return current;
}

function sanitizeMerges(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const incoming = raw as Record<string, unknown>;
  const candidate = createEmptyRecord<string>();
  for (const [fromId, intoId] of Object.entries(incoming)) {
    if (!isLucidDreamAtlasId(fromId) || !isLucidDreamAtlasId(intoId) || fromId === intoId) continue;
    candidate[fromId] = intoId;
  }
  const sanitized = createEmptyRecord<string>();
  const keys = Object.keys(candidate).sort(compareLucidDreamAtlasIds);
  for (const fromId of keys) {
    const intoId = resolveMergeTarget(fromId, candidate);
    if (!intoId || intoId === fromId) continue;
    sanitized[fromId] = intoId;
  }
  return sanitized;
}

function sanitizeRenames(raw: unknown, merges: Readonly<Record<string, string>>): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const incoming = raw as Record<string, unknown>;
  const renamed = createEmptyRecord<string>();
  for (const [nodeId, label] of Object.entries(incoming)) {
    if (!isLucidDreamAtlasId(nodeId)) continue;
    const target = resolveMergeTarget(nodeId, merges) ?? nodeId;
    if (merges[nodeId]) continue;
    const nextLabel = normalizeLabel(label);
    if (!nextLabel) continue;
    renamed[target] = nextLabel;
  }
  return renamed;
}

function sanitizeIdList(raw: unknown, merges: Readonly<Record<string, string>>): string[] {
  if (!Array.isArray(raw)) return [];
  const ids: string[] = [];
  for (const value of raw) {
    if (!isLucidDreamAtlasId(value)) continue;
    const target = resolveMergeTarget(value, merges);
    if (!target || merges[value]) continue;
    ids.push(target);
  }
  return uniqueSortedNodeIds(ids);
}

export function normalizeLucidDreamAtlasPreferences(raw: unknown): LucidDreamAtlasPreferences {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return createEmptyLucidDreamAtlasPreferences();
  }
  const value = raw as Record<string, unknown>;
  if ('version' in value && value.version != null && value.version !== LUCID_DREAM_ATLAS_VERSION) {
    return createEmptyLucidDreamAtlasPreferences();
  }
  const known: Record<string, unknown> = {};
  for (const key of ALLOWED_PREFERENCE_KEYS) {
    if (key in value) known[key] = value[key];
  }
  const merges = sanitizeMerges(known.merges);
  return {
    version: LUCID_DREAM_ATLAS_VERSION,
    renamed: sanitizeRenames(known.renamed, merges),
    hidden: sanitizeIdList(known.hidden, merges),
    merges,
    deleted: sanitizeIdList(known.deleted, merges),
  };
}

function sortedEntries(record: Record<string, string>): [string, string][] {
  return Object.entries(record).sort(([left], [right]) => compareLucidDreamAtlasIds(left, right));
}

export function areLucidDreamAtlasPreferencesSemanticallyEqual(
  left: LucidDreamAtlasPreferences,
  right: LucidDreamAtlasPreferences
): boolean {
  return JSON.stringify({
    version: left.version,
    renamed: sortedEntries(left.renamed),
    hidden: [...left.hidden].sort(compareLucidDreamAtlasIds),
    merges: sortedEntries(left.merges),
    deleted: [...left.deleted].sort(compareLucidDreamAtlasIds),
  }) === JSON.stringify({
    version: right.version,
    renamed: sortedEntries(right.renamed),
    hidden: [...right.hidden].sort(compareLucidDreamAtlasIds),
    merges: sortedEntries(right.merges),
    deleted: [...right.deleted].sort(compareLucidDreamAtlasIds),
  });
}

export function isStrictLucidDreamAtlasPreferences(value: unknown): value is LucidDreamAtlasPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (!hasExactKeys(value, ALLOWED_PREFERENCE_KEYS)) return false;
  const preferences = value as LucidDreamAtlasPreferences;
  if (preferences.version !== LUCID_DREAM_ATLAS_VERSION) return false;
  if (!preferences.renamed || typeof preferences.renamed !== 'object' || Array.isArray(preferences.renamed)) {
    return false;
  }
  if (!preferences.merges || typeof preferences.merges !== 'object' || Array.isArray(preferences.merges)) {
    return false;
  }
  if (!Array.isArray(preferences.hidden) || !Array.isArray(preferences.deleted)) return false;
  if (preferences.hidden.some((id) => !isLucidDreamAtlasId(id))) return false;
  if (preferences.deleted.some((id) => !isLucidDreamAtlasId(id))) return false;
  if (Object.entries(preferences.renamed).some(([id, label]) => !isLucidDreamAtlasId(id) || normalizeLabel(label) !== label)) {
    return false;
  }
  if (Object.entries(preferences.merges).some(([fromId, intoId]) => !isLucidDreamAtlasId(fromId) || !isLucidDreamAtlasId(intoId))) {
    return false;
  }
  const normalized = normalizeLucidDreamAtlasPreferences(preferences);
  return areLucidDreamAtlasPreferencesSemanticallyEqual(normalized, {
    version: LUCID_DREAM_ATLAS_VERSION,
    renamed: preferences.renamed,
    hidden: uniqueSortedNodeIds(preferences.hidden),
    merges: preferences.merges,
    deleted: uniqueSortedNodeIds(preferences.deleted),
  });
}
export function parseLucidDreamAtlasExport(raw: unknown): LucidDreamAtlasExport {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !hasExactKeys(raw, ALLOWED_EXPORT_KEYS)) {
    return { version: LUCID_DREAM_ATLAS_VERSION, preferences: createEmptyLucidDreamAtlasPreferences() };
  }
  const value = raw as LucidDreamAtlasExport;
  if (value.version !== LUCID_DREAM_ATLAS_VERSION) {
    return { version: LUCID_DREAM_ATLAS_VERSION, preferences: createEmptyLucidDreamAtlasPreferences() };
  }
  return {
    version: LUCID_DREAM_ATLAS_VERSION,
    preferences: normalizeLucidDreamAtlasPreferences(value.preferences),
  };
}

export function serializeLucidDreamAtlasPreferences(
  preferences: LucidDreamAtlasPreferences
): LucidDreamAtlasExport {
  return {
    version: LUCID_DREAM_ATLAS_VERSION,
    preferences: normalizeLucidDreamAtlasPreferences(preferences),
  };
}

function confirmedSigns(signs: readonly LucidReconciledDreamSign[]): LucidReconciledDreamSign[] {
  return signs.filter((sign) => sign?.decision === 'confirmed' && isLucidDreamAtlasId(sign.id));
}

function compareSourceRecency(left: string, right: string): number {
  const leftTime = canonicalSourceTime(left) ?? Number.NEGATIVE_INFINITY;
  const rightTime = canonicalSourceTime(right) ?? Number.NEGATIVE_INFINITY;
  if (leftTime !== rightTime) return rightTime - leftTime;
  return compareLucidDreamAtlasIds(left, right);
}

function sourceIdsForSign(
  sign: LucidReconciledDreamSign,
  availableSourceIds?: ReadonlySet<string>
): string[] {
  const raw = Array.isArray(sign.sourceDreamIds) ? sign.sourceDreamIds : [];
  const mapped = raw
    .map((sourceId) => toCanonicalSourceId(sourceId))
    .filter((sourceId): sourceId is string => sourceId != null);
  const filtered = availableSourceIds
    ? mapped.filter((sourceId) => availableSourceIds.has(sourceId))
    : mapped;
  return uniqueSortedSourceIds(filtered)
    .sort(compareSourceRecency)
    .slice(0, LUCID_DREAM_ATLAS_MAX_SOURCES_PER_NODE)
    .sort(compareLucidDreamAtlasIds);
}

function availableSourceSet(
  dreams: readonly Pick<DreamAnalysis, 'id'>[] | undefined
): ReadonlySet<string> | undefined {
  if (!dreams) return undefined;
  return new Set(
    dreams
      .map((dream) => toCanonicalSourceId(dream.id))
      .filter((sourceId): sourceId is string => sourceId != null)
  );
}

function compareNodes(left: LucidDreamAtlasNode, right: LucidDreamAtlasNode): number {
  if (left.lastAppearanceAt !== right.lastAppearanceAt) {
    return right.lastAppearanceAt - left.lastAppearanceAt;
  }
  if (left.distinctDreamCount !== right.distinctDreamCount) {
    return right.distinctDreamCount - left.distinctDreamCount;
  }
  const labelOrder = compareLucidDreamAtlasIds(left.label, right.label);
  if (labelOrder !== 0) return labelOrder;
  return compareLucidDreamAtlasIds(left.id, right.id);
}

function toNode(
  id: string,
  label: string,
  category: LucidDreamSignCategory | null,
  sourceDreamIds: readonly string[],
  hidden: boolean
): LucidDreamAtlasNode | null {
  const sources = uniqueSortedSourceIds(sourceDreamIds)
    .sort(compareSourceRecency)
    .slice(0, LUCID_DREAM_ATLAS_MAX_SOURCES_PER_NODE)
    .sort(compareLucidDreamAtlasIds);
  if (sources.length === 0) return null;
  const nextLabel = normalizeLabel(label);
  if (!nextLabel) return null;
  return {
    id,
    label: nextLabel,
    category: isAllowedCategory(category) ? category : null,
    distinctDreamCount: sources.length,
    sourceDreamIds: sources,
    lastAppearanceAt: lastAppearanceAt(sources),
    hidden,
  };
}

function collectMergeGroup(rootId: string, merges: Readonly<Record<string, string>>): string[] {
  const members = new Set<string>([rootId]);
  for (const fromId of Object.keys(merges)) {
    const target = resolveMergeTarget(fromId, merges);
    if (target === rootId) members.add(fromId);
  }
  return uniqueSortedNodeIds([...members]);
}

function liveConfirmedIds(signs: readonly LucidReconciledDreamSign[]): Set<string> {
  return new Set(confirmedSigns(signs).map((sign) => sign.id));
}

function reconcilePreferencesWithSigns(
  preferences: LucidDreamAtlasPreferences,
  signs: readonly LucidReconciledDreamSign[]
): LucidDreamAtlasPreferences {
  const confirmedIds = liveConfirmedIds(signs);
  const next = clonePreferences(preferences);
  const nextMerges = createEmptyRecord<string>();
  for (const [fromId, intoId] of Object.entries(next.merges)) {
    const target = resolveMergeTarget(fromId, next.merges) ?? intoId;
    if (!confirmedIds.has(fromId) || !confirmedIds.has(target) || fromId === target) continue;
    nextMerges[fromId] = target;
  }
  next.merges = sanitizeMerges(nextMerges);

  // Keep deleted tombstones even if the sign is temporarily absent; drop
  // renamed/hidden IDs that are not confirmed live nodes.
  const keepLivePreferenceId = (id: string) =>
    confirmedIds.has(id) && !next.merges[id] && !next.deleted.includes(id);
  const nextRenamed = createEmptyRecord<string>();
  for (const [nodeId, label] of Object.entries(next.renamed)) {
    const target = resolveMergeTarget(nodeId, next.merges) ?? nodeId;
    if (!keepLivePreferenceId(target)) continue;
    nextRenamed[target] = label;
  }
  next.renamed = nextRenamed;
  next.hidden = uniqueSortedNodeIds(
    next.hidden.map((id) => resolveMergeTarget(id, next.merges) ?? id).filter((id) => keepLivePreferenceId(id))
  );
  next.deleted = uniqueSortedNodeIds(next.deleted);
  return next;
}

export function buildLucidDreamAtlas(input: {
  signs: readonly LucidReconciledDreamSign[];
  dreams?: readonly Pick<DreamAnalysis, 'id'>[];
  preferences?: unknown;
}): LucidDreamAtlasSnapshot {
  const preferences = reconcilePreferencesWithSigns(
    normalizeLucidDreamAtlasPreferences(input.preferences),
    input.signs
  );
  const availableSourceIds = availableSourceSet(input.dreams);
  const deleted = new Set(preferences.deleted);
  const hidden = new Set(preferences.hidden);
  const confirmed = confirmedSigns(input.signs);
  const canonicalById = new Map(confirmed.map((sign) => [sign.id, sign]));
  const buckets = new Map<
    string,
    {
      id: string;
      sourceDreamIds: string[];
    }
  >();

  for (const sign of confirmed) {
    if (deleted.has(sign.id)) continue;
    const targetId = resolveMergeTarget(sign.id, preferences.merges);
    if (!targetId || deleted.has(targetId) || preferences.merges[targetId]) continue;
    const sources = sourceIdsForSign(sign, availableSourceIds);
    if (sources.length === 0) continue;
    const existing = buckets.get(targetId);
    buckets.set(targetId, {
      id: targetId,
      sourceDreamIds: [...(existing?.sourceDreamIds ?? []), ...sources],
    });
  }

  const nodes = [...buckets.values()]
    .map((bucket) => {
      const canonical = canonicalById.get(bucket.id);
      return toNode(
        bucket.id,
        preferences.renamed[bucket.id] ?? canonical?.displayLabel ?? canonical?.label ?? bucket.id,
        canonical?.category ?? null,
        bucket.sourceDreamIds,
        hidden.has(bucket.id)
      );
    })
    .filter((node): node is LucidDreamAtlasNode => node != null)
    .sort(compareNodes)
    .slice(0, LUCID_DREAM_ATLAS_MAX_NODES);

  return {
    version: LUCID_DREAM_ATLAS_VERSION,
    nodes,
    preferences: clonePreferences(preferences),
  };
}

function withPreferences(
  snapshot: LucidDreamAtlasSnapshot,
  updater: (preferences: LucidDreamAtlasPreferences) => LucidDreamAtlasPreferences,
  signs: readonly LucidReconciledDreamSign[],
  dreams?: readonly Pick<DreamAnalysis, 'id'>[]
): LucidDreamAtlasSnapshot {
  return buildLucidDreamAtlas({
    signs,
    dreams,
    preferences: updater(clonePreferences(snapshot.preferences)),
  });
}

function requireLiveNode(snapshot: LucidDreamAtlasSnapshot, nodeId: string): string | null {
  const targetId = resolveMergeTarget(nodeId, snapshot.preferences.merges) ?? nodeId;
  if (!isLucidDreamAtlasId(targetId)) return null;
  if (snapshot.preferences.deleted.includes(targetId)) return null;
  return snapshot.nodes.some((node) => node.id === targetId) ? targetId : null;
}

export function renameLucidDreamAtlasNode(
  snapshot: LucidDreamAtlasSnapshot,
  nodeId: string,
  label: string,
  signs: readonly LucidReconciledDreamSign[],
  dreams?: readonly Pick<DreamAnalysis, 'id'>[]
): LucidDreamAtlasSnapshot {
  const nextLabel = normalizeLabel(label);
  const targetId = requireLiveNode(snapshot, nodeId);
  if (!nextLabel || !targetId) {
    return buildLucidDreamAtlas({ signs, dreams, preferences: snapshot.preferences });
  }
  return withPreferences(
    snapshot,
    (preferences) => {
      preferences.renamed[targetId] = nextLabel;
      return preferences;
    },
    signs,
    dreams
  );
}

export function hideLucidDreamAtlasNode(
  snapshot: LucidDreamAtlasSnapshot,
  nodeId: string,
  hidden: boolean,
  signs: readonly LucidReconciledDreamSign[],
  dreams?: readonly Pick<DreamAnalysis, 'id'>[]
): LucidDreamAtlasSnapshot {
  const targetId = requireLiveNode(snapshot, nodeId);
  if (!targetId) {
    return buildLucidDreamAtlas({ signs, dreams, preferences: snapshot.preferences });
  }
  return withPreferences(
    snapshot,
    (preferences) => {
      const nextHidden = new Set(preferences.hidden);
      if (hidden) nextHidden.add(targetId);
      else nextHidden.delete(targetId);
      preferences.hidden = [...nextHidden].sort(compareLucidDreamAtlasIds);
      return preferences;
    },
    signs,
    dreams
  );
}

export function mergeLucidDreamAtlasNodes(
  snapshot: LucidDreamAtlasSnapshot,
  fromId: string,
  intoId: string,
  signs: readonly LucidReconciledDreamSign[],
  dreams?: readonly Pick<DreamAnalysis, 'id'>[]
): LucidDreamAtlasSnapshot {
  const fromTarget = requireLiveNode(snapshot, fromId);
  const intoTarget = requireLiveNode(snapshot, intoId);
  if (!fromTarget || !intoTarget || fromTarget === intoTarget) {
    return buildLucidDreamAtlas({ signs, dreams, preferences: snapshot.preferences });
  }

  return withPreferences(
    snapshot,
    (preferences) => {
      const nextMerges = { ...preferences.merges, [fromTarget]: intoTarget };
      for (const [sourceId, targetId] of Object.entries(nextMerges)) {
        if (targetId === fromTarget) nextMerges[sourceId] = intoTarget;
      }
      preferences.merges = sanitizeMerges(nextMerges);
      delete preferences.renamed[fromTarget];
      if (preferences.hidden.includes(fromTarget)) {
        preferences.hidden = uniqueSortedNodeIds(
          preferences.hidden.filter((id) => id !== fromTarget).concat(intoTarget)
        );
      }
      return preferences;
    },
    signs,
    dreams
  );
}

export function deleteLucidDreamAtlasNode(
  snapshot: LucidDreamAtlasSnapshot,
  nodeId: string,
  signs: readonly LucidReconciledDreamSign[],
  dreams?: readonly Pick<DreamAnalysis, 'id'>[]
): LucidDreamAtlasSnapshot {
  const targetId = requireLiveNode(snapshot, nodeId);
  if (!targetId) {
    return buildLucidDreamAtlas({ signs, dreams, preferences: snapshot.preferences });
  }
  return withPreferences(
    snapshot,
    (preferences) => {
      const group = collectMergeGroup(targetId, preferences.merges);
      preferences.deleted = uniqueSortedNodeIds([...preferences.deleted, ...group]);
      for (const memberId of group) {
        delete preferences.renamed[memberId];
        delete preferences.merges[memberId];
      }
      for (const [fromId, intoId] of Object.entries(preferences.merges)) {
        if (group.includes(fromId) || group.includes(intoId)) delete preferences.merges[fromId];
      }
      preferences.hidden = preferences.hidden.filter((id) => !group.includes(id));
      return preferences;
    },
    signs,
    dreams
  );
}

export function rebuildLucidDreamAtlasAfterDreamDeleted(
  snapshot: LucidDreamAtlasSnapshot,
  signs: readonly LucidReconciledDreamSign[],
  dreams: readonly Pick<DreamAnalysis, 'id'>[]
): LucidDreamAtlasSnapshot {
  return buildLucidDreamAtlas({
    signs,
    dreams,
    preferences: snapshot.preferences,
  });
}

export function listLucidDreamAtlasNodes(
  snapshot: LucidDreamAtlasSnapshot,
  options?: { includeHidden?: boolean }
): LucidDreamAtlasListItem[] {
  const includeHidden = options?.includeHidden === true;
  return snapshot.nodes
    .filter((node) => includeHidden || !node.hidden)
    .map((node) => ({
      id: node.id,
      label: node.label,
      category: node.category,
      distinctDreamCount: node.distinctDreamCount,
      sourceDreamIds: [...node.sourceDreamIds],
      lastAppearanceAt: node.lastAppearanceAt,
      hidden: node.hidden,
    }));
}

export function getLucidDreamAtlasNode(
  snapshot: LucidDreamAtlasSnapshot,
  nodeId: string
): LucidDreamAtlasNode | null {
  const targetId = resolveMergeTarget(nodeId, snapshot.preferences.merges) ?? nodeId;
  return snapshot.nodes.find((node) => node.id === targetId) ?? null;
}

export function resolveLucidDreamAtlasRehearsalSignId(input: {
  nodeId: string;
  sourceDreamId: string;
  signs: readonly LucidReconciledDreamSign[];
  preferences?: unknown;
}): string | null {
  if (!isLucidDreamAtlasId(input.nodeId) || !isLucidDreamAtlasSourceId(input.sourceDreamId)) {
    return null;
  }
  const preferences = normalizeLucidDreamAtlasPreferences(input.preferences);
  const canonicalId = resolveMergeTarget(input.nodeId, preferences.merges) ?? input.nodeId;
  if (preferences.deleted.includes(canonicalId) || preferences.merges[canonicalId]) return null;

  const matches: string[] = [];
  for (const sign of confirmedSigns(input.signs)) {
    if (preferences.deleted.includes(sign.id)) continue;
    const targetId = resolveMergeTarget(sign.id, preferences.merges);
    if (targetId !== canonicalId) continue;
    if (!sourceIdsForSign(sign).includes(input.sourceDreamId)) continue;
    matches.push(sign.id);
  }
  if (matches.length === 0) return null;
  return uniqueSortedNodeIds(matches)[0] ?? null;
}

export function canAccessLucidDreamAtlasSources(_input?: unknown): true {
  return true;
}

export function canDeleteLucidDreamAtlasSign(_input?: unknown): true {
  return true;
}
