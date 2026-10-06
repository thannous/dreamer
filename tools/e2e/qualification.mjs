import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, lstatSync, realpathSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, sep, resolve } from 'node:path';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function writeOnce(file, value) {
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}
export function createAttemptOutput(parent, name) {
  mkdirSync(parent, { recursive: true });
  const path = join(parent, name); mkdirSync(path); return path;
}
export function preserveStatus(primary, errors) { return primary || (errors.length ? 3 : 0); }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fail = code => { throw new Error(code); };
export function hashFiles(root, files) {
  return Object.fromEntries([...new Set(files)].sort().map(file => {
    const path = join(root, file);
    try {
      if (lstatSync(path).isSymbolicLink()) fail('SOURCE_SYMLINK');
      return [file, digest(readFileSync(path))];
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return [file, null];
    }
  }));
}
export function directoryFiles(root, prefix, ignored = new Set()) {
  const result = [];
  function walk(path) {
    for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (ignored.has(entry.name)) continue;
      const full = join(path, entry.name);
      if (entry.isSymbolicLink()) fail('OUTPUT_SYMLINK');
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) result.push(relative(root, full).split(sep).join('/'));
    }
  }
  try { walk(join(root, prefix)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return result;
}
export function sourceSnapshot(root, product, native = false) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const revision = git('rev-parse', 'HEAD');
  const paths = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  // This is the output directory of scripts/build-experience.js, not an input.
  // Its bytes are retained and compared separately; sourceClean is never forged.
  const allowedOutputPrefixes = product === 'site' ? ['docs-src/static/js/experience/'] : [];
  const outputs = paths.filter(file => allowedOutputPrefixes.some(prefix => file.startsWith(prefix)));
  const excludeNative = ['tools/e2e/', 'e2e/', 'maestro/', 'doc_web_interne/', 'docs/', 'docs-src/', '.circleci/', '.github/'];
  const inputs = paths.filter(file => !outputs.includes(file)
    && (!native || (!excludeNative.some(prefix => file.startsWith(prefix)) && file !== 'AGENTS.md')));
  return {
    revision, workingTree: git('status', '--porcelain'),
    files: hashFiles(root, inputs), outputs: hashFiles(root, outputs), allowedOutputPrefixes,
    ...(product === 'site' ? { servedOutputs: hashFiles(root, directoryFiles(root, 'docs')) } : {}),
  };
}
export function compareSnapshots(start, end) {
  const sourceStable = start.revision === end.revision && same(start.files, end.files);
  const outputsStable = same(start.outputs, end.outputs) && same(start.servedOutputs, end.servedOutputs);
  return { sourceStable, outputsStable, startRevision: start.revision, endRevision: end.revision,
    sourceClean: !start.workingTree && !end.workingTree, allowedOutputPrefixes: start.allowedOutputPrefixes ?? [] };
}
function artifactBytes(output, artifact) {
  if (typeof artifact.path !== 'string' || artifact.path.startsWith('/') || artifact.path.split(/[\\/]/).includes('..')
    || !/^[a-f0-9]{64}$/.test(artifact.sha256 ?? '') || !Number.isSafeInteger(artifact.size) || artifact.size <= 0)
    fail('ARTIFACT_IDENTITY');
  const base = realpathSync(join(output, 'artifacts'));
  const file = resolve(base, artifact.path);
  const actual = realpathSync(file);
  if (!actual.startsWith(base + sep) || lstatSync(file).isSymbolicLink()) fail('ARTIFACT_PATH');
  const bytes = readFileSync(actual);
  if (bytes.length !== artifact.size || digest(bytes) !== artifact.sha256) fail('ARTIFACT_BYTES');
  return { kind: artifact.kind, path: artifact.path, size: bytes.length, sha256: artifact.sha256 };
}
function verifyProvenance(document, options, requirePass = true) {
  const run = document?.run;
  const now = Date.now();
  if (document?.schemaVersion !== 'report-1' || !run || typeof run.id !== 'string' || !run.id || run.runner?.version !== '0.18.0'
    || run.vcs?.commit !== options.revision || (requirePass && (run.exitCode !== 0 || run.status !== 'passed'))
    || run.environment?.runtime !== (options.runtime ?? `node ${process.version}`)
    || !Array.isArray(run.errors) || run.errors.length || !Array.isArray(run.results)
    || !Array.isArray(run.targets) || run.targets.length !== 1
    || run.targets[0].id !== options.target || run.targets[0].platform !== options.platform
    || run.targets[0].engine?.name !== (options.platform === 'web' ? 'web' : 'mobile')
    || (options.platform === 'web' && run.targets[0].baseOrigin !== options.origin)
    || run.targets[0].engine?.version !== (options.platform === 'web' ? '0.13.0' : '0.10.0')
    || typeof run.startedAt !== 'string' || typeof run.finishedAt !== 'string'
    || !Number.isFinite(Date.parse(run.startedAt)) || !Number.isFinite(Date.parse(run.finishedAt)) || Date.parse(run.startedAt) < options.startedAt
    || Date.parse(run.startedAt) > now || Date.parse(run.finishedAt) < Date.parse(run.startedAt)
    || Date.parse(run.finishedAt) > now || run.usage?.modelTokens !== 0 || run.usage?.maxModelCallsInStep !== 0)
    fail('REPORT_PROVENANCE');
  return run;
}
export function verifyNativeCleanup(document, options) {
  const run = verifyProvenance(document, options, false);
  const executed = run.results.filter(result => result.selected && result.attempts?.length);
  if (!executed.length || run.results.some(result => result.selected && result.status !== 'skipped' && !result.attempts?.length)
    || executed.some(result => !Array.isArray(result.attempts) || result.attempts.length !== 1
      || result.attempts[0].cleanup !== 'complete' || !Array.isArray(result.attempts[0].secondaryErrors) || result.attempts[0].secondaryErrors.length)) fail('NATIVE_CLEANUP_UNPROVEN');
  return true;
}
export function verifyReport(document, options) {
  const run = verifyProvenance(document, options);
  const passed = [], skipped = [], excluded = [], artifacts = [], seen = new Set();
  if (options.collection) {
    const key = row => JSON.stringify([row.file, row.titlePath, row.target ?? row.targetId]);
    const pairs = options.collection.pairs;
    if (!Array.isArray(pairs) || !pairs.length || pairs.some(pair => typeof pair.file !== 'string' || !Array.isArray(pair.titlePath) || !pair.titlePath.length || pair.titlePath.some(title => typeof title !== 'string') || pair.target !== options.target || !['run', 'skip'].includes(pair.disposition)) || new Set(pairs.map(key)).size !== pairs.length) fail('COLLECTION_IDENTITY');
    const selected = run.results.filter(result => result.selected);
    const repeatCount = options.repeatCount ?? 1;
    if (selected.length !== pairs.length * repeatCount) fail('COLLECTION_INCOMPLETE');
    for (const pair of pairs) for (let repeat = 0; repeat < repeatCount; repeat++) {
      const matches = selected.filter(result => key(result) === key(pair) && result.repeat === repeat);
      if (matches.length !== 1 || (pair.disposition === 'skip') !== (matches[0].status === 'skipped')) fail('COLLECTION_DISPOSITION');
    }
  }
  for (const result of run.results) {
    if (typeof result.testId !== 'string' || !result.testId || result.targetId !== options.target
      || result.platform !== options.platform || !Number.isSafeInteger(result.repeat) || result.repeat < 0
      || typeof result.selected !== 'boolean' || !Array.isArray(result.attempts)
      || typeof result.agent !== 'string' || result.agent !== (options.agent ?? 'default')) fail('RESULT_IDENTITY');
    const row = { targetId: result.targetId, testId: result.testId, repeat: result.repeat, agent: result.agent };
    const key = JSON.stringify(row);
    if (seen.has(key)) fail('DUPLICATE_RESULT');
    seen.add(key);
    if (!result.selected) { excluded.push(row); continue; }
    if (result.status === 'skipped' && result.attempts.length === 0) { skipped.push(row); continue; }
    if (result.status !== 'passed' || result.attempts.length !== 1) fail('RESULT_FAILED');
    const attempt = result.attempts[0];
    if (attempt.status !== 'passed' || attempt.index !== 0 || attempt.cleanup !== 'complete'
      || !Array.isArray(attempt.secondaryErrors) || attempt.secondaryErrors.length
      || !Array.isArray(attempt.steps)
      || (options.platform !== 'web' ? attempt.steps[0]?.api !== 'app.open'
        : !attempt.steps.some(step => step.api === 'app.open') || attempt.steps.slice(0, attempt.steps.findIndex(step => step.api === 'app.open')).some(step => !['browser.route', 'browser.setViewport'].includes(step.api)))
      || attempt.steps.some(step => step.status === 'failed' || step.status === 'interrupted')
      || !Array.isArray(attempt.artifacts)) fail('LIFECYCLE_INCOMPLETE');
    if (options.video && !attempt.artifacts.some(a => a.kind === 'video')) fail('MEDIA_VIDEO_MISSING');
    if (options.trace && !attempt.artifacts.some(a => a.kind === 'trace')) fail('MEDIA_TRACE_MISSING');
    for (const artifact of attempt.artifacts) artifacts.push(artifactBytes(options.output, artifact));
    passed.push(row);
  }
  if (!passed.length) fail('NO_PASS');
  const summary = run.summary;
  if (summary?.discovered !== run.results.length || summary.selected !== passed.length + skipped.length
    || summary.executed !== passed.length || summary.passed !== passed.length || summary.skipped !== skipped.length
    || summary.failed !== 0 || summary.interrupted !== 0 || summary.flaky !== 0) fail('SUMMARY_INCOMPLETE');
  return { schemaVersion: 1, runId: run.id, target: options.target, context: options.context ?? null,
    startedAt: run.startedAt, finishedAt: run.finishedAt, revision: options.revision,
    runner: run.runner.version, engine: run.targets[0].engine.version, passed, skipped, excluded, artifacts };
}
export function aggregateReports(proofs, required) {
  const key = row => JSON.stringify([row.targetId, row.testId, row.agent]);
  const union = new Map();
  for (const proof of proofs) for (const row of proof.passed) {
    const id = key(row);
    const current = union.get(id) ?? { targetId: row.targetId, testId: row.testId, agent: row.agent, contexts: [] };
    current.contexts.push({ runId: proof.runId, context: proof.context, repeat: row.repeat }); union.set(id, current);
  }
  const missing = required.filter(row => !union.has(key(row)));
  if (missing.length) fail('UNION_UNCOVERED');
  return { schemaVersion: 1, passed: [...union.values()], required,
    runs: proofs.map(proof => ({ runId: proof.runId, context: proof.context, target: proof.target,
      passed: proof.passed, skipped: proof.skipped, excluded: proof.excluded })) };
}

export function verifyEvidenceFiles(output) {
  const declared = JSON.parse(readFileSync(join(output, 'files.json'), 'utf8'));
  const actual = hashFiles(output, directoryFiles(output, '.').filter(file => !['files.json', 'end.json'].includes(file)));
  if (!same(declared, actual)) fail('EVIDENCE_CHANGED');
}
