import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { virtualLinks } from './test-support/virtual-links.mjs';
import { SDK_PINS, trackedDiffSha256, verifyReport, preserveStatus, qualifyingSdkEnvironment, compareSnapshots, aggregateReports, writeOnce, createAttemptOutput, verifyEvidenceFiles, verifyNativeCleanup, campaignFailureRecord, failureDigest, startSdkProgress, startHostStallMonitor, HOST_STALL_MS } from './qualification.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const before = { revision: 'a'.repeat(40), files: { 'app/recording.tsx': sha('source') }, outputs: {} };
function report() {
  return { schemaVersion: 'report-1', run: {
    id: 'public-control', runner: { version: SDK_PINS.e2e }, vcs: { commit: before.revision },
    startedAt: new Date(Date.now() - 1000).toISOString(), finishedAt: new Date().toISOString(),
    exitCode: 0, status: 'passed', errors: [], targets: [{ id: 'dreamer-android', platform: 'android', engine: { name: 'mobile', version: SDK_PINS['@e2e-dev/mobile'] } }],
    summary: { discovered: 2, selected: 1, executed: 1, passed: 1, skipped: 0, failed: 0, interrupted: 0, flaky: 0 },
    environment: { runtime: `node ${process.version}` }, usage: { modelTokens: 0, maxModelCallsInStep: 0 },
    results: [{ id: 'c0ffee'.repeat(10) + 'beef', testId: 'public-fixture', targetId: 'dreamer-android', platform: 'android', agent: 'default', selected: true, repeat: 0, status: 'passed', attempts: [
      { index: 0, status: 'passed', cleanup: 'complete', secondaryErrors: [], steps: [{ api: 'app.open', status: 'passed' }], artifacts: [] },
    ] }, { testId: 'excluded-fixture', targetId: 'dreamer-android', platform: 'android', agent: 'default', selected: false, repeat: 0, status: 'skipped', attempts: [] }],
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
    mkdirSync(join(dir, 'results')); writeFileSync(join(dir, 'results', 'capture.png'), 'public PNG fixture');
    const r = report(); const a = { kind: 'screenshot', path: 'capture.png', size: 18, sha256: sha('public PNG fixture') };
    r.run.results[0].attempts[0].artifacts = [a];
    assert.equal(verifyReport(r, options({ output: dir })).artifacts.length, 1);
    a.sha256 = '0'.repeat(64); assert.throws(() => verifyReport(r, options({ output: dir })), /ARTIFACT/);
    a.path = '../escape'; assert.throws(() => verifyReport(r, options({ output: dir })), /ARTIFACT/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('a requested trace is the own non-empty trace page of each passed result', () => {
  const dir = mkdtempSync(join(tmpdir(), 'noctalia-proof-'));
  try {
    const r = report(), owner = `dreamer-mobile-public-fixture-${r.run.results[0].id.slice(0, 16)}`;
    mkdirSync(join(dir, 'results', owner), { recursive: true });
    assert.throws(() => verifyReport(r, options({ output: dir, trace: true })), /MEDIA_TRACE_MISSING/);
    writeFileSync(join(dir, 'results', owner, 'trace.md'), '');
    assert.throws(() => verifyReport(r, options({ output: dir, trace: true })), /MEDIA_TRACE_MISSING/);
    writeFileSync(join(dir, 'results', owner, 'trace.md'), '# public fixture');
    assert.deepEqual(verifyReport(r, options({ output: dir, trace: true })).artifacts,
      [{ kind: 'trace', path: `${owner}/trace.md`, size: 16, sha256: sha('# public fixture') }]);
    mkdirSync(join(dir, 'results', `another-${r.run.results[0].id.slice(0, 16)}`));
    assert.throws(() => verifyReport(r, options({ output: dir, trace: true })), /MEDIA_TRACE_MISSING/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('skips and excluded IDs are retained separately and never counted passed', () => {
  const r = report(); r.run.results[0].status = 'skipped'; r.run.results[0].attempts = [];
  r.run.summary = { discovered: 2, selected: 1, executed: 0, passed: 0, skipped: 1, failed: 0, interrupted: 0, flaky: 0 };
  assert.throws(() => verifyReport(r, options()), /NO_PASS/);
});
test('the proof records what the filters left out, including a filter that failed and left nothing out', () => {
  const r = report();
  r.run.changes = { base: 'b'.repeat(40), files: 3 };
  r.run.filters = [{ name: 'parcours-touches', candidates: 5, excluded: 2, note: 'journal' }];
  const proof = verifyReport(r, options());
  assert.deepEqual(proof.changes, { base: 'b'.repeat(40), files: 3 });
  assert.deepEqual(proof.filters, [{ name: 'parcours-touches', candidates: 5, excluded: 2, note: 'journal' }]);
  r.run.filters = [{ name: 'parcours-touches', candidates: 5, excluded: 0, note: 'parcours-touches threw: boom', outcome: 'failed' }];
  assert.equal(verifyReport(r, options()).filters[0].outcome, 'failed');
  // Without --changed-since no filter runs, and the report names neither.
  const full = verifyReport(report(), options());
  assert.deepEqual([full.changes, full.filters], [null, []]);
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
test('qualifying SDK children run in CI mode without colour whatever the caller set, and the caller env stays as it was', () => {
  for (const CI of [undefined, '', '0', 'false', 'true']) {
    const caller = CI === undefined ? { PATH: '/usr/bin' } : { PATH: '/usr/bin', CI };
    const unchanged = structuredClone(caller);
    const child = qualifyingSdkEnvironment(caller);
    assert.equal(child.CI, '1'); assert.equal(child.NO_COLOR, '1'); assert.equal(child.PATH, '/usr/bin');
    assert.deepEqual(caller, unchanged, 'run.mjs picks its web worker count from the caller\'s own CI');
  }
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
for (const platform of ['web', 'ios', 'android']) {
  test(`persona reports on ${platform} require opt-in, the declared agent/model and bounded calls`, () => {
    // A UI journey cannot reproduce forged provenance, a wrong test file or a
    // model accidentally enabled in ordinary regressions. Exercise that gap here.
    const r = report(), target = `dreamer-${platform}`;
    r.run.targets = [{ id: target, platform,
      ...(platform === 'web' ? { baseOrigin: 'http://127.0.0.1:8096' } : {}),
      engine: { name: platform === 'web' ? 'web' : 'mobile', version: SDK_PINS[platform === 'web' ? '@e2e-dev/web' : '@e2e-dev/mobile'] } }];
    r.run.usage = { modelTokens: 100, maxModelCallsInStep: 1, maxActionStepsInStep: 2 };
    for (const row of r.run.results) Object.assign(row, {
      targetId: target, platform, file: `tests/dreamer-personas.${platform === 'web' ? 'web' : 'mobile'}.e2e.ts`,
      agent: 'morning', tags: ['persona-morning'],
    });
    r.run.results[0].attempts[0].steps.push({ api: 'agent.act', status: 'passed', model: { provider: 'chatgpt.responses', model: 'gpt-6.1-sol', calls: 1 } });
    const opts = options({ target, platform, origin: 'http://127.0.0.1:8096', personaModel: 'gpt-6.1-sol', personaJudgeModel: 'declared-judge' });
    assert.equal(verifyReport(r, opts).passed[0].agent, 'morning');
    if (platform !== 'web') assert.equal(verifyNativeCleanup(r, opts), true);
    assert.throws(() => verifyReport(r, { ...opts, personaModel: undefined }), /REPORT_PROVENANCE/);
    assert.throws(() => verifyReport(r, { ...opts, personaModel: 'another-model' }), /PERSONA_MODEL_UNPROVEN/);
    const judged = structuredClone(r);
    judged.run.results[0].attempts[0].steps.push({ api: 'agent.assert', status: 'passed', model: { provider: 'chatgpt.responses', model: 'declared-judge', calls: 1 } });
    assert.equal(verifyReport(judged, opts).passed.length, 1);
    assert.throws(() => verifyReport(judged, { ...opts, personaJudgeModel: 'different-judge' }), /PERSONA_JUDGE_UNPROVEN/);
    assert.throws(() => verifyReport(judged, { ...opts, personaJudgeModel: undefined }), /PERSONA_JUDGE_UNPROVEN/);
    // The same model id through an API key (openai('…'), OPENAI_API_KEY) is another billing route.
    const keyed = structuredClone(r); keyed.run.results[0].attempts[0].steps[1].model.provider = 'openai.responses';
    assert.throws(() => verifyReport(keyed, opts), /PERSONA_MODEL_UNPROVEN/);
    const keyedJudge = structuredClone(judged); keyedJudge.run.results[0].attempts[0].steps[2].model.provider = 'openai.responses';
    assert.throws(() => verifyReport(keyedJudge, opts), /PERSONA_JUDGE_UNPROVEN/);
    for (const mutate of [
      data => { data.run.usage.maxModelCallsInStep = 13; },
      data => { data.run.usage.maxActionStepsInStep = 17; },
      data => { data.run.results[0].agent = 'unexpected'; },
      data => { data.run.results[0].tags = []; },
      data => { data.run.results[0].file = `tests/dreamer-personas.${platform === 'web' ? 'mobile' : 'web'}.e2e.ts`; },
      data => { data.run.results[0].attempts[0].steps.pop(); },
      data => { data.run.results[0].attempts[0].steps[1].model.calls = 0; },
      data => { delete data.run.results[0].attempts[0].steps[1].model.provider; },
      data => { data.run.results[0].attempts[0].steps[1].cache = { mode: 'self-finalized' }; },
      data => { data.run.results[0].attempts[0].steps.push({ api: 'expect.toBeVisible', status: 'failed' }); },
      data => { data.run.results[0].attempts[0].steps.shift(); },
      data => { data.run.results[0].attempts[0].cleanup = 'failed'; },
    ]) { const changed = structuredClone(r); mutate(changed); assert.throws(() => verifyReport(changed, opts)); }
    const foreign = structuredClone(r);
    foreign.run.targets[0].id = `lucid-${platform}`;
    for (const row of foreign.run.results) row.targetId = `lucid-${platform}`;
    assert.throws(() => verifyReport(foreign, { ...opts, target: `lucid-${platform}` }), /REPORT_PROVENANCE/);
    if (platform !== 'web') {
      const broken = structuredClone(r);
      broken.run.results[0].attempts[0].secondaryErrors = [{ code: 'ENGINE_FAILURE', phase: 'cleanup' }];
      assert.throws(() => verifyNativeCleanup(broken, opts), /CLEANUP/);
      // The observed Android language-sheet setup failure used no model, but
      // SDK cleanup completed. It must remain a failed application verdict.
      const setupFailed = structuredClone(r);
      Object.assign(setupFailed.run, { status: 'failed', exitCode: 1 });
      setupFailed.run.usage = { modelTokens: 0, maxModelCallsInStep: 0, maxActionStepsInStep: 0 };
      setupFailed.run.results[0].status = 'failed';
      Object.assign(setupFailed.run.results[0].attempts[0], { status: 'failed', steps: [{ api: 'app.open', status: 'passed' }] });
      assert.equal(verifyNativeCleanup(setupFailed, opts), true);
      assert.throws(() => verifyReport(setupFailed, opts), /PROVENANCE/);
      setupFailed.run.status = 'passed'; setupFailed.run.exitCode = 0;
      assert.throws(() => verifyNativeCleanup(setupFailed, opts), /PROVENANCE/);
      setupFailed.run.status = 'failed'; setupFailed.run.exitCode = 1;
      setupFailed.run.results[0].attempts[0].cleanup = 'failed';
      assert.throws(() => verifyNativeCleanup(setupFailed, opts), /CLEANUP/);
    }
  });
}
test('finding with no requested or declared media and no artifacts directory is valid', () => {
  const dir = mkdtempSync(join(tmpdir(), 'noctalia-report-only-'));
  try { assert.equal(verifyReport(report(), options({ output: dir })).artifacts.length, 0); }
  finally { rmSync(dir, { recursive: true, force: true }); }
});

test('web report must identify the exact loopback origin and engine', () => {
  const r = report(); r.run.targets[0] = { id: 'dreamer-web', platform: 'web', baseOrigin: 'http://127.0.0.1:8096', engine: { name: 'web', version: SDK_PINS['@e2e-dev/web'] } };
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

test('SDK cleanup proof remains a qualification diagnostic even for a red body', () => {
  const r = report(); r.run.status = 'failed'; r.run.exitCode = 1; r.run.results[0].status = 'failed'; r.run.results[0].attempts[0].status = 'failed';
  assert.equal(verifyNativeCleanup(r, options()), true);
  r.run.results[0].attempts[0].cleanup = 'failed'; assert.throws(() => verifyNativeCleanup(r, options()), /CLEANUP/);
  assert.throws(() => verifyNativeCleanup(null, options()));
  const foreign = report(); foreign.run.environment.runtime = 'node v22.0.0'; assert.throws(() => verifyNativeCleanup(foreign, options()), /PROVENANCE/);
});

test('web public fixture setup precedes app.open, other UI before it and every native prefix are refused', () => {
  const r = report(); r.run.targets[0] = { id: 'dreamer-web', platform: 'web', baseOrigin: 'http://127.0.0.1:8096', engine: { name: 'web', version: SDK_PINS['@e2e-dev/web'] } };
  for (const row of r.run.results) { row.targetId = 'dreamer-web'; row.platform = 'web'; }
  const opts = options({ target: 'dreamer-web', platform: 'web', origin: 'http://127.0.0.1:8096' });
  r.run.results[0].attempts[0].steps.unshift({ api: 'browser.route', status: 'passed' }, { api: 'browser.setViewport', status: 'passed' });
  assert.equal(verifyReport(r, opts).passed.length, 1);
  r.run.results[0].attempts[0].steps.unshift({ api: 'locator.tap', status: 'passed' }); assert.throws(() => verifyReport(r, opts), /LIFECYCLE/);
  const native = report(); native.run.results[0].attempts[0].steps.unshift({ api: 'browser.route', status: 'passed' }); assert.throws(() => verifyReport(native, options()), /LIFECYCLE/);
});


test('globally passed SDK report refuses every non-passed executed step', () => {
  for (const status of ['blocked', 'timed-out', 'cancelled', 'failed', 'interrupted']) {
    const r = report(); r.run.results[0].attempts[0].steps.push({ api: 'expect.toBeVisible', status });
    assert.throws(() => verifyReport(r, options()), /LIFECYCLE/);
  }
  assert.equal(verifyReport(report(), options()).passed.length, 1);
});

const metroRoot = fileURLToPath(new URL('../../', import.meta.url));
function seed(entries) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('EXPO_PUBLIC_')
    && !['NOCTALIA_APP_VARIANT', 'NOCTALIA_DREAMER_QA_BUILD', 'EXPO_ROUTER_APP_ROOT', 'EXPO_ROUTER_IMPORT_MODE', 'NOCTALIA_DISABLE_RC_WEB_STUB', 'EAS_BUILD'].includes(key)));
  const result = spawnSync(process.execPath, ['-e', "process.stdout.write(JSON.stringify(require('./metro.config.js').cacheVersion))"],
    { cwd: metroRoot, env: { ...env, ...Object.fromEntries(entries) }, encoding: 'utf8' });
  assert.equal(result.status, 0, 'real Metro configuration must load');
  return JSON.parse(result.stdout);
}
const profile = [['NOCTALIA_APP_VARIANT', 'noctalia'], ['EXPO_PUBLIC_APP_VARIANT', 'noctalia'],
  ['EXPO_PUBLIC_MOCK_MODE', 'true'], ['EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED', 'true']];
test('real Metro cache isolates compiled profiles while retaining identical input reuse', () => {
  const dreamer = seed(profile);
  assert.equal(seed(profile), dreamer);
  assert.equal(seed([...profile].reverse()), dreamer);
  assert.equal(seed([...profile, ['UNRELATED_DIAGNOSTIC', 'public fixture']]), dreamer);
  for (const changed of [
    [['NOCTALIA_APP_VARIANT', 'lucid'], ['EXPO_PUBLIC_APP_VARIANT', 'lucid']],
    [['EXPO_PUBLIC_MOCK_MODE', 'false']], [['EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED', 'false']],
    [['EXPO_ROUTER_APP_ROOT', './routes/lucid']], [['EXPO_ROUTER_IMPORT_MODE', 'lazy']],
    [['NOCTALIA_DREAMER_QA_BUILD', '1']],
    [['NOCTALIA_DISABLE_RC_WEB_STUB', '1']],
  ]) assert.notEqual(seed([...profile, ...changed]), dreamer, 'a changed compiled profile cannot reuse the other profile namespace');
  assert.equal(seed([...profile, ['NOCTALIA_DISABLE_RC_WEB_STUB', '1'], ['EAS_BUILD', 'true']]), dreamer);
});


test('forced interruption preserves available SDK/log bytes while missing final receipts remain nonqualifying', t => {
  const links = virtualLinks(t);
  const output = mkdtempSync(join(tmpdir(), 'noctalia-interrupted-control-'));
  try {
    const r = report(); r.run.status = 'failed'; r.run.exitCode = 130;
    r.run.summary = { discovered: 96, selected: 96, executed: 33, passed: 32, failed: 0, interrupted: 1, flaky: 0, skipped: 63 };
    writeFileSync(join(output, 'report.json'), JSON.stringify(r));
    writeFileSync(join(output, 'sdk.log'), 'public interrupted SDK error retained');
    const failure = campaignFailureRecord(output, Object.assign(new Error('untrusted error body'), { code: 'ENOENT' }));
    assert.equal(failure.qualified, false); assert.equal(failure.sdkExitCode, 130);
    assert.equal(failure.summary.passed, 32); assert.equal(failure.summary.interrupted, 1);
    for (const name of ['files.json', 'end.json', 'source-end.json', 'qualification.json']) assert.ok(failure.missingProof.includes(name));
    assert.equal(failure.retained['report.json'].sha256, sha(readFileSync(join(output, 'report.json'))));
    assert.equal(failure.retained['sdk.log'].sha256, sha('public interrupted SDK error retained'));
    assert.equal(JSON.stringify(failure).includes('untrusted error body'), false);
    assert.throws(() => verifyReport(r, options({ output })), /REPORT_PROVENANCE/);
    assert.equal(preserveStatus(130, [failure.code]), 130);
    assert.equal(preserveStatus(1, [failure.code]), 1);
    links.link(join(output, 'report.json'), join(output, 'app.log'));
    assert.equal(campaignFailureRecord(output, new Error('bad payload')).retained['app.log'], undefined);
  } finally { rmSync(output, { recursive: true, force: true }); }
});

// verify:pr deletes the run's copy, so this digest is what the terminal keeps of a red gate.
test('a red run digest names each failure by line, code and trace page, never the user\'s text or a stale report', () => {
  const output = mkdtempSync(join(tmpdir(), 'noctalia-red-run-'));
  try {
    const startedAt = Date.now();
    const red = report();
    Object.assign(red.run, { status: 'failed', exitCode: 1, startedAt: new Date(startedAt).toISOString(), errors: [] });
    const base = red.run.results[0];
    const failedId = 'ab'.repeat(32), owner = `dreamer-web-capture-${failedId.slice(0, 16)}`;
    const attempt = (status, error) => ({ ...structuredClone(base.attempts[0]), status, error,
      appLog: [{ level: 'error', text: 'DREAM TEXT logged by the app', stepIndex: 0 }] });
    const skippedRow = testId => ({ ...structuredClone(base), id: undefined, testId, status: 'skipped', attempts: [],
      skip: { cause: 'failure-limit', reason: 'run stopped after 1 failure (--max-failures 1)' } });
    red.run.results = [
      { ...structuredClone(base), id: failedId, titlePath: ['DREAM TEXT title'], status: 'failed', source: { file: 'tests/x.web.e2e.ts', line: 8, column: 1 },
        attempts: [attempt('failed', { code: 'EXPECT_TIMEOUT', message: 'expected "DREAM TEXT" to be visible', source: { file: 'tests/x.web.e2e.ts', line: 12, column: 5 } })] },
      { ...structuredClone(base), id: 'cd'.repeat(32), testId: 'other-worker', status: 'interrupted', source: { file: 'tests/y.web.e2e.ts', line: 4, column: 1 },
        attempts: [attempt('interrupted', { code: 'INTERRUPTED', message: 'run interrupted in phase body: DREAM TEXT' })] },
      skippedRow('rest-one'), skippedRow('rest-two'),
    ];
    mkdirSync(join(output, 'results', owner), { recursive: true });
    writeFileSync(join(output, 'results', owner, 'trace.md'), '# public trace');
    writeFileSync(join(output, 'summary.md'), '# public summary');
    const lines = failureDigest(red, { output, startedAt });
    assert.deepEqual(lines, [
      `E2E failed: tests/x.web.e2e.ts:12 EXPECT_TIMEOUT trace=${join(output, 'results', owner, 'trace.md')}`,
      'E2E interrupted: tests/y.web.e2e.ts:4 INTERRUPTED trace=no trace page',
      'E2E skipped: 2 failure-limit, 0 time-limit',
      `E2E summary: ${join(output, 'summary.md')}`,
    ]);
    assert.equal(lines.some(line => line.includes('DREAM TEXT') || line.includes('E2E evidence:')), false);
    const capped = failureDigest(red, { output, startedAt, limit: 3 });
    assert.equal(capped.length, 3); assert.match(capped[0], /\+2 more in report\.json$/);
    // The previous run's report seeded for durations, or another runner's, prints nothing.
    assert.deepEqual(failureDigest(red, { output, startedAt: startedAt + 1 }), []);
    const foreign = structuredClone(red); foreign.run.runner.version = '0.21.3';
    assert.deepEqual(failureDigest(foreign, { output, startedAt }), []);
    assert.deepEqual(failureDigest(null, { output, startedAt }), []);
  } finally { rmSync(output, { recursive: true, force: true }); }
});

test('run budgets are refused outside a run or their bounds, before the runner creates any output', () => {
  const runner = fileURLToPath(new URL('./run.mjs', import.meta.url));
  // `list` keeps a missing refusal harmless: it would start no engine, and the message would differ.
  for (const [budget, refusal] of [
    [['--max-failures', '3'], /--max-failures applies to a run only/],
    [['--max-duration', '60000'], /--max-duration applies to a run only/],
    [['--max-failures', '0'], /Invalid E2E value for --max-failures/],
    [['--max-duration', String(2 ** 31)], /Invalid E2E value for --max-duration/],
  ]) {
    const result = spawnSync(process.execPath, [runner, 'dreamer', 'web', 'list', ...budget], { encoding: 'utf8' });
    assert.notEqual(result.status, 0, budget.join(' '));
    assert.match(result.stderr, refusal);
  }
});

test('Circle web SDK liveness emits only elapsed time, stops on close/error and leaves disabled sinks unopened', () => {
  const child = Object.assign(new EventEmitter(), { exitCode: null, signalCode: null });
  const lines = []; let tick, delay, cleared = 0, time = 0, errors = 0;
  const dependencies = { write: line => lines.push(line), now: () => time,
    setTimer: (callback, milliseconds) => { tick = callback; delay = milliseconds; return 42; }, clearTimer: () => { cleared++; } };
  startSdkProgress(child, { enabled: false, ...dependencies }); assert.equal(tick, undefined);
  const stop = startSdkProgress(child, { enabled: true, ...dependencies }); assert.equal(delay, 60000);
  time = 60000; tick(); assert.deepEqual(lines, ['E2E SDK running: elapsed=60s; log=sdk.log']);
  child.emit('close'); tick(); stop(); assert.equal(lines.length, 1); assert.equal(cleared, 1);
  const failingChild = Object.assign(new EventEmitter(), { exitCode: null, signalCode: null });
  startSdkProgress(failingChild, { enabled: true, ...dependencies, write: () => { throw new Error('sink closed'); }, onError: () => { errors++; } });
  tick(); tick(); assert.equal(errors, 1); assert.equal(cleared, 2);
  assert.equal(preserveStatus(143, ['CI_PROGRESS_WRITE_FAILED']), 143);
});

// Browser/native assertions cannot exercise the wrapper's pre-SDK output limit.
test('large real Git diffs retain complete legacy identity and refuse Git failures', async () => {
  const fixture = mkdtempSync(join(tmpdir(), 'noctalia-large-diff-'));
  const repository = join(fixture, 'repository');
  mkdirSync(repository);
  const env = { ...process.env, GIT_AUTHOR_NAME: 'Public fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'Public fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' };
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: repository, env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    assert.ifError(result.error); assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  try {
    git('init', '-q');
    writeFileSync(join(repository, 'public.txt'), 'public base\n');
    git('add', 'public.txt');
    const tree = git('write-tree').trim();
    git('update-ref', 'HEAD', git('commit-tree', tree, '-m', 'public fixture').trim());
    assert.equal(await trackedDiffSha256(repository, env), sha(''));
    const content = 'public unicode café line\n'.repeat(100000);
    writeFileSync(join(repository, 'public.txt'), content + 'public tail one\n');
    const previous = spawnSync('git', ['diff', 'HEAD'], { cwd: repository, env, encoding: 'utf8' });
    assert.equal(previous.error?.code, 'ENOBUFS', 'the fixture must reproduce the former default buffer limit');
    const full = git('diff', 'HEAD');
    assert.ok(Buffer.byteLength(full) > 2 * 1024 * 1024);
    const first = await trackedDiffSha256(repository, env);
    assert.equal(first, sha(full.trim()));
    writeFileSync(join(repository, 'public.txt'), content + 'public tail two\n');
    const changed = await trackedDiffSha256(repository, env);
    assert.equal(changed, sha(git('diff', 'HEAD').trim()));
    assert.notEqual(changed, first, 'changes beyond the former capture limit must change identity');
    await assert.rejects(trackedDiffSha256(fixture, env), /git diff failed \(exit/);
    const noGit = Object.fromEntries(Object.entries(env).filter(([key]) => key.toUpperCase() !== 'PATH'));
    await assert.rejects(trackedDiffSha256(repository, { ...noGit, PATH: join(fixture, 'missing-bin') }), { code: 'ENOENT' });
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

// A real VM pause cannot be staged in CI; drive the heartbeat's clocks directly.
test('the host stall monitor reports a frozen host and never a busy-but-running one', () => {
  let wall = Date.parse('2026-10-19T22:50:43Z'), mono = 1000, tick, cleared = 0;
  const stop = startHostStallMonitor({ now: () => wall, monotonic: () => mono,
    setTimer: (fn, ms) => { tick = fn; assert.equal(ms, 1000); return { unref() {} }; }, clearTimer: () => { cleared++; } });
  const advance = (ms, { wallOnly = false } = {}) => { wall += ms; if (!wallOnly) mono += ms; tick(); };
  for (let i = 0; i < 120; i++) advance(1000);
  advance(1000 + HOST_STALL_MS - 1); // a late tick just under the limit is ordinary scheduling noise
  advance(279_000); // the 2026-10-19 freeze: both clocks jump
  advance(1000);
  advance(95_000, { wallOnly: true }); // a pause the monotonic clock did not count still shows on the wall clock
  const stalls = stop(); stop();
  assert.equal(cleared, 1);
  assert.deepEqual(stalls.map(stall => [stall.wallGapMs, stall.monotonicGapMs]), [[279000, 279000], [95000, 0]]);
  assert.equal(stalls[0].resumedAt, new Date(Date.parse('2026-10-19T22:50:43Z') + 121_000 + HOST_STALL_MS - 1 + 279_000).toISOString());
});

