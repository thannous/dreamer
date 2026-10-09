#!/usr/bin/env node
// Production publish guard of noctalia.app: first step of
// `npm run docs:deploy:prod` (scripts/docs-deploy.js prod), and runnable alone:
// `node scripts/check-site-publish-proof.mjs`.
//
// A production publish uploads only the exact commit of origin/master on which
// `npm run verify:release` passed. The checks are those of the common delivery
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
//     could not run and was not proven on the owner machine (proof-passed),
//   - the proof was written for another commit with the same tree, such as a
//     branch before its squash (proof-matches-head),
//   - an external entry is not a specialised check, or its evidence does not
//     name this commit, or cites an https source outside externalSources
//     (proof-external).
// There is no override of any kind: a refused publish is fixed by publishing
// the right commit after verify:release, never by a flag or a variable.
// Preview uploads (`npm run docs:deploy:preview`) are not guarded.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkReleaseProof, cleanGitEnv, loadExternalSources } from './verify-local.mjs';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PREFIX = '[site-publish-proof]';

export const MAIN_BRANCH = 'master';
export const RELEASE_COMMAND = 'npm run verify:release';

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
]);

/**
 * Run every check and collect the failures.
 *
 * `fetch: false` skips `git fetch origin master` (tests of a fixture that
 * has no network); the guard itself always fetches. `gitEnv` is the
 * environment of the git commands (tests pass a scratch git environment).
 */
export async function checkSitePublishProof({ root = defaultRoot, gitEnv, fetch = true } = {}) {
  const gitVariables = cleanGitEnv(gitEnv ?? process.env);
  const release = await checkReleaseProof({
    cwd: root,
    env: gitVariables,
    targets: [],
    fetch,
    mainBranch: MAIN_BRANCH,
    // External evidence is checked again against the externalSources of the
    // config committed at HEAD (External CI, regle-commune-livraison.md 13.1:
    // none, so only owner-machine evidence counts).
    externalSources: await loadExternalSources({ cwd: root, env: gitVariables }),
  });
  const { head, tree, failures } = release;
  return { ok: failures.length === 0, head, tree, failures, proof: release.proof };
}

export const DEFAULT_LABEL = 'noctalia.app';

export function formatRefusal(result, label = DEFAULT_LABEL) {
  const problems = result.failures.map((failure) => failure.message);
  return (
    `${PREFIX} production publish of ${label} refused: ${problems.join('; ')}. `
    + `A production publish uploads only the exact origin/master commit on which \`${RELEASE_COMMAND}\` passed. `
    + 'Check out master and update it (`git switch master && git pull --ff-only`), commit, stash or remove local changes, '
    + `run \`${RELEASE_COMMAND}\` (it writes the release proof of HEAD in the shared git directory; a specialised check `
    + 'that cannot run here takes --external <check>="owner-machine: <host> <note> on <SHA>"), then publish again. '
    + 'There is no override.'
  );
}

export function formatAccepted(result) {
  return `${PREFIX} OK: HEAD ${result.head} is origin/${MAIN_BRANCH}, the checkout is clean, and ${RELEASE_COMMAND} passed on it (tree ${result.tree}).`;
}

/**
 * The guard as one call: resolves with { head, tree, message } for the
 * accepted commit, or throws an Error whose message is the refusal.
 * scripts/docs-deploy.js awaits it before any build of a production publish,
 * and again right before the upload, which must find the same HEAD.
 */
export async function assertSitePublishProof({ label = DEFAULT_LABEL, ...options } = {}) {
  let result;
  try {
    result = await checkSitePublishProof(options);
  } catch (error) {
    throw new Error(`${PREFIX} production publish of ${label} refused: the guard could not run (${String(error?.message || error).split('\n')[0]}).`);
  }
  if (!result.ok) throw new Error(formatRefusal(result, label));
  return { head: result.head, tree: result.tree, message: formatAccepted(result) };
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
