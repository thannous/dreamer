// The duration history only orders files. These cases keep it fail closed:
// an output directory never receives another run's report, and a blocked,
// failed or selected run never replaces the history of a full run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedDurations, keepDurations, timingsHistory } from './duration-history.mjs';
// The timings report reads the kept reports; it joins this file instead of a new
// package.json script: root scripts feed the Expo runtime fingerprint.
import './timings.test.mjs';

const report = (status, passed, marker) => JSON.stringify({ run: { status, summary: { passed } }, marker });
const timings = ms => JSON.stringify({ schemaVersion: 'timings-1', files: { 'dreamer-web::tests/a.web.e2e.ts': ms } });

function setup(t, previous) {
  const dir = mkdtempSync(join(tmpdir(), 'e2e-durations-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const output = join(dir, 'output');
  mkdirSync(output);
  const history = join(dir, 'git', 'verify-cache', 'e2e-durations', 'dreamer-web.report.json');
  if (previous !== undefined) {
    mkdirSync(join(dir, 'git', 'verify-cache', 'e2e-durations'), { recursive: true });
    writeFileSync(history, previous.report);
    writeFileSync(timingsHistory(history), previous.timings);
  }
  // One run: seed the output directory, let the "SDK" write its report and fold its timings (or not), keep.
  const run = ({ writes, folds, selected = false }) => {
    const seeded = seedDurations(history, output);
    if (writes !== undefined) writeFileSync(join(output, 'report.json'), writes);
    if (folds !== undefined) writeFileSync(join(output, 'timings.json'), folds);
    keepDurations(history, selected, output);
    return seeded;
  };
  const read = file => (existsSync(file) ? readFileSync(file, 'utf8') : null);
  const kept = () => ({ report: read(history), timings: read(timingsHistory(history)) });
  const left = () => read(join(output, 'report.json'));
  return { history, output, run, kept, left, dir };
}

const previous = { report: report('passed', 12, 'previous'), timings: timings(9000) };

test('the kept timings seed the new output directory, and never a report', (t) => {
  const { history, output, left } = setup(t, previous);
  assert.equal(seedDurations(history, output), true);
  assert.equal(readFileSync(join(output, 'timings.json'), 'utf8'), previous.timings);
  assert.equal(left(), null);
  // An output directory that already has timings keeps them.
  assert.equal(seedDurations(history, output), false);
});

test('without a history the run starts unseeded and nothing is written', (t) => {
  const { history, output, dir } = setup(t);
  assert.equal(seedDurations(history, output), false);
  assert.equal(seedDurations(null, output), false);
  assert.deepEqual(readdirNames(output), []);
  assert.equal(existsSync(join(dir, 'git')), false);
});

test('a run that wrote no report leaves the history unchanged', (t) => {
  const { run, kept, left } = setup(t, previous);
  run({});
  assert.equal(left(), null);
  assert.deepEqual(kept(), previous);
});

test('a full run that reached the app replaces the report and the timings e2e folded', (t) => {
  const current = report('failed', 3, 'current');
  const { run, kept, left } = setup(t, previous);
  assert.equal(run({ writes: current, folds: timings(8000) }), true);
  assert.deepEqual(kept(), { report: current, timings: timings(8000) });
  assert.equal(left(), current);
});

test('the first full run creates the history', (t) => {
  const current = report('passed', 12, 'current');
  const { run, kept, dir } = setup(t);
  run({ writes: current, folds: timings(7000) });
  assert.deepEqual(kept(), { report: current, timings: timings(7000) });
  assert.deepEqual(readdirNames(join(dir, 'git', 'verify-cache', 'e2e-durations')), ['dreamer-web.report.json', 'dreamer-web.timings.json']);
});

for (const [name, writes] of [
  ['a blocked run', report('blocked', 0, 'blocked')],
  ['a blocked run that counted a pass', report('blocked', 2, 'blocked')],
  ['a run with no passed test', report('failed', 0, 'failed')],
  ['an unreadable report', '{not json'],
  ['a report without a summary', JSON.stringify({ run: { status: 'passed' } })],
]) {
  test(`${name} keeps the previous history`, (t) => {
    const { run, kept, left } = setup(t, previous);
    run({ writes, folds: timings(1) });
    assert.deepEqual(kept(), previous);
    assert.equal(left(), writes);
  });
}

test('a selected run (--grep, --tag, --shard) keeps the previous history', (t) => {
  const current = report('passed', 1, 'selected');
  const { run, kept, left } = setup(t, previous);
  run({ writes: current, folds: timings(1), selected: true });
  assert.deepEqual(kept(), previous);
  assert.equal(left(), current);
});

test('a selected run without a history creates none', (t) => {
  const { run, kept } = setup(t);
  run({ writes: report('passed', 1, 'selected'), folds: timings(1), selected: true });
  assert.deepEqual(kept(), { report: null, timings: null });
});

function readdirNames(dir) {
  return readdirSync(dir).sort();
}
