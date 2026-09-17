export const LUCID_HK_SLEEP_ANALYSIS_IDENTIFIER =
  'HKCategoryTypeIdentifierSleepAnalysis' as const;

export const LUCID_HK_SLEEP_CATEGORY_VALUES = [0, 1, 2, 3, 4, 5] as const;
export type LucidHkSleepCategoryValue = (typeof LUCID_HK_SLEEP_CATEGORY_VALUES)[number];

export const LUCID_HK_SLEEP_CATEGORIES = [
  'inBed',
  'asleepUnspecified',
  'awake',
  'asleepCore',
  'asleepDeep',
  'asleepREM',
] as const;
export type LucidHkSleepCategory = (typeof LUCID_HK_SLEEP_CATEGORIES)[number];

export const LUCID_HK_SLEEP_GRANULARITIES = [
  'detailed',
  'coarse',
  'mixed',
  'unknown',
] as const;
export type LucidHkSleepGranularity = (typeof LUCID_HK_SLEEP_GRANULARITIES)[number];

export const LUCID_HK_SLEEP_ISSUES = [
  'absent',
  'malformed',
  'non_positive_interval',
  'overlap',
  'contradiction',
  'coarse',
] as const;
export type LucidHkSleepIssueKind = (typeof LUCID_HK_SLEEP_ISSUES)[number];

const CATEGORY_BY_VALUE: Readonly<Record<LucidHkSleepCategoryValue, LucidHkSleepCategory>> = {
  0: 'inBed',
  1: 'asleepUnspecified',
  2: 'awake',
  3: 'asleepCore',
  4: 'asleepDeep',
  5: 'asleepREM',
};

const COARSE_CATEGORIES = new Set<LucidHkSleepCategory>(['inBed', 'asleepUnspecified']);
const DETAILED_CATEGORIES = new Set<LucidHkSleepCategory>([
  'asleepCore',
  'asleepDeep',
  'asleepREM',
]);
const ASLEEP_CATEGORIES = new Set<LucidHkSleepCategory>([
  'asleepUnspecified',
  'asleepCore',
  'asleepDeep',
  'asleepREM',
]);

export type LucidHkSleepIssue = {
  kind: LucidHkSleepIssueKind;
  sampleIds?: string[];
  detail: string;
};

export type LucidHkSleepSampleInput = {
  uuid?: string;
  startDate?: Date | string | number | null;
  endDate?: Date | string | number | null;
  value?: number | null;
  sourceRevision?: {
    source?: { name?: string | null; bundleIdentifier?: string | null } | null;
    sourceId?: string | null;
    version?: string | null;
  } | null;
};

export type LucidHkSleepSample = {
  id: string;
  startMs: number;
  endMs: number;
  categoryValue: LucidHkSleepCategoryValue;
  category: LucidHkSleepCategory;
  sourceName: string | null;
  sourceBundleId: string | null;
};

export type LucidHkSleepNormalization = {
  samples: LucidHkSleepSample[];
  rejected: LucidHkSleepIssue[];
  issues: LucidHkSleepIssue[];
  granularity: LucidHkSleepGranularity;
  sourceNames: string[];
  sourceBundleIds: string[];
  hasOverlaps: boolean;
  hasContradictions: boolean;
  hasCoarseSamples: boolean;
  hasAbsentData: boolean;
};

function isCategoryValue(value: unknown): value is LucidHkSleepCategoryValue {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    (LUCID_HK_SLEEP_CATEGORY_VALUES as readonly number[]).includes(value)
  );
}

