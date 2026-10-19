#!/usr/bin/env node
// Production publish guard of noctalia.app: first step of
// `npm run docs:deploy:prod` (scripts/docs-deploy.js prod), and runnable alone:
// `node scripts/check-site-publish-proof.mjs`.
//
// A production publish uploads only the exact commit of origin/master on which
// `npm run verify:release:site` (or `npm run verify:release`, which also runs
// the checks of the `app` target) passed. The checks are those of the common delivery
// rule (doc_web_interne/docs/regle-commune-livraison.md), run by
// checkReleaseProof of scripts/verify-local.mjs. The guard fetches master and
// refuses to continue when:
//   - HEAD is not origin/master after the fetch (head-is-origin-main),
//   - the checkout is dirty: modified, staged, or untracked files that are not
//     ignored (clean-tree),
//   - no proof exists for the tree of HEAD, or it has an older format
//     (proof-present),
//   - the proof is a `pr` proof (proof-kind): only a release proof unlocks a
//     publish,
//   - the release did not pass, or is incomplete because a specialised check
//     could not run and has no --external owner-machine evidence (proof-passed),
//   - the proof was written for another commit with the same tree, such as a
//     branch before its squash (proof-matches-head),
//   - an external entry is not a specialised check, or its evidence does not
//     name this commit, or cites an https source outside externalSources
//     (proof-external),
//   - the commit's run log has no release run, or its latest release run did
//     not pass on fresh results (proof-latest-release); a latest run whose
//     only unpassed checks belong to a target this publish does not ask for
//     is left out,
//   - a check is still open: its latest real result did not pass and no later
//     run reran it and passed (proof-open-check); a check of a target this
//     publish does not ask for is left out,
//   - a publish that asks for a release target (web:deploy:prod asks for
//     `app`) finds a proof that does not cover it (proof-target).
// The site publish asks for no target, so the checks of the `app` target (the
// web app build, its native backend journey, the TesterArmy app
// campaigns) do not hold it back.
// There is no override of any kind: a refused publish is fixed by publishing
// the right commit after verify:release, never by a flag or a variable.
// Preview uploads (`npm run docs:deploy:preview`) are not guarded.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ENGINE_FILE_SHA256,
  checkReleaseProof,
  cleanGitEnv,
  createGit,
  loadConfig,
  loadExternalSources,
  openChecks,
  readRunLog,
} from './verify-local.mjs';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PREFIX = '[site-publish-proof]';

export const MAIN_BRANCH = 'master';
// `release --target app` and `release` (package.json): the only target is app.
export const RELEASE_COMMAND = 'npm run verify:release';
export const SITE_RELEASE_COMMAND = 'npm run verify:release:site';

/** The command whose proof covers `targets`: the site needs none. */
export function releaseCommand(targets = []) {
  return targets.length ? RELEASE_COMMAND : SITE_RELEASE_COMMAND;
}

/** Every check the guard runs, named as checkReleaseProof names them. */
export const SITE_PUBLISH_PROOF_CHECKS = Object.freeze([
  'head-is-origin-main',
  'clean-tree',
  'proof-present',
  'proof-kind',
  'proof-passed',
  'proof-matches-head',
  'proof-target',
  'proof-external',
  'proof-engine',
  'proof-latest-release',
  'proof-open-check',
]);

/**
 * Run every check and collect the failures.
 *
 * `fetch: false` skips `git fetch origin master` (tests of a fixture that
 * has no network); the guard itself always fetches. `gitEnv` is the
 * environment of the git commands (tests pass a scratch git environment).
 * `targets` are the release targets the proof must cover (none for the site).
 */
export async function checkSitePublishProof({ root = defaultRoot, gitEnv, fetch = true, targets = [] } = {}) {
  const gitVariables = cleanGitEnv(gitEnv ?? process.env);
  const release = await checkReleaseProof({
    cwd: root,
    env: gitVariables,
    targets,
    fetch,
    mainBranch: MAIN_BRANCH,
    // External evidence is checked again against the externalSources of the
    // config committed at HEAD (empty here, so only owner-machine evidence
    // counts).
    externalSources: await loadExternalSources({ cwd: root, env: gitVariables }),
  });
  const { head, tree } = release;
  const failures = await withoutOtherTargets(release.failures, { root, env: gitVariables, head, targets });
  return { ok: failures.length === 0, head, tree, failures, proof: release.proof };
}

