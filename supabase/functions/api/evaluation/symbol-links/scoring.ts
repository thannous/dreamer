/** Pure scoring for the symbol-link bench. No I/O, no credentials. */
import type { KnownDreamSymbol } from '../../lib/dreamSymbols.ts';
import type { ClaudeUsage } from '../../services/claude.ts';
import { sanitizeAnalysisDetails } from '../../services/dreamAnalysis.ts';
import type { SymbolLinkCase, SymbolLinkKind } from './cases.ts';

/** A symbol of a reading with the link the app would follow: `d:<dictionary id>` or `p:<personal key>`. */
export type ScoredSymbol = { name: string; symbolId?: string; key?: string; link: string | null };

/**
 * Every symbol of a parsed response, normalized one by one exactly as production stores
 * a symbol, but before the reading's dedupe and its cap of six, so duplicates stay visible.
 */
export const scoredSymbols = (response: unknown): ScoredSymbol[] => {
  const symbols = (response as { symbols?: unknown } | null)?.symbols;
  if (!Array.isArray(symbols)) return [];
  return symbols
    .flatMap((entry) => sanitizeAnalysisDetails({ symbols: [entry] }).symbols)
    .map(({ name, symbolId, key }) => ({
      name,
      ...(symbolId ? { symbolId } : {}),
      ...(key ? { key } : {}),
      link: symbolId ? `d:${symbolId}` : key ? `p:${key}` : null,
    }));
};

const targetsOf = (symbols: readonly ScoredSymbol[], target: RegExp): ScoredSymbol[] =>
  symbols.filter((symbol) => target.test(symbol.name));

const linksOf = (symbols: readonly ScoredSymbol[]): Set<string> =>
  new Set(symbols.flatMap((symbol) => (symbol.link ? [symbol.link] : [])));

/** Symbols whose link already appeared earlier in the same reading. */
export const duplicateCount = (symbols: readonly ScoredSymbol[]): number => {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const { link } of symbols) {
    if (!link) continue;
    if (seen.has(link)) duplicates += 1;
    else seen.add(link);
  }
  return duplicates;
};

const sameName = (a: string, b: string): boolean =>
  a.replace(/\s+/g, ' ').trim().toLocaleLowerCase() === b.replace(/\s+/g, ' ').trim().toLocaleLowerCase();

export type PairOutcome = {
  targetInA: boolean;
  /** B names its target, or one of B's symbols carries A's target link. */
  targetInB: boolean;
  /**
   * A symbol of B carries one of the links of A's target: the thread the app would draw.
   * Expected for same and return pairs; a false link for trap pairs.
   */
  linked: boolean;
  /** dictionary: sides whose target was found, and those resolving to the expected id. */
  dictionaryTargets: number;
  dictionaryHits: number;
  duplicates: number;
  unlinked: number;
  /** Words in each personal key of both readings. */
  keyWords: number[];
  /** Symbols of B that reuse a known key, and those that also keep its name. */
  reusedKeys: number;
  keptNames: number;
};

/** The outcome of one pair of readings: A without known symbols, B with those A yielded. */
export const scorePair = (
  testCase: Pick<SymbolLinkCase, 'a' | 'b' | 'expectedSymbolId'>,
  symbolsA: readonly ScoredSymbol[],
  symbolsB: readonly ScoredSymbol[],
  knownForB: readonly KnownDreamSymbol[]
): PairOutcome => {
  const targetsA = targetsOf(symbolsA, testCase.a.target);
  const targetsB = targetsOf(symbolsB, testCase.b.target);
  const linksA = linksOf(targetsA);
  // Any symbol of B, not only those its pattern names: a reused link is a thread whatever B calls it.
  const linked = symbolsB.some((symbol) => symbol.link !== null && linksA.has(symbol.link));
  const expected = testCase.expectedSymbolId;
  const sides = [targetsA, targetsB].filter((targets) => targets.length > 0);
  const knownNames = new Map(knownForB.map((known) => [known.key, known.name]));
  const reused = symbolsB.filter((symbol) => symbol.key !== undefined && knownNames.has(symbol.key));
  return {
    targetInA: targetsA.length > 0,
    targetInB: targetsB.length > 0 || linked,
    linked,
    dictionaryTargets: expected ? sides.length : 0,
    dictionaryHits: expected ? sides.filter((targets) => targets.some((symbol) => symbol.symbolId === expected)).length : 0,
    duplicates: duplicateCount(symbolsA) + duplicateCount(symbolsB),
    unlinked: [...symbolsA, ...symbolsB].filter((symbol) => symbol.link === null).length,
    keyWords: [...symbolsA, ...symbolsB].flatMap((symbol) => (symbol.key ? [symbol.key.split('-').length] : [])),
    reusedKeys: reused.length,
    keptNames: reused.filter((symbol) => sameName(symbol.name, knownNames.get(symbol.key!)!)).length,
  };
};

/** Haiku 5.5 list prices in USD per million tokens, prompts of 100K tokens or fewer. */
export const HAIKU_5_5_USD_PER_MTOK = {
  input: 0.1,
  output: 0.5,
  cacheRead: 0.01,
  cacheWrite5m: 0.125,
  source: 'claude-api skill reference, read 2026-10-18; check the live pricing page before budgeting',
} as const;

export type UsageTotals = { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };

