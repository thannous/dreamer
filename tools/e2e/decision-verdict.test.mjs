import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { decisionFilter } from '@e2e-dev/decision';
import { FAILURE_TTL_MS, decisionVerdict, verdictKey } from './decision-verdict.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

const INTERNAL = 'SENTINEL-INTERNE';

/**
 * A repository whose last commit changes one app file the two journeys may or may not reach,
 * and with `docs`, an internal doc and a Markdown file too.
 */
function repository({ docs = false } = {}) {
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
  if (docs) {
    mkdirSync(join(root, 'doc_web_interne'));
    writeFileSync(join(root, 'doc_web_interne/ops.md'), `${INTERNAL}: the moon card ships on Fridays.\n`);
    writeFileSync(join(root, 'AGENTS.md'), `${INTERNAL}: read the moon card first.\n`);
    git(root, 'add', '.');
  }
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

/** An offline decision model: the moon journey is likely affected, the billing one is not. `states` keeps what it was sent. */
function fakeModel(calls, fail = false, states = []) {
  return {
    specificationVersion: 'v4', provider: 'fake', modelId: 'fake-decisions', supportedQuestionTypes: ['boolean'],
    async doDecide({ state, questions }) {
      calls.push(Object.keys(questions).length);
      states.push(JSON.stringify(state));
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
    // decision 0.3.3 scores the journey it keeps with the model's answer; the score is kept with the verdict.
    assert.equal(first.relevance['tests/today.web.e2e.ts::today shows the moon'], 0.9);
    // `e2e run` after `e2e list`: same commit, change and tests, so the same answer and no call.
    const second = await decisionVerdict(tests, context(root, base), { load });
    assert.deepEqual(second.exclude, first.exclude);
    assert.deepEqual(second.relevance, first.relevance);
    assert.match(second.note, /^verdict repris/);
    assert.equal(loads, 1);
    // Another test set is another question.
    await decisionVerdict(tests.slice(0, 1), context(root, base), { load });
    assert.equal(loads, 2);
    assert.equal(readdirSync(join(root, '.git/verify-cache/e2e-decision')).length, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('internal docs and Markdown never reach the model, and a change of only those asks nothing', async () => {
  const { root, base } = repository({ docs: true });
  try {
    const calls = [], states = [];
    let loads = 0;
    const load = async () => { loads += 1; return decisionFilter({ model: fakeModel(calls, false, states) }); };
    const changed = files => ({ ...context(root, base), changes: { base, root, files } });
    const verdict = await decisionVerdict(tests, changed(['AGENTS.md', 'components/MoonCard.tsx', 'doc_web_interne/ops.md']), { load });
    assert.deepEqual(Object.keys(verdict.exclude), ['tests/billing.web.e2e.ts::billing opens the paywall']);
    assert.equal(states.length, 1);
    assert.match(states[0], /components\/MoonCard\.tsx/);
    assert.doesNotMatch(states[0], new RegExp(`${INTERNAL}|doc_web_interne|AGENTS\\.md`));
    // Only docs changed: the model is not asked and every parcours the zones left out stays out.
    const docsOnly = await decisionVerdict(tests, changed(['doc_web_interne/ops.md']), { load });
    assert.equal(loads, 1);
    assert.deepEqual(Object.keys(docsOnly.exclude).sort(), tests.map(row => row.id).sort());
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a model that cannot answer throws, and the run falls back as its list did until the failure expires', async () => {
  const { root, base } = repository();
  try {
    const calls = [];
    let clock = 1_000_000;
    const now = () => clock;
    const load = async () => decisionFilter({ model: fakeModel(calls, true) });
    await assert.rejects(decisionVerdict(tests, context(root, base), { load, now }), /401 invalid key/);
    assert.equal(calls.length, 1);
    // `e2e run` right after: the same failure, without asking again.
    clock += FAILURE_TTL_MS - 1;
    await assert.rejects(decisionVerdict(tests, context(root, base), { load, now }), /401 invalid key \(echec repris\)/);
    assert.equal(calls.length, 1);
    // A later verify:pr asks again.
    clock += 1;
    await assert.rejects(decisionVerdict(tests, context(root, base), { load, now }), /^Error: 401 invalid key$/);
    assert.equal(calls.length, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('an interrupted run keeps no failure', async () => {
  const { root, base } = repository();
  try {
    const interrupt = new AbortController();
    interrupt.abort(new Error('SIGINT'));
    const load = async () => ({ name: 'decision', filter: async () => { throw new Error('aborted'); } });
    await assert.rejects(decisionVerdict(tests, { ...context(root, base), signal: interrupt.signal }, { load }), /aborted/);
    assert.equal(existsSync(join(root, '.git/verify-cache/e2e-decision')), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a new commit, base, change or model is a new verdict', () => {
  const input = { model: 'gpt-6-luna', base: 'a', head: 'b', files: ['x', 'y'], tests: ['t1', 't2'] };
  const key = verdictKey(input);
  assert.equal(verdictKey({ ...input, files: ['y', 'x'], tests: ['t2', 't1'] }), key);
  for (const change of [{ head: 'c' }, { base: 'c' }, { files: ['x'] }, { tests: ['t1'] }, { model: 'gpt-6-sol' }])
    assert.notEqual(verdictKey({ ...input, ...change }), key, JSON.stringify(change));
});
