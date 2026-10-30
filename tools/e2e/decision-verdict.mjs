/**
 * The decision model's verdict on the parcours the zones leave out, through
 * the TesterArmy Filters API (`@e2e-dev/decision`, Jev on the Vercel AI
 * Gateway). run.mjs calls the filters twice, `e2e list` then `e2e run`, and
 * checks that the run selected exactly what the list did, so the first answer
 * for a commit and a test set is kept in the clone's git directory and reused.
 * A rerun of verify:pr on the same commit asks nothing either.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DECISION_MODEL } from './zones.mjs';

/** @param {{ model: string, base: string, head: string, files: readonly string[], tests: readonly string[] }} input */
export function verdictKey({ model, base, head, files, tests }) {
  return createHash('sha256').update(JSON.stringify({ model, base, head, files: [...files].sort(), tests: [...tests].sort() })).digest('hex');
}

function gitRead(git, root, args) {
  return git('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function readVerdict(file) {
  try {
    const kept = JSON.parse(readFileSync(file, 'utf8'));
    if (kept && typeof kept.exclude === 'object' && kept.exclude !== null && !Array.isArray(kept.exclude)
      && Object.values(kept.exclude).every(reason => typeof reason === 'string')) return kept;
  } catch {}
  return null;
}

async function loadDecisionFilter() {
  const [{ decisionFilter }, { gateway }] = await Promise.all([import('@e2e-dev/decision'), import('ai')]);
  return decisionFilter({
    model: gateway.decisionModel(DECISION_MODEL),
    // Only routes that keep nothing: the diff and the journeys leave the machine.
    providerOptions: { gateway: { zeroDataRetention: true } },
  });
}

/**
 * Asks the decision filter about `asked`, or reuses its answer for the same
 * commit, base, changed files and tests. Throws when the model cannot answer
 * at all (no route, every call failed); the caller then keeps the zones alone.
 * @param {readonly import('e2e').TestFilterCandidate[]} asked
 * @param {import('e2e').TestFilterContext} context
 */
export async function decisionVerdict(asked, context, { load = loadDecisionFilter, git = execFileSync } = {}) {
  const root = context.changes.root;
  const key = verdictKey({
    model: DECISION_MODEL, base: context.changes.base, head: gitRead(git, root, ['rev-parse', 'HEAD']),
    files: context.changes.files, tests: asked.map(test => test.id),
  });
  const file = join(gitRead(git, root, ['rev-parse', '--path-format=absolute', '--git-common-dir']), 'verify-cache', 'e2e-decision', `${key}.json`);
  const cached = readVerdict(file);
  if (cached) return { exclude: cached.exclude, note: ['verdict repris', cached.note].filter(Boolean).join(', ') };
  const filter = await load();
  const verdict = await filter.filter(asked, context);
  const kept = { exclude: { ...verdict.exclude }, ...(verdict.note ? { note: verdict.note } : {}) };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(`${file}.${process.pid}`, JSON.stringify(kept));
  renameSync(`${file}.${process.pid}`, file);
  return kept;
}
