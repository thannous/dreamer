// Where a finished run spent its time, read from its report.json (schema report-1):
// the slowest files, tests and steps, time by step API, the slow steps that repeat,
// and the size of the artifacts. With a second report it sets two runs side by side.
// It reads the report only; the run's verdict stays the runner's.
//
//   node tools/e2e/timings.mjs <report.json | run directory | product-platform> [other] [--top n] [--slow ms] [--json]
//
// A product-platform such as `dreamer-web` is the last full run of that campaign,
// kept in $(git rev-parse --git-common-dir)/verify-cache/e2e-durations/ (duration-history.mjs).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const CAMPAIGN = /^[a-z]+-[a-z]+$/;

export const keptReports = commonDir => join(commonDir, 'verify-cache', 'e2e-durations');

const gitCommonDir = () => execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: here, encoding: 'utf8' }).trim();

/** The report an argument names: a report file, a run directory holding one, or a kept campaign. */
export function resolveReport(arg, commonDir = gitCommonDir) {
  if (existsSync(arg)) {
    const path = statSync(arg).isDirectory() ? join(arg, 'report.json') : arg;
    if (!existsSync(path)) throw new Error(`${arg} holds no report.json.`);
    return path;
  }
  if (!CAMPAIGN.test(arg)) throw new Error(`${arg} is neither a report, a run directory nor a product-platform such as dreamer-web.`);
  const dir = keptReports(typeof commonDir === 'function' ? commonDir() : commonDir);
  const path = join(dir, `${arg}.report.json`);
  if (existsSync(path)) return path;
  const kept = existsSync(dir) ? readdirSync(dir).filter(name => name.endsWith('.report.json')).map(name => name.slice(0, -'.report.json'.length)) : [];
  throw new Error(`No kept report for ${arg}. Kept: ${kept.join(', ') || 'none'}.`);
}

export function readReport(path) {
  const report = JSON.parse(readFileSync(path, 'utf8'));
  if (!report?.run?.results) throw new Error(`${path} is not a TesterArmy report.`);
  return report;
}

const attemptsMs = result => (result.attempts ?? []).reduce((sum, attempt) => sum + (attempt.durationMs ?? 0), 0);
const where = step => step.source?.file ? `${step.source.file}:${step.source.line}` : '';
const byMs = (a, b) => b.ms - a.ms;

/** Adds `ms` to the entry of `map` at `key`, created by `make`. */
function add(map, key, ms, make = () => ({})) {
  if (!map.has(key)) map.set(key, { ...make(), ms: 0, count: 0 });
  const entry = map.get(key);
  entry.ms += ms;
  entry.count += 1;
  return entry;
}

/** What one report says about where its run spent its time. `top` bounds each list; `slow` (ms) picks the slow steps. */
export function summarise(report, { top = 10, slow = 3000 } = {}) {
  const { run } = report;
  const results = run.results ?? [];
  const steps = results.flatMap(result => (result.attempts ?? []).flatMap(attempt => (attempt.steps ?? []).map(step => ({ step, result }))));
  const artifacts = results.flatMap(result => (result.attempts ?? []).flatMap(attempt => attempt.artifacts ?? []));

  const files = new Map();
  for (const result of results) add(files, result.file, attemptsMs(result), () => ({ file: result.file }));
  const apis = new Map();
  for (const { step } of steps) add(apis, step.api, step.durationMs ?? 0, () => ({ api: step.api }));
  // The same slow wait repeated: one entry per API and label, with where it is written.
  const groups = new Map();
  for (const { step } of steps.filter(({ step }) => (step.durationMs ?? 0) >= slow)) {
    const group = add(groups, `${step.api}\n${step.label ?? ''}`, step.durationMs, () => ({ api: step.api, label: step.label ?? '', sources: new Set() }));
    if (where(step)) group.sources.add(where(step));
  }
  const kinds = new Map();
  for (const artifact of artifacts) {
    const kind = add(kinds, artifact.kind, 0, () => ({ kind: artifact.kind, bytes: 0 }));
    kind.bytes += artifact.size ?? 0;
  }

  const wallMs = Date.parse(run.finishedAt) - Date.parse(run.startedAt);
  return {
    run: {
      status: run.status,
      summary: run.summary,
      wallMs: Number.isFinite(wallMs) ? wallMs : null,
      testMs: results.reduce((sum, result) => sum + attemptsMs(result), 0),
      artifactBytes: run.usage?.artifactBytes ?? artifacts.reduce((sum, artifact) => sum + (artifact.size ?? 0), 0),
      files: files.size,
    },
    files: [...files.values()].sort(byMs).slice(0, top).map(({ file, ms, count }) => ({ file, ms, tests: count })),
    tests: results.map(result => ({ file: result.file, title: (result.titlePath ?? []).join(' › '), status: result.status, attempts: result.attempts?.length ?? 0, ms: attemptsMs(result) }))
      .sort(byMs).slice(0, top),
    apis: [...apis.values()].sort(byMs),
    steps: steps.map(({ step, result }) => ({ api: step.api, label: step.label ?? '', status: step.status, ms: step.durationMs ?? 0, source: where(step), test: (result.titlePath ?? []).join(' › ') }))
      .sort(byMs).slice(0, top),
    slow: { thresholdMs: slow, groups: [...groups.values()].sort(byMs).slice(0, top).map(group => ({ ...group, sources: [...group.sources].sort() })) },
    artifacts: [...kinds.values()].sort((a, b) => b.bytes - a.bytes).map(({ kind, count, bytes }) => ({ kind, count, bytes })),
  };
}

