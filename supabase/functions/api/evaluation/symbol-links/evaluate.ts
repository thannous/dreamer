/**
 * Symbol-link bench, synthetic pairs only (see README.md).
 *
 * For each run, case and prompt variant: dream A is analyzed without known symbols, its
 * stored reading yields the known symbols (`collectKnownDreamSymbols`, as the analysis
 * worker does), and dream B is analyzed with them. Calls go through `requestClaudeJson`
 * exactly as production analysis does, with no retries and a hard request cap.
 *
 * Variants: `baseline` (frozen master prompt, ./baseline-prompt.ts) and `candidate`
 * (the current `buildAnalysisPrompt`). `--dry-run` sends nothing.
 */
import { aiLanguageName } from '../../lib/aiLanguage.ts';
import { LEGACY_DREAM_THEMES } from '../../lib/dreamThemes.ts';
import { collectKnownDreamSymbols, type KnownDreamSymbol } from '../../lib/dreamSymbols.ts';
import { CLAUDE_MODELS } from '../../lib/models.ts';
import { ANALYZE_DREAM_SCHEMA, withDreamThemes } from '../../lib/schemas.ts';
import { ClaudeStopError, requestClaudeJson, type ClaudeUsage } from '../../services/claude.ts';
import {
  ANALYSIS_PROMPT_VERSION,
  analysisSystemInstruction,
  buildAnalysisPrompt,
  type DreamAnalysisSymbol,
  keepAcceptedQuoteExcerpts,
  normalizeDreamAnalysis,
} from '../../services/dreamAnalysis.ts';
import { atomicWriteJson } from '../ti559/core.ts';
import { BASELINE_PROMPT_VERSION, buildBaselineAnalysisPrompt } from './baseline-prompt.ts';
import { SYMBOL_LINK_CASES, SYMBOL_LINK_KINDS, type SymbolLinkCase, validateCases } from './cases.ts';
import {
  addUsage,
  costUsd,
  differingLines,
  differOnlyOnLinkFields,
  EMPTY_USAGE,
  HAIKU_5_5_USD_PER_MTOK,
  type PairOutcome,
  type Ratio,
  scorePair,
  type ScoredSymbol,
  scoredSymbols,
  summarizeVariant,
  symbolsParagraph,
  type UsageTotals,
  type VariantMetrics,
} from './scoring.ts';

const VARIANTS = ['baseline', 'candidate'] as const;
type Variant = typeof VARIANTS[number];
const PROMPTS: Record<Variant, typeof buildAnalysisPrompt> = { baseline: buildBaselineAnalysisPrompt, candidate: buildAnalysisPrompt };
const PROMPT_VERSIONS: Record<Variant, string> = { baseline: BASELINE_PROMPT_VERSION, candidate: ANALYSIS_PROMPT_VERSION };

const DEFAULT_RUNS = 2;
const MAX_RUNS = 10;
/** Pairs analyzed at once; each pair is sequential (B needs A's symbols). */
const CONCURRENCY = 4;
// The worker passes no themes, so its readings use the legacy four.
const THEMES = LEGACY_DREAM_THEMES;
const SCHEMA = withDreamThemes(ANALYZE_DREAM_SCHEMA, THEMES);
const USAGE = 'Usage: evaluate.ts [--runs=N] (--dry-run | --output=<new absolute directory outside the repository>)';

const parseArgs = (args: readonly string[]) => {
  let runs = DEFAULT_RUNS;
  let output: string | undefined;
  let dryRun = false;
  for (const arg of args) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('--runs=')) {
      runs = Number(arg.slice('--runs='.length));
      if (!Number.isInteger(runs) || runs < 1 || runs > MAX_RUNS) throw new Error(`--runs must be an integer from 1 to ${MAX_RUNS}.`);
    } else if (arg.startsWith('--output=') && arg.length > '--output='.length) output = arg.slice('--output='.length);
    else throw new Error(USAGE);
  }
  if (!dryRun && !output) throw new Error(`A real run needs --output. ${USAGE}`);
  return { runs, output, dryRun };
};

