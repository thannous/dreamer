import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyReport, preserveStatus, compareSnapshots, aggregateReports, writeOnce, createAttemptOutput, verifyEvidenceFiles, verifyNativeCleanup } from './qualification.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const before = { revision: 'a'.repeat(40), files: { 'app/recording.tsx': sha('source') }, outputs: {} };
function report() {
  return { schemaVersion: 'report-1', run: {
    id: 'public-control', runner: { version: '0.18.0' }, vcs: { commit: before.revision },
    startedAt: new Date(Date.now() - 1000).toISOString(), finishedAt: new Date().toISOString(),
    exitCode: 0, status: 'passed', errors: [], targets: [{ id: 'dreamer-android', platform: 'android', engine: { name: 'mobile', version: '0.10.0' } }],
    summary: { discovered: 2, selected: 1, executed: 1, passed: 1, skipped: 0, failed: 0, interrupted: 0, flaky: 0 },
    environment: { runtime: `node ${process.version}` }, usage: { modelTokens: 0, maxModelCallsInStep: 0 },
    results: [{ testId: 'public-fixture', agent: 'default', targetId: 'dreamer-android', platform: 'android', agent: 'default', selected: true, repeat: 0, status: 'passed', attempts: [
      { index: 0, status: 'passed', cleanup: 'complete', secondaryErrors: [], steps: [{ api: 'app.open', status: 'passed' }], artifacts: [] },
    ] }, { testId: 'excluded-fixture', agent: 'default', targetId: 'dreamer-android', platform: 'android', agent: 'default', selected: false, repeat: 0, status: 'skipped', attempts: [] }],
  } };
}
function options(extra = {}) { return { target: 'dreamer-android', platform: 'android', revision: before.revision, startedAt: Date.now() - 2000, output: tmpdir(), ...extra }; }
test('actual SDK passed/exit0 shape cannot hide recording cleanup or secondary error', () => {
  for (const mutation of [a => { a.cleanup = 'failed'; }, a => { a.secondaryErrors = [{ code: 'ENGINE_FAILURE', phase: 'cleanup' }]; }]) {
    const r = report(); mutation(r.run.results[0].attempts[0]);
    assert.throws(() => verifyReport(r, options()), /LIFECYCLE/);
  }
});
test('requested video missing fails while unchanged report-only bodies remain valid', () => {
  assert.throws(() => verifyReport(report(), options({ video: true })), /MEDIA/);
  assert.equal(verifyReport(report(), options()).passed.length, 1);
});
test('missing app.open, attempt, duplicate result, foreign target/source and stale report fail', () => {
  for (const mutate of [
    r => { r.run.results[0].attempts[0].steps = []; },
    r => { r.run.results[0].attempts = []; },
    r => { r.run.results.push(structuredClone(r.run.results[0])); },
    r => { r.run.targets[0].id = 'foreign'; },
    r => { r.run.vcs.commit = 'b'.repeat(40); },
    r => { r.run.startedAt = '2020-01-01T00:00:00Z'; },
    r => { r.run.finishedAt = '2100-01-01T00:00:00Z'; },
    r => { r.run.usage.modelTokens = 1; },
  ]) { const r = report(); mutate(r); assert.throws(() => verifyReport(r, options())); }
});
test('artifact bytes/hash and traversal are checked on real files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'noctalia-proof-'));
  try {
    mkdirSync(join(dir, 'artifacts')); writeFileSync(join(dir, 'artifacts', 'capture.png'), 'public PNG fixture');
    const r = report(); const a = { kind: 'screenshot', path: 'capture.png', size: 18, sha256: sha('public PNG fixture') };
    r.run.results[0].attempts[0].artifacts = [a];
    assert.equal(verifyReport(r, options({ output: dir })).artifacts.length, 1);
    a.sha256 = '0'.repeat(64); assert.throws(() => verifyReport(r, options({ output: dir })), /ARTIFACT/);
    a.path = '../escape'; assert.throws(() => verifyReport(r, options({ output: dir })), /ARTIFACT/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('skips and excluded IDs are retained separately and never counted passed', () => {
  const r = report(); r.run.results[0].status = 'skipped'; r.run.results[0].attempts = [];
  r.run.summary = { discovered: 2, selected: 1, executed: 0, passed: 0, skipped: 1, failed: 0, interrupted: 0, flaky: 0 };
  assert.throws(() => verifyReport(r, options()), /NO_PASS/);
});
test('public collection pairs prevent a coherently shortened or wrongly skipped SDK report from passing', () => {
  const r = report(); r.run.results[0].file = 'tests/public.e2e.ts'; r.run.results[0].titlePath = ['public fixture'];
  const pair = { file: 'tests/public.e2e.ts', titlePath: ['public fixture'], target: 'dreamer-android', disposition: 'run' };
  assert.equal(verifyReport(r, options({ collection: { pairs: [pair] } })).passed.length, 1);
  assert.throws(() => verifyReport(r, options({ collection: { pairs: [pair, { ...pair, titlePath: ['missing fixture'] }] } })), /COLLECTION/);
  assert.throws(() => verifyReport(r, options({ collection: { pairs: [{ ...pair, disposition: 'skip' }] } })), /COLLECTION/);
});
test('primary exit and SIGINT/SIGTERM survive secondary proof failure', () => {
  for (const code of [1, 2, 3, 130, 143]) assert.equal(preserveStatus(code, ['SECONDARY']), code);
  assert.equal(preserveStatus(0, ['SECONDARY']), 3);
  assert.equal(preserveStatus(0, []), 0);
});
test('persistent source/test input mutation fails, declared output changes do not claim source clean', () => {
  const stable = structuredClone(before); stable.outputs = { 'docs-src/static/js/experience/experience.js': sha('output') };
  assert.equal(compareSnapshots(before, stable).sourceStable, true);
  stable.files['app/recording.tsx'] = sha('changed'); assert.equal(compareSnapshots(before, stable).sourceStable, false);
});
test('union uses target plus test ID and context, separates skip/exclusion and refuses uncovered required IDs', () => {
  const one = verifyReport(report(), options());
  const two = structuredClone(one); two.target = 'dreamer-ios'; two.passed = one.passed.map(p => ({ ...p, targetId: 'dreamer-ios' }));
  assert.equal(aggregateReports([one, two], [{ testId: 'public-fixture', agent: 'default', targetId: 'dreamer-android' }, { testId: 'public-fixture', agent: 'default', targetId: 'dreamer-ios' }]).passed.length, 2);
  assert.throws(() => aggregateReports([one], [{ testId: 'excluded-fixture', agent: 'default', targetId: 'dreamer-android' }]), /UNCOVERED/);
});
test('immutable receipts refuse an already used output', () => {
  const dir = mkdtempSync(join(tmpdir(), 'noctalia-output-'));
  try { const file = join(dir, 'receipt.json'); writeOnce(file, { first: true }); assert.throws(() => writeOnce(file, { second: true }), /EEXIST/); }
  finally { rmSync(dir, { recursive: true, force: true }); }
});
test('first attempt creates absent parents, collision does not overwrite prior evidence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'noctalia-first-'));
  try { const path = createAttemptOutput(join(dir, 'absent', 'parent'), 'unique'); writeOnce(join(path, 'proof.json'), { retained: true });
    assert.throws(() => createAttemptOutput(join(dir, 'absent', 'parent'), 'unique'), /EEXIST/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('critical array/boolean and unexpected agent identities are refused', () => {
  for (const mutate of [r => { delete r.run.results[0].agent; }, r => { r.run.startedAt = [r.run.startedAt]; }, r => { r.run.finishedAt = [r.run.finishedAt]; }, r => { r.run.results[0].agent = ['default']; }, r => { r.run.results[0].agent = 'unexpected'; },
    r => { r.run.results[0].selected = 1; }, r => { r.run.summary.passed = [1]; },
    r => { r.run.usage.modelTokens = false; }]) { const r = report(); mutate(r); assert.throws(() => verifyReport(r, options())); }
});
test('finding with no requested or declared media and no artifacts directory is valid', () => {
  const dir = mkdtempSync(join(tmpdir(), 'noctalia-report-only-'));
  try { assert.equal(verifyReport(report(), options({ output: dir })).artifacts.length, 0); }
  finally { rmSync(dir, { recursive: true, force: true }); }
});

test('web report must identify the exact loopback origin and engine', () => {
  const r = report(); r.run.targets[0] = { id: 'dreamer-web', platform: 'web', baseOrigin: 'http://127.0.0.1:8096', engine: { name: 'web', version: '0.13.0' } };
  for (const row of r.run.results) { row.targetId = 'dreamer-web'; row.platform = 'web'; }
  const opts = options({ target: 'dreamer-web', platform: 'web', origin: 'http://127.0.0.1:8096' });
  assert.equal(verifyReport(r, opts).passed.length, 1);
  r.run.targets[0].baseOrigin = 'https://foreign.invalid'; assert.throws(() => verifyReport(r, opts), /PROVENANCE/);
});

test('campaign refuses modified or undeclared retained evidence files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'noctalia-evidence-integrity-'));
  try {
    writeFileSync(join(dir, 'sdk.log'), 'public log'); writeOnce(join(dir, 'files.json'), { 'sdk.log': sha('public log') });
    writeOnce(join(dir, 'end.json'), { exitCode: 0 }); verifyEvidenceFiles(dir);
    writeFileSync(join(dir, 'sdk.log'), 'changed log'); assert.throws(() => verifyEvidenceFiles(dir), /EVIDENCE/);
    writeFileSync(join(dir, 'sdk.log'), 'public log'); writeFileSync(join(dir, 'unrecorded.txt'), 'extra'); assert.throws(() => verifyEvidenceFiles(dir), /EVIDENCE/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('SDK cleanup must be proven before releasing a native owner lock, even for a red body', () => {
  const r = report(); r.run.status = 'failed'; r.run.exitCode = 1; r.run.results[0].status = 'failed'; r.run.results[0].attempts[0].status = 'failed';
  assert.equal(verifyNativeCleanup(r, options()), true);
  r.run.results[0].attempts[0].cleanup = 'failed'; assert.throws(() => verifyNativeCleanup(r, options()), /CLEANUP/);
  assert.throws(() => verifyNativeCleanup(null, options()));
  const foreign = report(); foreign.run.environment.runtime = 'node v22.0.0'; assert.throws(() => verifyNativeCleanup(foreign, options()), /PROVENANCE/);
});