/** Two summaries side by side: the run's figures and the time of each step API, before and after. */
export function compare(before, after) {
  const figure = key => ({ before: before.run[key], after: after.run[key], delta: after.run[key] - before.run[key] });
  const apis = new Map();
  for (const [side, summary] of [['before', before], ['after', after]]) {
    for (const { api, ms, count } of summary.apis) {
      if (!apis.has(api)) apis.set(api, { api, before: { ms: 0, count: 0 }, after: { ms: 0, count: 0 } });
      apis.get(api)[side] = { ms, count };
    }
  }
  return {
    status: { before: before.run.status, after: after.run.status },
    executed: { before: before.run.summary?.executed, after: after.run.summary?.executed },
    files: figure('files'),
    wallMs: figure('wallMs'),
    testMs: figure('testMs'),
    artifactBytes: figure('artifactBytes'),
    apis: [...apis.values()].map(row => ({ ...row, deltaMs: row.after.ms - row.before.ms }))
      .sort((a, b) => Math.max(b.before.ms, b.after.ms) - Math.max(a.before.ms, a.after.ms)),
  };
}

export const seconds = ms => ms == null ? '?' : ms >= 100_000 ? `${Math.round(ms / 1000)} s` : `${(ms / 1000).toFixed(1)} s`;
export const megabytes = bytes => `${(bytes / 1e6).toFixed(1)} MB`;
const signed = (value, unit) => `${value > 0 ? '+' : value < 0 ? '-' : '±'}${unit(Math.abs(value))}`;
const clip = (text, width = 90) => text.length > width ? `${text.slice(0, width - 1)}…` : text;
// Columns of figures align right, text columns left; the last column is never padded.
// A run with nothing to list (every test skipped, or `--top 0`) still prints its other sections.
const table = (rows, header = false) => {
  if (rows.length === (header ? 1 : 0)) return ['  none'];
  const widths = rows[0].map((_, at) => Math.max(...rows.map(row => String(row[at]).length)));
  const figures = rows[0].map((_, at) => rows.slice(header ? 1 : 0).every(row => /^[-+±\d?(]|^$/.test(String(row[at]))));
  return rows.map(row => row.map((cell, at) => at === row.length - 1 ? cell
    : figures[at] ? String(cell).padStart(widths[at]) : String(cell).padEnd(widths[at])).join('  ').trimEnd());
};
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
/** The first `top` rows, and a line for the others. */
const firstOf = (rows, top, rest) => rows.length > top ? [...rows.slice(0, top), rest(rows.slice(top))] : rows;

export function formatSummary(summary, top = 10) {
  const { run } = summary;
  const counts = Object.entries(run.summary ?? {}).filter(([, value]) => value).map(([key, value]) => `${value} ${key}`).join(', ');
  const lines = [
    `Run: ${run.status} (${counts}); wall ${seconds(run.wallMs)}, summed test time ${seconds(run.testMs)}, ${run.files} files, artifacts ${megabytes(run.artifactBytes)}`,
    '', 'Slowest files:', ...table(summary.files.map(file => [seconds(file.ms), plural(file.tests, 'test'), file.file])),
    '', 'Slowest tests:', ...table(summary.tests.map(test => [seconds(test.ms), test.status, clip(`${test.file} › ${test.title}`)])),
    '', 'Time by step API:', ...firstOf(table(summary.apis.map(api => [seconds(api.ms), `${api.count} x`, api.api])), top,
      rest => `  +${rest.length} more APIs (--json lists them)`),
    '', 'Slowest steps:', ...table(summary.steps.map(step => [seconds(step.ms), step.source, clip(`${step.api} ${step.label}`)])),
    '', `Steps over ${seconds(summary.slow.thresholdMs)}, by API and label:`,
    ...(summary.slow.groups.length ? table(summary.slow.groups.map(group => [seconds(group.ms), `${group.count} x`, clip(`${group.api} ${group.label}`),
      group.sources.length > 3 ? `${group.sources.slice(0, 3).join(', ')} +${group.sources.length - 3}` : group.sources.join(', ')])) : ['  none']),
    '', 'Artifacts by kind:', ...(summary.artifacts.length ? table(summary.artifacts.map(kind => [megabytes(kind.bytes), `${kind.count} x`, kind.kind])) : ['  none']),
  ];
  return lines.join('\n');
}

export function formatComparison(comparison, [beforeName, afterName] = ['before', 'after'], top = 10) {
  const row = (name, { before, after, delta }, unit) => [name, unit(before), unit(after), signed(delta, unit)];
  const lines = [
    `Before: ${beforeName} (${comparison.status.before})`,
    `After:  ${afterName} (${comparison.status.after})`,
    '',
    ...table([
      ['', 'before', 'after', 'change'],
      row('wall', comparison.wallMs, seconds),
      row('summed test time', comparison.testMs, seconds),
      row('artifacts', comparison.artifactBytes, megabytes),
      row('files', comparison.files, String),
      ['tests executed', comparison.executed.before ?? '?', comparison.executed.after ?? '?', ''],
    ], true),
    '', 'Time by step API:',
    ...firstOf(table([['before (calls)', 'after (calls)', 'change', ''], ...comparison.apis.map(api => [
      `${seconds(api.before.ms)} (${api.before.count})`, `${seconds(api.after.ms)} (${api.after.count})`, signed(api.deltaMs, seconds), api.api])], true), top + 1,
    rest => `  +${rest.length} more APIs (--json lists them)`),
  ];
  return lines.join('\n');
}

function parseArgs(argv) {
  const options = { top: 10, slow: 3000, json: false, reports: [] };
  for (let at = 0; at < argv.length; at++) {
    const arg = argv[at];
    if (arg === '--json') options.json = true;
    else if (arg === '--top' || arg === '--slow') {
      const value = Number(argv[++at]);
      if (!Number.isInteger(value) || value < 0) throw new Error(`${arg} needs a whole number.`);
      options[arg.slice(2)] = value;
    } else if (arg.startsWith('--')) throw new Error(`Unknown option ${arg}.`);
    else options.reports.push(arg);
  }
  if (options.reports.length < 1 || options.reports.length > 2) {
    throw new Error('Usage: node tools/e2e/timings.mjs <report.json | run directory | product-platform> [other report] [--top n] [--slow ms] [--json]');
  }
  return options;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const { reports, json, ...options } = parseArgs(process.argv.slice(2));
    const paths = reports.map(arg => resolveReport(arg));
    const summaries = paths.map(path => summarise(readReport(path), options));
    if (summaries.length === 1) console.log(json ? JSON.stringify({ report: paths[0], ...summaries[0] }, null, 2) : `${paths[0]}\n${formatSummary(summaries[0], options.top)}`);
    else {
      const comparison = compare(...summaries);
      console.log(json ? JSON.stringify({ before: paths[0], after: paths[1], ...comparison }, null, 2) : formatComparison(comparison, paths, options.top));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 2;
  }
}
