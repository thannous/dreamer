import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { decisionFilter } from '@e2e-dev/decision';
import { decisionVerdict, verdictKey } from './decision-verdict.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

/** A repository whose last commit changes one app file the two journeys may or may not reach. */
function repository() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'decision-verdict-')));
  git(root, 'init', '-q', '-b', 'master');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'test');
  mkdirSync(join(root, 'tests'));
  mkdirSync(join(root, 'components'));
  writeFileSync(join(root, 'tests/today.web.e2e.ts'), "test('today shows the moon', async () => {});\n");
  writeFileSync(join(root, 'tests/billing.web.e2e.ts'), "test('billing opens the paywall', async () => {});\n");
  writeFileSync(join(root, 'components/MoonCard.tsx'), 'export const phase = 1;\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'base');
  const base = git(root, 'rev-parse', 'HEAD');
  writeFileSync(join(root, 'components/MoonCard.tsx'), 'export const phase = 2;\n');
  git(root, 'commit', '-qam', 'change');
  return { root, base };
}

const tests = [
  { id: 'tests/today.web.e2e.ts::today shows the moon', file: 'tests/today.web.e2e.ts', titlePath: ['today shows the moon'], tags: [] },
  { id: 'tests/billing.web.e2e.ts::billing opens the paywall', file: 'tests/billing.web.e2e.ts', titlePath: ['billing opens the paywall'], tags: [] },
];

function context(root, base) {
  return {
    projectRoot: root, changes: { base, root, files: ['components/MoonCard.tsx'] },
    signal: new AbortController().signal, log() {}, redact: text => text,
  };
}

/** An offline decision model: the moon journey is likely affected, the billing one is not. */
function fakeModel(calls, fail = false) {
  return {
    specificationVersion: 'v4', provider: 'fake', modelId: 'fake-jev', supportedQuestionTypes: ['boolean'],
    async doDecide({ questions }) {
      calls.push(Object.keys(questions).length);
      if (fail) throw new Error('401 invalid key');
      return {
        answers: Object.fromEntries(Object.entries(questions).map(([id, question]) =>
          [id, { type: 'boolean', probability: String(question.instructions).includes('billing') ? 0.05 : 0.9 }])),
        usage: { inputTokens: 100, outputTokens: 0 }, warnings: [],
      };
    },
  };
}

test('the real decision filter leaves out the journey the change cannot reach, and the verdict is kept for the run', async () => {
  const { root, base } = repository();
  try {
    const calls = [];
    let loads = 0;
    const load = async () => { loads += 1; return decisionFilter({ model: fakeModel(calls) }); };
    const first = await decisionVerdict(tests, context(root, base), { load });
    assert.deepEqual(Object.keys(first.exclude), ['tests/billing.web.e2e.ts::billing opens the paywall']);
    assert.match(first.exclude['tests/billing.web.e2e.ts::billing opens the paywall'], /5% likely affected/);
    assert.equal(loads, 1);
    assert.equal(calls.length, 1);
    // `e2e run` after `e2e list`: same commit, change and tests, so the same answer and no call.
    const second = await decisionVerdict(tests, context(root, base), { load });
    assert.deepEqual(second.exclude, first.exclude);
    assert.match(second.note, /^verdict repris/);
    assert.equal(loads, 1);
    // Another test set is another question.
    await decisionVerdict(tests.slice(0, 1), context(root, base), { load });
    assert.equal(loads, 2);
    assert.equal(readdirSync(join(root, '.git/verify-cache/e2e-decision')).length, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a model that cannot answer throws and keeps no verdict', async () => {
  const { root, base } = repository();
  try {
    const load = async () => decisionFilter({ model: fakeModel([], true) });
    await assert.rejects(decisionVerdict(tests, context(root, base), { load }), /401 invalid key/);
    assert.equal(existsSync(join(root, '.git/verify-cache/e2e-decision')), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a new commit, base, change or model is a new verdict', () => {
  const input = { model: 'typesafe-ai/jev-1.14.0', base: 'a', head: 'b', files: ['x', 'y'], tests: ['t1', 't2'] };
  const key = verdictKey(input);
  assert.equal(verdictKey({ ...input, files: ['y', 'x'], tests: ['t2', 't1'] }), key);
  for (const change of [{ head: 'c' }, { base: 'c' }, { files: ['x'] }, { tests: ['t1'] }, { model: 'typesafe-ai/jev' }])
    assert.notEqual(verdictKey({ ...input, ...change }), key, JSON.stringify(change));
});