/** Results stay out of Git: an absolute path outside this checkout, never one that exists. */
const prepareOutput = async (output: string): Promise<string> => {
  const path = output.replace(/\/+$/, '');
  if (!path.startsWith('/') || path.split('/').includes('..')) throw new Error('--output must be an absolute path without "..".');
  const repoRoot = decodeURIComponent(new URL('../../../../../', import.meta.url).pathname).replace(/\/+$/, '');
  if (path === repoRoot || path.startsWith(`${repoRoot}/`)) throw new Error('--output must be outside the repository.');
  const exists = await Deno.lstat(path).then(() => true, (error) => {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  });
  // A new directory prevents overwriting, or silently repeating, a paid run.
  if (exists) throw new Error('--output already exists; choose a new directory.');
  await Deno.mkdir(path, { recursive: true, mode: 0o700 });
  return path;
};

type Job = { run: number; testCase: SymbolLinkCase; variant: Variant };

/** Both variants of a case run next to each other, the first one alternating. */
const planJobs = (cases: readonly SymbolLinkCase[], runs: number): Job[] =>
  Array.from({ length: runs }, (_, run) => cases.flatMap((testCase, index) => {
    const order = (run + index) % 2 === 0 ? VARIANTS : [...VARIANTS].reverse();
    return order.map((variant) => ({ run: run + 1, testCase, variant }));
  })).flat();

type CallRecord = {
  status: 'ok' | 'invalid' | 'error';
  /** Stop reason, HTTP status or invalid part; never an error message (it can carry content). */
  detail: string | null;
  milliseconds: number;
  usage: ClaudeUsage | null;
  rawText?: string;
  /** Every symbol as answered, normalized, before the reading's dedupe. */
  symbols?: ScoredSymbol[];
  /** The symbols production stores (deduplicated, at most six). */
  stored?: DreamAnalysisSymbol[];
};

type PairRecord = {
  run: number;
  caseId: string;
  kind: SymbolLinkCase['kind'];
  lang: SymbolLinkCase['lang'];
  variant: Variant;
  knownForB: KnownDreamSymbol[];
  a: CallRecord;
  b: CallRecord | null;
  outcome: PairOutcome | null;
};

const analyze = async (apiKey: string, variant: Variant, transcript: string, lang: string, knownSymbols: readonly KnownDreamSymbol[]): Promise<CallRecord> => {
  const { model, effort } = CLAUDE_MODELS.analysis;
  const prompt = PROMPTS[variant](transcript, aiLanguageName(lang), false, THEMES, knownSymbols);
  const start = performance.now();
  const elapsed = () => Math.round(performance.now() - start);
  let text: string;
  let usage: ClaudeUsage | null;
  try {
    // Production's call: same system instruction, schema, model, effort and default timeout.
    ({ text, usage } = await requestClaudeJson({ apiKey, model, effort, system: analysisSystemInstruction(lang), prompt, schema: SCHEMA }));
  } catch (error) {
    const status = (error as { status?: unknown })?.status;
    // The class name (a timeout, a connection error) is safe to keep; the message is not.
    const name = (error as { name?: unknown })?.name;
    const detail = error instanceof ClaudeStopError
      ? `stop: ${error.stopReason}`
      : typeof status === 'number' ? `http ${status}` : typeof name === 'string' && /^\w{1,64}$/.test(name) ? name : 'request failed';
    return { status: 'error', detail, milliseconds: elapsed(), usage: null };
  }
  const milliseconds = elapsed();
  let response: Record<string, unknown>;
  try {
    response = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { status: 'invalid', detail: 'json', milliseconds, usage, rawText: text };
  }
  try {
    const delivered = normalizeDreamAnalysis(keepAcceptedQuoteExcerpts(response), { transcript, lang, themes: THEMES });
    return { status: 'ok', detail: null, milliseconds, usage, rawText: text, symbols: scoredSymbols(response), stored: delivered.symbols };
  } catch {
    // Production would fall back to Gemini on this answer.
    return { status: 'invalid', detail: 'missing title or interpretation', milliseconds, usage, rawText: text, symbols: scoredSymbols(response) };
  }
};

