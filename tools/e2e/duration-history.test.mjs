// The duration history only orders files. These cases keep it fail closed:
// a seed the run did not replace never survives as this run's report, and a
// blocked, failed or selected run never replaces the history of a full run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedDurations, keepDurations } from './duration-history.mjs';

const report = (status, passed, marker) => JSON.stringify({ run: { status, summary: { passed } }, marker });

function setup(t, previous) {
  const dir = mkdtempSync(join(tmpdir(), 'e2e-durations-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const output = join(dir, 'output');
  mkdirSync(output);
  const history = join(dir, 'git', 'verify-cache', 'e2e-durations', 'dreamer-web.report.json');
  if (previous !== undefined) {
    mkdirSync(join(dir, 'git', 'verify-cache', 'e2e-durations'), { recursive: true });
    writeFileSync(history, previous);
  }
  // One run: seed the output directory, let the "SDK" write (or not), keep.
  const run = ({ writes, selected = false }) => {
    const seed = seedDurations(history, output);
    if (writes !== undefined) writeFileSync(join(output, 'report.json'), writes);
    keepDurations(history, seed, selected, output);
    return seed;
  };
  const kept = () => (existsSync(history) ? readFileSync(history, 'utf8') : null);
  const left = () => (existsSync(join(output, 'report.json')) ? readFileSync(join(output, 'report.json'), 'utf8') : null);
  return { history, output, run, kept, left, dir };
}

test('the previous full run seeds the new output directory', (t) => {
  const previous = report('passed', 12, 'previous');
  const { history, output } = setup(t, previous);
  const seed = seedDurations(history, output);
  assert.equal(seed.toString(), previous);
  assert.equal(readFileSync(join(output, 'report.json'), 'utf8'), previous);
});

test('without a history the run starts unseeded and nothing is written', (t) => {
  const { history, output, left } = setup(t);
  assert.equal(seedDurations(history, output), null);
  assert.equal(seedDurations(null, output), null);
  assert.equal(left(), null);
});

test('a seed the run did not replace is removed and the history is unchanged', (t) => {
  const previous = report('passed', 12, 'previous');
  const { run, kept, left } = setup(t, previous);
  run({});
  assert.equal(left(), null);
  assert.equal(kept(), previous);
});

test('a full run that reached the app replaces the history', (t) => {
  const current = report('failed', 3, 'current');
  const { run, kept, left } = setup(t, report('passed', 12, 'previous'));
  run({ writes: current });
  assert.equal(kept(), current);
  assert.equal(left(), current);
});

test('the first full run creates the history', (t) => {
  const current = report('passed', 12, 'current');
  const { run, kept, dir } = setup(t);
  run({ writes: current });
  assert.equal(kept(), current);
  assert.deepEqual(readdirNames(join(dir, 'git', 'verify-cache', 'e2e-durations')), ['dreamer-web.report.json']);
});

for (const [name, writes] of [
  ['a blocked run', report('blocked', 0, 'blocked')],
  ['a blocked run that counted a pass', report('blocked', 2, 'blocked')],
  ['a run with no passed test', report('failed', 0, 'failed')],
  ['an unreadable report', '{not json'],
  ['a report without a summary', JSON.stringify({ run: { status: 'passed' } })],
]) {
  test(`${name} keeps the previous history`, (t) => {
    const previous = report('passed', 12, 'previous');
    const { run, kept, left } = setup(t, previous);
    run({ writes });
    assert.equal(kept(), previous);
    assert.equal(left(), writes);
  });
}

test('a selected run (--grep, --tag, --shard) keeps the previous history', (t) => {
  const previous = report('passed', 12, 'previous');
  const current = report('passed', 1, 'selected');
  const { run, kept, left } = setup(t, previous);
  run({ writes: current, selected: true });
  assert.equal(kept(), previous);
  assert.equal(left(), current);
});

test('a selected run without a history creates none', (t) => {
  const { run, kept } = setup(t);
  run({ writes: report('passed', 1, 'selected'), selected: true });
  assert.equal(kept(), null);
});

function readdirNames(dir) {
  return readdirSync(dir).sort();
}