export const addUsage = (totals: UsageTotals, usage: ClaudeUsage | null | undefined): UsageTotals => ({
  inputTokens: totals.inputTokens + (usage?.input_tokens ?? 0),
  outputTokens: totals.outputTokens + (usage?.output_tokens ?? 0),
  cacheReadTokens: totals.cacheReadTokens + (usage?.cache_read_input_tokens ?? 0),
  cacheWriteTokens: totals.cacheWriteTokens + (usage?.cache_creation_input_tokens ?? 0),
});

export const EMPTY_USAGE: UsageTotals = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

export const costUsd = (usage: UsageTotals): number =>
  (usage.inputTokens * HAIKU_5_5_USD_PER_MTOK.input +
    usage.outputTokens * HAIKU_5_5_USD_PER_MTOK.output +
    usage.cacheReadTokens * HAIKU_5_5_USD_PER_MTOK.cacheRead +
    usage.cacheWriteTokens * HAIKU_5_5_USD_PER_MTOK.cacheWrite5m) / 1_000_000;

/** A share with its counts; `rate` is null when nothing was counted. */
export type Ratio = { hits: number; total: number; rate: number | null };
const ratio = (hits: number, total: number): Ratio => ({ hits, total, rate: total ? hits / total : null });

export type ScoredPair = { kind: SymbolLinkKind; outcome: PairOutcome };

export type VariantMetrics = {
  pairs: number;
  /** Pairs whose A target was missing: they cannot test a link and leave the rates below. */
  targetMissingInA: Record<SymbolLinkKind, number>;
  linkRecall: { same: Ratio; return: Ratio };
  omission: { same: Ratio; return: Ratio };
  falseLinks: Ratio;
  dictionaryPrecision: Ratio;
  readings: number;
  duplicatesPerReading: number | null;
  unlinkedSymbols: number;
  meanKeyWords: number | null;
  keptNameOnReuse: Ratio;
};

/** Metrics of one prompt variant over its completed pairs. */
export const summarizeVariant = (pairs: readonly ScoredPair[]): VariantMetrics => {
  const ofKind = (kind: SymbolLinkKind) => pairs.filter((pair) => pair.kind === kind).map((pair) => pair.outcome);
  const withA = (kind: SymbolLinkKind) => ofKind(kind).filter((outcome) => outcome.targetInA);
  const recall = (kind: SymbolLinkKind) => ratio(withA(kind).filter((outcome) => outcome.linked).length, withA(kind).length);
  const omission = (kind: SymbolLinkKind) => ratio(withA(kind).filter((outcome) => !outcome.targetInB).length, withA(kind).length);
  const all = pairs.map((pair) => pair.outcome);
  const sum = (pick: (outcome: PairOutcome) => number) => all.reduce((total, outcome) => total + pick(outcome), 0);
  const keyWords = all.flatMap((outcome) => outcome.keyWords);
  const readings = pairs.length * 2;
  return {
    pairs: pairs.length,
    targetMissingInA: {
      same: ofKind('same').length - withA('same').length,
      return: ofKind('return').length - withA('return').length,
      trap: ofKind('trap').length - withA('trap').length,
      dictionary: ofKind('dictionary').length - withA('dictionary').length,
    },
    linkRecall: { same: recall('same'), return: recall('return') },
    omission: { same: omission('same'), return: omission('return') },
    falseLinks: ratio(withA('trap').filter((outcome) => outcome.linked).length, withA('trap').length),
    dictionaryPrecision: ratio(sum((outcome) => outcome.dictionaryHits), sum((outcome) => outcome.dictionaryTargets)),
    readings,
    duplicatesPerReading: readings ? sum((outcome) => outcome.duplicates) / readings : null,
    unlinkedSymbols: sum((outcome) => outcome.unlinked),
    meanKeyWords: keyWords.length ? keyWords.reduce((total, words) => total + words, 0) / keyWords.length : null,
    keptNameOnReuse: ratio(sum((outcome) => outcome.keptNames), sum((outcome) => outcome.reusedKeys)),
  };
};

/**
 * The line numbers where two prompts differ, or null when their line counts differ. The
 * bench compares prompts that should differ on the link-fields line only.
 */
export const differingLines = (baseline: string, candidate: string): number[] | null => {
  const before = baseline.split('\n');
  const after = candidate.split('\n');
  if (before.length !== after.length) return null;
  return before.flatMap((line, index) => (line === after[index] ? [] : [index]));
};

export const LINK_FIELDS_LINE_PREFIX = '  Each symbol also carries two link fields';

/** True when the prompts differ, and only on the link-fields line. */
export const differOnlyOnLinkFields = (baseline: string, candidate: string): boolean => {
  const lines = differingLines(baseline, candidate);
  if (!lines?.length) return false;
  const after = candidate.split('\n');
  const before = baseline.split('\n');
  return lines.every((index) => after[index].startsWith(LINK_FIELDS_LINE_PREFIX) && before[index].startsWith(LINK_FIELDS_LINE_PREFIX));
};

/** The "symbols" item of a prompt: from its line to the next key's line. */
export const symbolsParagraph = (prompt: string): string => {
  const lines = prompt.split('\n');
  const start = lines.findIndex((line) => line.startsWith('- "symbols":'));
  if (start < 0) return '';
  const end = lines.findIndex((line, index) => index > start && line.startsWith('- "'));
  return lines.slice(start, end < 0 ? undefined : end).join('\n');
};