const runPair = async (apiKey: string, { run, testCase, variant }: Job): Promise<PairRecord> => {
  const record: PairRecord = {
    run, caseId: testCase.id, kind: testCase.kind, lang: testCase.lang, variant, knownForB: [], a: await analyze(apiKey, variant, testCase.a.transcript, testCase.lang, []), b: null, outcome: null,
  };
  if (record.a.status !== 'ok') return record;
  // What the worker would load for the next dream: the stored reading's personal symbols.
  record.knownForB = collectKnownDreamSymbols([{ symbols: record.a.stored }]);
  record.b = await analyze(apiKey, variant, testCase.b.transcript, testCase.lang, record.knownForB);
  if (record.b.status === 'ok') record.outcome = scorePair(testCase, record.a.symbols!, record.b.symbols!, record.knownForB);
  return record;
};

const pairLabel = (record: PairRecord): string => {
  if (!record.outcome) return `failed (${record.b?.detail ?? record.a.detail})`;
  if (!record.outcome.targetInA) return 'A target missing';
  if (record.kind === 'trap') return record.outcome.linked ? 'false link' : 'kept apart';
  if (record.kind === 'dictionary') return `expected id ${record.outcome.dictionaryHits}/${record.outcome.dictionaryTargets}`;
  return record.outcome.linked ? 'linked' : record.outcome.targetInB ? 'not linked' : 'omitted in B';
};

const percent = ({ hits, total, rate }: Ratio): string => (rate === null ? 'n/a' : `${Math.round(rate * 100)}% (${hits}/${total})`);
const decimal = (value: number | null, digits = 2): string => (value === null ? 'n/a' : value.toFixed(digits));
const tokens = (value: number): string => value.toLocaleString('en-US');

const caseCell = (testCase: SymbolLinkCase, records: readonly PairRecord[]): string => {
  const done = records.filter((record) => record.outcome).map((record) => record.outcome!);
  const withA = done.filter((outcome) => outcome.targetInA);
  const parts = [
    testCase.kind === 'dictionary'
      ? `expected id ${done.reduce((sum, outcome) => sum + outcome.dictionaryHits, 0)}/${done.reduce((sum, outcome) => sum + outcome.dictionaryTargets, 0)}`
      : `${testCase.kind === 'trap' ? 'false link' : 'linked'} ${withA.filter((outcome) => outcome.linked).length}/${withA.length}`,
  ];
  if (done.length > withA.length) parts.push(`A target missing ${done.length - withA.length}`);
  if (records.length > done.length) parts.push(`failed ${records.length - done.length}`);
  return parts.join(', ');
};

