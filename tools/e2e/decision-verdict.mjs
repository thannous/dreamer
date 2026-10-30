/**
 * The decision model's verdict on the parcours the zones leave out, through
 * the TesterArmy Filters API (`@e2e-dev/decision`, Jev on the Vercel AI
 * Gateway). run.mjs calls the filters twice, `e2e list` then `e2e run`, and
 * checks that the run selected exactly what the list did, so the first answer
 * for a commit and a test set is kept in the clone's git directory and reused.
 * A rerun of verify:pr on the same commit asks nothing either. A failure is
 * kept for a few minutes only: long enough for the run to fall back to the
 * zones as its list did, short enough for a later verify:pr to ask again.
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

/** How long a failed answer stands for the same question. */
export const FAILURE_TTL_MS = 10 * 60_000;

function readVerdict(file, now) {
  try {
    const kept = JSON.parse(readFileSync(file, 'utf8'));
    if (kept && typeof kept.failed === 'string' && Number.isFinite(kept.at))
      return now - kept.at < FAILURE_TTL_MS ? kept : null;
    if (kept && typeof kept.exclude === 'object' && kept.exclude !== null && !Array.isArray(kept.exclude)
      && Object.values(kept.exclude).every(reason => typeof reason === 'string')) return kept;
  } catch {}
  return null;
}

function keep(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(`${file}.${process.pid}`, JSON.stringify(value));
  renameSync(`${file}.${process.pid}`, file);
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
 * at all (no route, every call failed, past the caller's deadline); the caller
 * then keeps the zones alone. An interrupted run keeps no failure.
 * @param {readonly import('e2e').TestFilterCandidate[]} asked
 * @param {import('e2e').TestFilterContext} context
 */
export async function decisionVerdict(asked, context, { load = loadDecisionFilter, git = execFileSync, now = Date.now } = {}) {
  const root = context.changes.root;
  const key = verdictKey({
    model: DECISION_MODEL, base: context.changes.base, head: gitRead(git, root, ['rev-parse', 'HEAD']),
    files: context.changes.files, tests: asked.map(test => test.id),
  });
  const file = join(gitRead(git, root, ['rev-parse', '--path-format=absolute', '--git-common-dir']), 'verify-cache', 'e2e-decision', `${key}.json`);
  const cached = readVerdict(file, now());
  if (cached?.failed !== undefined) throw new Error(`${cached.failed} (echec repris)`);
  if (cached) return { exclude: cached.exclude, note: ['verdict repris', cached.note].filter(Boolean).join(', ') };
  let verdict;
  try {
    verdict = await (await load()).filter(asked, context);
  } catch (error) {
    const interrupted = context.signal.aborted && context.signal.reason?.name !== 'TimeoutError';
    if (!interrupted) keep(file, { failed: (error instanceof Error ? error.message : String(error)).split('\n')[0], at: now() });
    throw error;
  }
  const kept = { exclude: { ...verdict.exclude }, ...(verdict.note ? { note: verdict.note } : {}) };
  keep(file, kept);
  return kept;
}
