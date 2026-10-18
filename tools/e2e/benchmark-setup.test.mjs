import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { benchmark, measure, median, parseArgs } from './benchmark-setup.mjs';

// A browser journey cannot detect a forged performance receipt, a benchmark
// inadvertently launching a suite, or a failed download reported as a speedup.
test('bounded repetition count and medians have the same cases on every host', () => {
  assert.equal(parseArgs([]), 3);
  for (const runs of ['1', '2', '3', '4', '5']) assert.equal(parseArgs(['--runs', runs]), Number(runs));
  for (const args of [['--runs', '0'], ['--runs', '6'], ['--runs', '1.5'], ['--runs'], ['--headed'], ['--runs', '1', '--skip']])
    assert.throws(() => parseArgs(args), /Usage/);
  assert.equal(median([3, 9, 1]), 3);
  assert.equal(median([9, 1]), 5);
});

test('real subprocess success and failure are recorded, with signal and error failures simulated everywhere', t => {
  const directory = mkdtempSync(join(tmpdir(), 'e2e-benchmark-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const options = { cwd: directory, env: process.env, log: join(directory, 'phase.log') };
  assert.equal(measure(process.execPath, ['-e', 'console.log("measured");'], options).passed, true);
  assert.match(readFileSync(options.log, 'utf8'), /measured/);
  assert.equal(measure(process.execPath, ['-e', 'process.exit(23)'], options).passed, false);
  for (const result of [{ status: null, signal: 'SIGTERM' }, { status: null, error: new Error('spawn failed') }, { status: null }])
    assert.equal(measure(process.execPath, [], { ...options, launch: () => result }).passed, false);
});

test('failed installation retains a nonqualifying receipt and prevents browser measurements', t => {
  const repository = mkdtempSync(join(tmpdir(), 'e2e-benchmark-failure-'));
  t.after(() => rmSync(repository, { recursive: true, force: true }));
  spawnSync('git', ['init', '-q'], { cwd: repository });
  // rev-parse needs a commit; commit-tree needs no global Git identity.
  const env = { ...process.env, GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@invalid', GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@invalid' };
  const tree = spawnSync('git', ['mktree'], { cwd: repository, input: '', encoding: 'utf8' }).stdout.trim();
  const sha = spawnSync('git', ['commit-tree', tree, '-m', 'fixture'], { cwd: repository, env, encoding: 'utf8' }).stdout.trim();
  assert.equal(spawnSync('git', ['update-ref', 'HEAD', sha], { cwd: repository }).status, 0);
  const tool = join(repository, 'tools/e2e');
  mkdirSync(tool, { recursive: true });
  for (const name of ['package.json', 'package-lock.json', 'install-browsers.mjs', 'benchmark-setup.mjs']) writeFileSync(join(tool, name), '{}');
  let calls = 0;
  assert.throws(() => benchmark(1, { repository, npmCli: 'npm-cli.js', phase: (command, args) => {
    calls++;
    assert.equal(command, process.execPath);
    assert.equal(args[1], 'ci');
    return { passed: false, exitCode: 23, elapsedMs: 1 };
  } }), /npm-1 failed/);
  assert.equal(calls, 1);
  const results = join(repository, '.tmp/e2e-benchmark/results');
  const receipt = JSON.parse(readFileSync(join(results, readdirSync(results)[0], 'benchmark.json'), 'utf8'));
  assert.equal(receipt.passed, false);
  assert.equal(receipt.applicationQualified, false);
  assert.equal(receipt.samples[0].exitCode, 23);
  assert.equal(receipt.summary, undefined);
});