const summaryMarkdown = (report: {
  startedAt: string; finishedAt: string; runs: number; cases: readonly SymbolLinkCase[]; calls: number; failedCalls: number;
  metrics: Record<Variant, VariantMetrics>; usage: Record<Variant, UsageTotals>; pairs: readonly PairRecord[];
}): string => {
  const { metrics: m, usage } = report;
  const row = (label: string, cell: (variant: Variant) => string) => `| ${label} | ${cell('baseline')} | ${cell('candidate')} |`;
  return [
    '# Symbol-link bench',
    '',
    `Synthetic pairs only. ${CLAUDE_MODELS.analysis.model}, effort ${CLAUDE_MODELS.analysis.effort}, the production analysis call.`,
    `${report.startedAt} to ${report.finishedAt}: ${report.runs} runs x ${report.cases.length} cases x 2 variants, ${report.calls} calls, ${report.failedCalls} failed or invalid.`,
    `Baseline: ${PROMPT_VERSIONS.baseline} (frozen copy). Candidate: ${PROMPT_VERSIONS.candidate}.`,
    '',
    '| Metric | Baseline | Candidate |',
    '| --- | --- | --- |',
    row('Link recall, same pairs', (v) => percent(m[v].linkRecall.same)),
    row('Link recall, return pairs', (v) => percent(m[v].linkRecall.return)),
    row('Target omitted in B, same pairs', (v) => percent(m[v].omission.same)),
    row('Target omitted in B, return pairs', (v) => percent(m[v].omission.return)),
    row('False links, trap pairs', (v) => percent(m[v].falseLinks)),
    row('Dictionary precision', (v) => percent(m[v].dictionaryPrecision)),
    row('Duplicate symbols per reading', (v) => decimal(m[v].duplicatesPerReading)),
    row('Symbols without a link', (v) => String(m[v].unlinkedSymbols)),
    row('Mean personal key length (words)', (v) => decimal(m[v].meanKeyWords)),
    row('Known name kept when its key is reused', (v) => percent(m[v].keptNameOnReuse)),
    row('Pairs whose A reading missed the target', (v) => SYMBOL_LINK_KINDS.map((kind) => `${kind} ${m[v].targetMissingInA[kind]}`).join(', ')),
    row('Input / output tokens', (v) => `${tokens(usage[v].inputTokens)} / ${tokens(usage[v].outputTokens)}`),
    row('Cost (USD, list price)', (v) => costUsd(usage[v]).toFixed(3)),
    '',
    'Link, omission and false-link rates count completed pairs whose A reading named the target; dictionary precision counts every reading that named it. Failed calls carry no token counts.',
    `Prices: ${HAIKU_5_5_USD_PER_MTOK.input} / ${HAIKU_5_5_USD_PER_MTOK.output} USD per million input / output tokens (${HAIKU_5_5_USD_PER_MTOK.source}).`,
    '',
    '## Per case',
    '',
    '| Case | Kind | Baseline | Candidate |',
    '| --- | --- | --- | --- |',
    ...report.cases.map((testCase) => {
      const of = (variant: Variant) => report.pairs.filter((record) => record.caseId === testCase.id && record.variant === variant);
      return `| ${testCase.id} | ${testCase.kind} | ${caseCell(testCase, of('baseline'))} | ${caseCell(testCase, of('candidate'))} |`;
    }),
    '',
  ].join('\n');
};