function toEpochMs(value: unknown): number | null {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function readSource(input: LucidHkSleepSampleInput): {
  sourceName: string | null;
  sourceBundleId: string | null;
} {
  const source = input.sourceRevision?.source;
  const name = typeof source?.name === 'string' && source.name.trim() ? source.name.trim() : null;
  const bundle =
    typeof source?.bundleIdentifier === 'string' && source.bundleIdentifier.trim()
      ? source.bundleIdentifier.trim()
      : typeof input.sourceRevision?.sourceId === 'string' && input.sourceRevision.sourceId.trim()
        ? input.sourceRevision.sourceId.trim()
        : null;
  return { sourceName: name, sourceBundleId: bundle };
}

function intervalsOverlap(left: LucidHkSleepSample, right: LucidHkSleepSample): boolean {
  return left.startMs < right.endMs && right.startMs < left.endMs;
}

function isAsleepAwakeContradiction(left: LucidHkSleepSample, right: LucidHkSleepSample): boolean {
  const leftAsleep = ASLEEP_CATEGORIES.has(left.category);
  const rightAsleep = ASLEEP_CATEGORIES.has(right.category);
  return (
    intervalsOverlap(left, right) &&
    ((left.category === 'awake' && rightAsleep) || (right.category === 'awake' && leftAsleep))
  );
}

function deriveGranularity(samples: readonly LucidHkSleepSample[]): LucidHkSleepGranularity {
  if (samples.length === 0) return 'unknown';
  const categories = new Set(samples.map((sample) => sample.category));
  const hasDetailed = [...categories].some((category) => DETAILED_CATEGORIES.has(category));
  const hasCoarse = [...categories].some((category) => COARSE_CATEGORIES.has(category));
  if (hasDetailed && hasCoarse) return 'mixed';
  if (hasDetailed) return 'detailed';
  if (hasCoarse) return 'coarse';
  return 'unknown';
}

export function normalizeLucidHkSleepCategoryValue(
  value: unknown
): LucidHkSleepCategory | null {
  return isCategoryValue(value) ? CATEGORY_BY_VALUE[value] : null;
}

export function normalizeLucidHkSleepSamples(
  inputs: readonly LucidHkSleepSampleInput[] | null | undefined
): LucidHkSleepNormalization {
  const samples: LucidHkSleepSample[] = [];
  const rejected: LucidHkSleepIssue[] = [];

  for (const [index, input] of (inputs ?? []).entries()) {
    const category = normalizeLucidHkSleepCategoryValue(input?.value);
    const startMs = toEpochMs(input?.startDate);
    const endMs = toEpochMs(input?.endDate);
    if (category === null || startMs === null || endMs === null) {
      rejected.push({
        kind: 'malformed',
        sampleIds: [typeof input?.uuid === 'string' ? input.uuid : `index:${index}`],
        detail: 'Sample is missing a valid sleepAnalysis value or interval.',
      });
      continue;
    }
    if (endMs <= startMs) {
      rejected.push({
        kind: 'non_positive_interval',
        sampleIds: [typeof input?.uuid === 'string' ? input.uuid : `index:${index}`],
        detail: 'Sleep interval end must be after start.',
      });
      continue;
    }
    const source = readSource(input);
    samples.push({
      id: typeof input.uuid === 'string' && input.uuid.trim() ? input.uuid.trim() : `sample:${index}:${startMs}`,
      startMs,
      endMs,
      categoryValue: input.value as LucidHkSleepCategoryValue,
      category,
      sourceName: source.sourceName,
      sourceBundleId: source.sourceBundleId,
    });
  }

  samples.sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs || left.id.localeCompare(right.id));

  const issues: LucidHkSleepIssue[] = [...rejected];
  const overlapIds = new Set<string>();
  const contradictionIds = new Set<string>();

  for (let i = 0; i < samples.length; i += 1) {
    for (let j = i + 1; j < samples.length; j += 1) {
      const left = samples[i];
      const right = samples[j];
      if (right.startMs >= left.endMs) break;
      if (intervalsOverlap(left, right)) {
        overlapIds.add(left.id);
        overlapIds.add(right.id);
      }
      if (isAsleepAwakeContradiction(left, right)) {
        contradictionIds.add(left.id);
        contradictionIds.add(right.id);
      }
    }
  }

  if (overlapIds.size > 0) {
    issues.push({
      kind: 'overlap',
      sampleIds: [...overlapIds].sort(),
      detail: 'Imported intervals overlap. Overlaps are surfaced, not resolved.',
    });
  }
  if (contradictionIds.size > 0) {
    issues.push({
      kind: 'contradiction',
      sampleIds: [...contradictionIds].sort(),
      detail: 'Asleep and awake categories overlap. Contradiction is surfaced, not inferred away.',
    });
  }

  const granularity = deriveGranularity(samples);
  const hasCoarseSamples = samples.some((sample) => COARSE_CATEGORIES.has(sample.category));
  if (hasCoarseSamples) {
    issues.push({
      kind: 'coarse',
      sampleIds: samples
        .filter((sample) => COARSE_CATEGORIES.has(sample.category))
        .map((sample) => sample.id),
      detail: 'Some samples are inBed or asleepUnspecified only. They are not REM detection.',
    });
  }
  const hasAbsentData = samples.length === 0;
  if (hasAbsentData) {
    issues.push({
      kind: 'absent',
      detail: 'No usable sleepAnalysis samples were present in this query window.',
    });
  }

  const sourceNames = [...new Set(samples.map((sample) => sample.sourceName).filter((value): value is string => Boolean(value)))].sort();
  const sourceBundleIds = [
    ...new Set(samples.map((sample) => sample.sourceBundleId).filter((value): value is string => Boolean(value))),
  ].sort();

  return {
    samples,
    rejected,
    issues,
    granularity,
    sourceNames,
    sourceBundleIds,
    hasOverlaps: overlapIds.size > 0,
    hasContradictions: contradictionIds.size > 0,
    hasCoarseSamples,
    hasAbsentData,
  };
}