// checkReleaseProof judges every run of the commit. A check of a target this
// publish does not ask for never holds it back: e2e-backend left unavailable
// by `npm run verify:release` on a machine without the native Supabase runtime must not block the
// site publish that `npm run verify:release:site` proves, whether that app run
// came before the site run (it left the check open) or after it (it is also
// the latest release run). Any other open or unpassed check, an unreadable run
// log line, or a latest release run of another engine still refuses.
const TARGET_FAILURES = new Set(['proof-open-check', 'proof-latest-release']);

async function withoutOtherTargets(failures, { root, env, head, targets }) {
  if (!failures.some((failure) => TARGET_FAILURES.has(failure.check))) return failures;
  const git = createGit(root, env);
  const config = await loadConfig(git, 'HEAD');
  const outside = new Set(config.checks
    .filter((check) => check.targets && !check.targets.some((target) => targets.includes(target)))
    .map((check) => check.name));
  const commonDir = git(['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const runs = readRunLog(commonDir, head);
  const cleared = new Set();
  if (openChecks(runs, [], ENGINE_FILE_SHA256).every((item) => outside.has(item.check))) cleared.add('proof-open-check');
  const latest = runs.filter((entry) => entry.kind === 'release').at(-1);
  const unpassed = (latest?.checks ?? []).filter((check) => check.reused || !['passed', 'skipped'].includes(check.result));
  if (latest?.engine === ENGINE_FILE_SHA256 && unpassed.length && unpassed.every((check) => outside.has(check.name))) {
    cleared.add('proof-latest-release');
  }
  return failures.filter((failure) => !cleared.has(failure.check));
}

export const DEFAULT_LABEL = 'noctalia.app';

export function formatRefusal(result, label = DEFAULT_LABEL, targets = []) {
  const problems = result.failures.map((failure) => failure.message);
  const command = releaseCommand(targets);
  return (
    `${PREFIX} production publish of ${label} refused: ${problems.join('; ')}. `
    + `A production publish uploads only the exact origin/master commit on which \`${command}\` passed. `
    + 'Check out master and update it (`git switch master && git pull --ff-only`), commit, stash or remove local changes, '
    + `run \`${command}\` (it writes the release proof of HEAD in the shared git directory; a specialised check `
    + 'that cannot run here takes --external <check>="owner-machine: <host> <note> on <SHA>"), then publish again. '
    + 'There is no override.'
  );
}

export function formatAccepted(result, targets = []) {
  return `${PREFIX} OK: HEAD ${result.head} is origin/${MAIN_BRANCH}, the checkout is clean, and ${releaseCommand(targets)} passed on it (tree ${result.tree}).`;
}

/**
 * The guard as one call: resolves with { head, tree, message } for the
 * accepted commit, or throws an Error whose message is the refusal.
 * scripts/docs-deploy.js awaits it before any build of a production publish,
 * and again right before the upload, which must find the same HEAD.
 */
export async function assertSitePublishProof({ label = DEFAULT_LABEL, targets = [], ...options } = {}) {
  let result;
  try {
    result = await checkSitePublishProof({ ...options, targets });
  } catch (error) {
    throw new Error(`${PREFIX} production publish of ${label} refused: the guard could not run (${String(error?.message || error).split('\n')[0]}).`);
  }
  if (!result.ok) throw new Error(formatRefusal(result, label, targets));
  return { head: result.head, tree: result.tree, message: formatAccepted(result, targets) };
}

function parseRoot(argv) {
  const index = argv.indexOf('--root');
  return index !== -1 && argv[index + 1] ? path.resolve(argv[index + 1]) : defaultRoot;
}

async function main(argv) {
  try {
    console.log((await assertSitePublishProof({ root: parseRoot(argv) })).message);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