if (import.meta.main) {
  const { runs, output, dryRun } = parseArgs(Deno.args);
  const cases = validateCases(SYMBOL_LINK_CASES);
  const jobs = planJobs(cases, runs);
  const maxRequests = jobs.length * 2;
  const sample = cases[0];
  const samplePrompt = (variant: Variant, known: readonly KnownDreamSymbol[] = []) =>
    PROMPTS[variant](sample.a.transcript, aiLanguageName(sample.lang), false, THEMES, known);
  const sampleKnown = [{ key: 'lighthouse', name: 'Le phare' }];
  const promptsComparable = differOnlyOnLinkFields(samplePrompt('baseline'), samplePrompt('candidate')) &&
    differOnlyOnLinkFields(samplePrompt('baseline', sampleKnown), samplePrompt('candidate', sampleKnown));
  console.log(JSON.stringify({
    bench: 'symbol-links',
    model: CLAUDE_MODELS.analysis.model,
    effort: CLAUDE_MODELS.analysis.effort,
    promptVersions: PROMPT_VERSIONS,
    runs,
    cases: cases.length,
    casesByKind: Object.fromEntries(SYMBOL_LINK_KINDS.map((kind) => [kind, cases.filter((testCase) => testCase.kind === kind).length])),
    casesByLanguage: { fr: cases.filter((testCase) => testCase.lang === 'fr').length, en: cases.filter((testCase) => testCase.lang === 'en').length },
    pairsPerVariant: jobs.length / VARIANTS.length,
    calls: maxRequests,
    callsPerVariant: maxRequests / VARIANTS.length,
    concurrency: CONCURRENCY,
    promptsDifferOnlyOnLinkFieldsLine: promptsComparable,
    differingPromptLines: differingLines(samplePrompt('baseline'), samplePrompt('candidate')),
    samplePromptCharacters: { baseline: samplePrompt('baseline').length, candidate: samplePrompt('candidate').length },
    dryRun,
    output: output ?? null,
  }, null, 2));
  if (dryRun) {
    for (const variant of VARIANTS) console.log(`\n--- ${variant} symbols paragraph (case ${sample.id}, dream A) ---\n${symbolsParagraph(samplePrompt(variant))}`);
    Deno.exit(0);
  }
  if (!promptsComparable) throw new Error('The variants must differ on the link-fields line only; update the bench before a paid run.');
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim().replace(/^(['"])(.*)\1$/, '$2');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set. Nothing was sent.');
  const directory = await prepareOutput(output!);

  let requests = 0;
  const realFetch = globalThis.fetch;
  // --allow-net already limits the host; this caps the spend at the planned calls.
  globalThis.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.protocol !== 'https:' || url.hostname !== 'api.anthropic.com') return Promise.reject(new Error('Unexpected endpoint blocked.'));
    if (requests >= maxRequests) return Promise.reject(new Error(`Hard limit of ${maxRequests} requests reached.`));
    requests += 1;
    return realFetch(input, init);
  };

  const startedAt = new Date().toISOString();
  const pairs: PairRecord[] = [];
  const report = () => {
    const metrics = Object.fromEntries(VARIANTS.map((variant) => [variant, summarizeVariant(
      pairs.filter((record) => record.variant === variant && record.outcome).map((record) => ({ kind: record.kind, outcome: record.outcome! }))
    )])) as Record<Variant, VariantMetrics>;
    const usage = Object.fromEntries(VARIANTS.map((variant) => [variant, pairs
      .filter((record) => record.variant === variant)
      .flatMap((record) => [record.a, ...(record.b ? [record.b] : [])])
      .reduce((totals, call) => addUsage(totals, call.usage), EMPTY_USAGE)])) as Record<Variant, UsageTotals>;
    const calls = pairs.flatMap((record) => [record.a, ...(record.b ? [record.b] : [])]);
    return { metrics, usage, calls: calls.length, failedCalls: calls.filter((call) => call.status !== 'ok').length };
  };
  // Saves run one after another so an older snapshot never replaces a newer one.
  let saving = Promise.resolve();
  const save = (finishedAt: string | null) => {
    saving = saving.then(() => {
      const { metrics, usage, calls, failedCalls } = report();
      return atomicWriteJson(`${directory}/results.json`, {
        bench: 'symbol-links', startedAt, finishedAt, model: CLAUDE_MODELS.analysis, promptVersions: PROMPT_VERSIONS, runs,
        requests, maxRequests, calls, failedCalls, prices: HAIKU_5_5_USD_PER_MTOK, metrics, usage,
        costUsd: Object.fromEntries(VARIANTS.map((variant) => [variant, costUsd(usage[variant])])),
        pairs,
      });
    });
    return saving;
  };

  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const record = await runPair(apiKey, job);
      pairs.push(record);
      console.log(`${pairs.length}/${jobs.length} run ${record.run} ${record.caseId} ${record.variant}: ${pairLabel(record)}`);
      await save(null);
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
  } finally {
    globalThis.fetch = realFetch;
  }
  const finishedAt = new Date().toISOString();
  pairs.sort((a, b) => a.run - b.run || a.caseId.localeCompare(b.caseId) || a.variant.localeCompare(b.variant));
  await save(finishedAt);
  const { metrics, usage, calls, failedCalls } = report();
  await Deno.writeTextFile(`${directory}/summary.md`, summaryMarkdown({ startedAt, finishedAt, runs, cases, calls, failedCalls, metrics, usage, pairs }), { mode: 0o600, createNew: true });
  console.log(`Saved results.json and summary.md (${calls} calls, ${failedCalls} failed or invalid).`);
  if (failedCalls > 0) Deno.exitCode = 1;
}
