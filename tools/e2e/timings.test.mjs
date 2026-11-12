// timings.mjs reads a finished run. These cases use a small made-up report: the slow
// steps that repeat are grouped by API and label, the three ways to name a report
// resolve to the same file, and two runs compare figure by figure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compare, formatComparison, formatSummary, keptReports, resolveReport, summarise } from './timings.mjs';

const step = (api, label, durationMs, line) => ({ api, label, durationMs, status: 'passed', source: { file: 'tests/a.web.e2e.ts', line } });
const card = 'getByTestId("component.transcriptCard")';

function report({ wait = 4000, open = 500 } = {}) {
  return {
    schemaVersion: 'report-1',
    run: {
      status: 'passed',
      startedAt: '2026-11-12T10:00:00.000Z',
      finishedAt: '2026-11-12T10:00:20.000Z',
      summary: { discovered: 3, selected: 3, executed: 3, passed: 3, failed: 0, skipped: 0 },
      usage: { artifactBytes: 3000 },
      results: [
        { file: 'tests/a.web.e2e.ts', titlePath: ['saves a dream'], status: 'passed', attempts: [{ durationMs: 9000,
          steps: [step('app.open', '/', open, 3), step('expect.toContainText', card, wait, 10), step('locator.tap', 'getByTestId("btn.save")', 200, 11)],
          artifacts: [{ kind: 'screenshot', size: 1000 }] }] },
        { file: 'tests/a.web.e2e.ts', titlePath: ['group', 'reads a dream'], status: 'passed', attempts: [{ durationMs: 6000,
          steps: [step('app.open', '/', open, 3), step('expect.toContainText', card, wait, 20)],
          artifacts: [{ kind: 'screenshot', size: 1500 }, { kind: 'trace', size: 500 }] }] },
        { file: 'tests/b.web.e2e.ts', titlePath: ['opens'], status: 'passed', attempts: [{ durationMs: 2000,
          steps: [step('app.open', '/b', open, 3), step('expect.toContainText', 'getByTestId("other")', 3500, 5)], artifacts: [] }] },
        { file: 'tests/b.web.e2e.ts', titlePath: ['skipped'], status: 'skipped', attempts: [] },
      ],
    },
  };
}

test('the run, its files, tests, APIs and artifacts are summed from the attempts', () => {
  const summary = summarise(report());
  assert.deepEqual(summary.run, { status: 'passed', summary: report().run.summary, wallMs: 20_000, testMs: 17_000, artifactBytes: 3000, files: 2 });
  assert.deepEqual(summary.files, [{ file: 'tests/a.web.e2e.ts', ms: 15_000, tests: 2 }, { file: 'tests/b.web.e2e.ts', ms: 2000, tests: 2 }]);
  assert.equal(summary.tests[1].title, 'group › reads a dream');
  assert.deepEqual(summary.apis.map(({ api, ms, count }) => [api, ms, count]),
    [['expect.toContainText', 11_500, 3], ['app.open', 1500, 3], ['locator.tap', 200, 1]]);
  assert.deepEqual(summary.steps[0], { api: 'expect.toContainText', label: card, status: 'passed', ms: 4000, source: 'tests/a.web.e2e.ts:10', test: 'saves a dream' });
  assert.deepEqual(summary.artifacts, [{ kind: 'screenshot', count: 2, bytes: 2500 }, { kind: 'trace', count: 1, bytes: 500 }]);
});

test('slow steps are grouped by API and label, with the lines that wait', () => {
  const { slow } = summarise(report(), { slow: 3000 });
  assert.deepEqual(slow.groups, [
    { api: 'expect.toContainText', label: card, sources: ['tests/a.web.e2e.ts:10', 'tests/a.web.e2e.ts:20'], ms: 8000, count: 2 },
    { api: 'expect.toContainText', label: 'getByTestId("other")', sources: ['tests/a.web.e2e.ts:5'], ms: 3500, count: 1 },
  ]);
  assert.deepEqual(summarise(report(), { slow: 3600 }).slow.groups.map(group => group.count), [2], 'a step under the threshold is not slow');
  assert.deepEqual(summarise(report(), { top: 1 }).files.length, 1);
  assert.match(formatSummary(summarise(report())), /8\.0 s {2}2 x {2}expect\.toContainText getByTestId\("component\.transcriptCard"\)/);
});

test('a report is named by its file, its run directory or its kept campaign', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'e2e-timings-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const run = join(dir, 'run');
  const kept = keptReports(join(dir, 'git'));
  mkdirSync(run);
  mkdirSync(kept, { recursive: true });
  writeFileSync(join(run, 'report.json'), JSON.stringify(report()));
  writeFileSync(join(kept, 'dreamer-web.report.json'), JSON.stringify(report()));
  const commonDir = join(dir, 'git');
  assert.equal(resolveReport(join(run, 'report.json'), commonDir), join(run, 'report.json'));
  assert.equal(resolveReport(run, commonDir), join(run, 'report.json'));
  assert.equal(resolveReport('dreamer-web', commonDir), join(kept, 'dreamer-web.report.json'));
  assert.throws(() => resolveReport('lucid-ios', commonDir), /No kept report for lucid-ios\. Kept: dreamer-web\./);
  assert.throws(() => resolveReport(dir, commonDir), /holds no report\.json/);
  assert.throws(() => resolveReport('not/a/report.json', commonDir), /neither a report/);
});

test('two runs compare their wall time, test time, artifacts and time per API', () => {
  const before = summarise(report());
  const after = summarise({ run: { ...report({ wait: 1000, open: 600 }).run, finishedAt: '2026-11-12T10:00:12.000Z', usage: { artifactBytes: 1000 } } });
  const comparison = compare(before, after);
  assert.deepEqual(comparison.wallMs, { before: 20_000, after: 12_000, delta: -8000 });
  assert.deepEqual(comparison.artifactBytes, { before: 3000, after: 1000, delta: -2000 });
  assert.deepEqual(comparison.testMs, { before: 17_000, after: 17_000, delta: 0 });
  assert.deepEqual(comparison.apis.map(({ api, deltaMs }) => [api, deltaMs]), [['expect.toContainText', -6000], ['app.open', 300], ['locator.tap', 0]]);
  // An API only one run calls is still listed, at zero on the other side.
  const gone = compare(before, { ...after, apis: after.apis.filter(api => api.api !== 'locator.tap') });
  assert.deepEqual(gone.apis.at(-1), { api: 'locator.tap', before: { ms: 200, count: 1 }, after: { ms: 0, count: 0 }, deltaMs: -200 });
  assert.match(formatComparison(comparison), /wall\s+20\.0 s\s+12\.0 s\s+-8\.0 s/);
});

test('a run that recorded no step, and --top 0, still print the run', () => {
  const skipped = { schemaVersion: 'report-1', run: { status: 'passed', startedAt: '2026-11-12T10:00:00.000Z', finishedAt: '2026-11-12T10:00:01.000Z',
    summary: { discovered: 1, selected: 1, executed: 0, skipped: 1 }, results: [{ file: 'tests/b.web.e2e.ts', titlePath: ['skipped'], status: 'skipped', attempts: [] }] } };
  const empty = formatSummary(summarise(skipped));
  assert.match(empty, /^Run: passed \(1 discovered, 1 selected, 1 skipped\)/);
  assert.match(empty, /Time by step API:\n {2}none/);
  const none = formatSummary(summarise(report(), { top: 0 }), 0);
  assert.match(none, /Slowest files:\n {2}none/);
});
