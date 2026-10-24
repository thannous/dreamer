#!/usr/bin/env node
// Code handoff between checkouts: a format-patch of base..head with an envelope that names the
// base, the head, the patch's sha256, every changed path with its blob before and after, the
// commits, and the checks actually run on the head (their real exit codes).
//
//   node scripts/atlas-handoff.mjs create --base <sha> --out <dir> [--head <rev>] [--run "<command>"]...
//   node scripts/atlas-handoff.mjs verify --envelope <file> [--allow-diverged] [--applied]
//   (both take [--repo-root <dir>]; default: this repository)
//
// verify is a check before applying with plain Git, never an applier: it refuses a patch whose
// bytes, paths or commits differ from the envelope, an envelope that the base and head commits
// contradict when this clone has them, a dirty tree, and, unless --allow-diverged is given and
// `git apply --3way --check` passes, any changed path whose current content is not the envelope's
// "before" blob. It then prints the git am command and the git reset --keep that undoes it.
// --applied checks after applying that every path holds the envelope's "after" blob.

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA = 'noctalia.handoff/1';
const SCRIPT = fileURLToPath(import.meta.url);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
// Paths given on the command line are read from where the command was typed (npm --prefix moves the cwd).
const fromCaller = (file) => path.resolve(process.env.INIT_CWD || process.cwd(), file);

class HandoffError extends Error {}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!['create', 'verify'].includes(command)) throw new HandoffError('usage: atlas-handoff.mjs create|verify [options]');
  const options = { command, run: [], allowDiverged: false, applied: false };
  const valued = { '--base': 'base', '--head': 'head', '--out': 'out', '--envelope': 'envelope', '--repo-root': 'repoRoot' };
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--allow-diverged') options.allowDiverged = true;
    else if (arg === '--applied') options.applied = true;
    else if (arg === '--run' || valued[arg]) {
      const value = rest[index + 1];
      if (!value) throw new HandoffError(`${arg} needs a value`);
      if (arg === '--run') options.run.push(value);
      else options[valued[arg]] = value;
      index += 1;
    } else throw new HandoffError(`unknown argument ${arg}`);
  }
  return options;
}

function git(repoRoot, args, { allowFailure = false, encoding = 'utf8' } = {}) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding, maxBuffer: 512 * 1024 * 1024 });
  if (result.status !== 0 && !allowFailure) throw new HandoffError(`git ${args.join(' ')} failed: ${String(result.stderr).trim()}`);
  return allowFailure ? result : result.stdout;
}

// A changed path that Git would write outside the working tree, or into .git, is refused.
function unsafePath(file) {
  return typeof file !== 'string' || !file || path.isAbsolute(file) || /^[a-zA-Z]:/.test(file) || file.includes('\\')
    || file.split('/').some((part) => part === '..' || part === '') || file === '.git' || file.startsWith('.git/');
}

function blob(repoRoot, revision, file) {
  const result = git(repoRoot, ['rev-parse', '--verify', '--quiet', `${revision}:${file}`], { allowFailure: true });
  return result.status === 0 ? result.stdout.trim() : null;
}

function cleanTree(repoRoot) {
  return git(repoRoot, ['status', '--porcelain']).trim() === '';
}

function create(options, repoRoot) {
  if (!options.base || !options.out) throw new HandoffError('create needs --base <sha> and --out <dir>');
  const base = git(repoRoot, ['rev-parse', '--verify', `${options.base}^{commit}`]).trim();
  const head = git(repoRoot, ['rev-parse', '--verify', `${options.head ?? 'HEAD'}^{commit}`]).trim();
  if (git(repoRoot, ['merge-base', '--is-ancestor', base, head], { allowFailure: true }).status !== 0) throw new HandoffError(`${base} is not an ancestor of ${head}`);
  if (base === head) throw new HandoffError('base and head are the same commit: nothing to hand off');
  if (!cleanTree(repoRoot)) throw new HandoffError('the working tree is not clean: commit or stash first, so the patch is what was checked');
  if (options.run.length && git(repoRoot, ['rev-parse', 'HEAD']).trim() !== head) throw new HandoffError('--run checks run on the checked-out tree: check out the head first');

  const fields = git(repoRoot, ['diff', '--name-status', '-z', '--no-renames', base, head]).split('\0').filter(Boolean);
  const paths = [];
  for (let index = 0; index < fields.length; index += 2) {
    const [status, file] = [fields[index], fields[index + 1]];
    if (unsafePath(file)) throw new HandoffError(`unsafe path in the diff: ${JSON.stringify(file)}`);
    paths.push({ path: file, status, before: blob(repoRoot, base, file), after: blob(repoRoot, head, file) });
  }
  const commits = git(repoRoot, ['log', '--reverse', '--format=%H%x1f%s', `${base}..${head}`]).trim().split('\n')
    .map((line) => { const [sha, subject] = line.split('\x1f'); return { sha, subject }; });
  const patch = git(repoRoot, ['format-patch', '--stdout', '--binary', `${base}..${head}`], { encoding: 'buffer' });

  const checks = options.run.map((command) => {
    const started = Date.now();
    const result = spawnSync(command, { cwd: repoRoot, shell: true, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    return { command, exitCode: result.status, signal: result.signal, durationMs: Date.now() - started, outputSha256: sha256(output), tail: output.trim().split('\n').slice(-12) };
  });

  const name = `handoff-${base.slice(0, 12)}-${head.slice(0, 12)}`;
  const out = fromCaller(options.out);
  fs.mkdirSync(out, { recursive: true });
  const envelope = {
    schema: SCHEMA,
    createdAt: new Date().toISOString(),
    base,
    head,
    branch: git(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD']).trim(),
    patch: { file: `${name}.patch`, sha256: sha256(patch), bytes: patch.length },
    commits,
    paths,
    checks,
  };
  fs.writeFileSync(path.join(out, envelope.patch.file), patch, { flag: 'wx' });
  fs.writeFileSync(path.join(out, `${name}.json`), `${JSON.stringify(envelope, null, 2)}\n`, { flag: 'wx' });
  console.log(`atlas-handoff: ${path.join(out, `${name}.json`)}`);
  console.log(`  base ${base}\n  head ${head}\n  patch ${envelope.patch.file} sha256 ${envelope.patch.sha256}\n  ${paths.length} path(s), ${commits.length} commit(s)`);
  for (const check of checks) console.log(`  check exit ${check.exitCode}${check.signal ? ` (${check.signal})` : ''}: ${check.command}`);
  if (checks.some((check) => check.exitCode !== 0)) {
    console.error('atlas-handoff: a check failed; the envelope records it as failed');
    process.exitCode = 1;
  }
}

// The paths a patch really touches, read from its own diff headers; a quoted (unusual) path is ambiguous.
function patchPaths(text) {
  const paths = new Set();
  for (const line of text.split('\n')) {
    if (!line.startsWith('diff --git ')) continue;
    const match = /^diff --git a\/(\S+) b\/(\S+)$/.exec(line);
    if (!match || match[1] !== match[2]) throw new HandoffError(`ambiguous diff header: ${line}`);
    paths.add(match[1]);
  }
  return paths;
}

// What this clone can prove beyond the patch's bytes. The patch must carry the envelope's commits,
// ending at its head. When the base (or the head) is here, its tree must hold every path's "before"
// (or "after") blob; when both are, the head must descend from the base and base..head must hold the
// envelope's commits and paths. When they are not here (a cloud head handed to a local clone), only
// each path's content is checked, and the ancestry is reported as not proven.
function crossCheck(repoRoot, envelope, patchText) {
  const problems = [];
  const listed = envelope.commits.map((commit) => commit.sha);
  const carried = [...patchText.matchAll(/^From ([0-9a-f]{40}) Mon Sep 17 00:00:00 2001$/gm)].map((match) => match[1]);
  if (carried.join() !== listed.join()) problems.push(`the patch carries commits ${carried.join(', ') || 'none'}, the envelope lists ${listed.join(', ') || 'none'}`);
  if (listed.at(-1) !== envelope.head) problems.push(`the envelope's last commit ${listed.at(-1) ?? 'none'} is not its head ${envelope.head}`);
  const known = (sha) => git(repoRoot, ['cat-file', '-e', `${sha}^{commit}`], { allowFailure: true }).status === 0;
  const baseKnown = known(envelope.base);
  const headKnown = known(envelope.head);
  for (const [side, revision, field] of [['base', baseKnown && envelope.base, 'before'], ['head', headKnown && envelope.head, 'after']]) {
    if (!revision) continue;
    for (const entry of envelope.paths) {
      const actual = blob(repoRoot, revision, entry.path);
      if (actual !== entry[field]) problems.push(`the ${side} ${revision.slice(0, 12)} holds ${entry.path} as ${actual ?? 'nothing'}, the envelope's ${field} is ${entry[field] ?? 'nothing'}`);
    }
  }
  if (baseKnown && headKnown) {
    if (git(repoRoot, ['merge-base', '--is-ancestor', envelope.base, envelope.head], { allowFailure: true }).status !== 0) {
      problems.push(`the base ${envelope.base} is not an ancestor of the head ${envelope.head}`);
    } else {
      const commits = git(repoRoot, ['log', '--reverse', '--format=%H', `${envelope.base}..${envelope.head}`]).trim().split('\n').filter(Boolean);
      if (commits.join() !== listed.join()) problems.push(`${envelope.base.slice(0, 12)}..${envelope.head.slice(0, 12)} holds commits ${commits.join(', ')}, the envelope lists ${listed.join(', ')}`);
      const fields = git(repoRoot, ['diff', '--name-status', '-z', '--no-renames', envelope.base, envelope.head]).split('\0').filter(Boolean);
      const changed = [];
      for (let index = 0; index < fields.length; index += 2) changed.push(`${fields[index]} ${fields[index + 1]}`);
      const declared = envelope.paths.map((entry) => `${entry.status} ${entry.path}`);
      if (changed.sort().join('\n') !== declared.sort().join('\n')) problems.push(`${envelope.base.slice(0, 12)}..${envelope.head.slice(0, 12)} changes ${changed.join(', ')}, the envelope lists ${declared.join(', ')}`);
    }
  }
  if (problems.length) throw new HandoffError(`the envelope does not describe this patch's history:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`);
  if (baseKnown && headKnown) return 'base and head are in this clone: ancestry, commits, paths and blobs checked against them';
  if (baseKnown) return 'the base is in this clone (its blobs checked), the head is not: the commits are not proven';
  if (headKnown) return 'the head is in this clone (its blobs checked), the base is not: the ancestry is not proven';
  return 'base and head are not in this clone: content checked per path, ancestry not proven';
}

function verify(options, repoRoot) {
  if (!options.envelope) throw new HandoffError('verify needs --envelope <file>');
  const envelopeFile = fromCaller(options.envelope);
  const envelope = JSON.parse(fs.readFileSync(envelopeFile, 'utf8'));
  if (envelope.schema !== SCHEMA) throw new HandoffError(`not a ${SCHEMA} envelope`);
  for (const key of ['base', 'head']) if (!/^[0-9a-f]{40}$/.test(envelope[key] ?? '')) throw new HandoffError(`${key} must be a full commit sha`);
  for (const key of ['paths', 'commits', 'checks']) if (!Array.isArray(envelope[key])) throw new HandoffError(`${key} must be a list`);
  if (path.basename(envelope.patch?.file ?? '') !== envelope.patch?.file) throw new HandoffError('the patch must sit beside the envelope');
  const patchFile = path.join(path.dirname(envelopeFile), envelope.patch.file);
  const patch = fs.readFileSync(patchFile);
  if (sha256(patch) !== envelope.patch.sha256) throw new HandoffError(`${envelope.patch.file} has sha256 ${sha256(patch)}, the envelope says ${envelope.patch.sha256}`);
  const declared = new Set(envelope.paths.map((entry) => entry.path));
  for (const file of declared) if (unsafePath(file)) throw new HandoffError(`unsafe path in the envelope: ${JSON.stringify(file)}`);
  const patchText = patch.toString('utf8');
  const touched = patchPaths(patchText);
  const extra = [...touched].filter((file) => !declared.has(file));
  const absent = [...declared].filter((file) => !touched.has(file));
  if (extra.length || absent.length) throw new HandoffError(`the patch and the envelope disagree on paths (patch only: ${extra.join(', ') || 'none'}; envelope only: ${absent.join(', ') || 'none'})`);
  const ancestry = crossCheck(repoRoot, envelope, patchText);
  if (!cleanTree(repoRoot)) throw new HandoffError('the working tree is not clean: an application could not be undone cleanly');

  const current = git(repoRoot, ['rev-parse', 'HEAD']).trim();
  const failed = envelope.checks.filter((check) => check.exitCode !== 0);
  console.log(`atlas-handoff: patch ${envelope.patch.file} matches its envelope (${envelope.paths.length} path(s), ${envelope.commits.length} commit(s), cloud head ${envelope.head})`);
  console.log(`  checks recorded on the head: ${envelope.checks.length ? envelope.checks.map((check) => `${check.exitCode === 0 ? 'passed' : 'FAILED'} ${check.command}`).join('; ') : 'none'}`);
  if (failed.length) console.log('  warning: the envelope records failed checks');
  console.log(`  ${ancestry}`);

  if (options.applied) {
    const different = envelope.paths.filter((entry) => blob(repoRoot, current, entry.path) !== entry.after);
    for (const entry of envelope.paths) console.log(`  ${different.includes(entry) ? 'DIFFERS' : 'exact  '} ${entry.path}`);
    if (different.length && !options.allowDiverged) throw new HandoffError(`${different.length} path(s) differ from the cloud head`);
    console.log(different.length ? '  differences accepted with --allow-diverged (merged local changes)' : '  every path holds the cloud head\'s content');
    return;
  }

  const state = envelope.paths.map((entry) => ({ ...entry, now: blob(repoRoot, current, entry.path) }));
  const diverged = state.filter((entry) => entry.now !== entry.before);
  for (const entry of state) console.log(`  ${entry.now === entry.before ? 'exact   ' : 'DIVERGED'} ${entry.status} ${entry.path}`);
  console.log(`  local HEAD ${current}${current === envelope.base ? ' (the base)' : ''}`);
  let apply = `git am ${JSON.stringify(patchFile)}`;
  if (diverged.length) {
    if (!options.allowDiverged) throw new HandoffError(`${diverged.length} path(s) do not hold the base content; rerun with --allow-diverged to test a three-way merge`);
    const check = git(repoRoot, ['apply', '--3way', '--check', patchFile], { allowFailure: true });
    if (check.status !== 0) throw new HandoffError(`git apply --3way --check refuses the patch:\n${String(check.stderr).trim()}`);
    apply = `git am --3way ${JSON.stringify(patchFile)}`;
    console.log('  the three-way check passes for the diverged paths');
  } else {
    const check = git(repoRoot, ['apply', '--check', patchFile], { allowFailure: true });
    if (check.status !== 0) throw new HandoffError(`git apply --check refuses the patch:\n${String(check.stderr).trim()}`);
  }
  console.log(`apply:  ${apply}`);
  console.log(`undo:   git am --abort   (while git am is stopped)   or   git reset --keep ${current}   (once applied)`);
  console.log(`after:  node scripts/atlas-handoff.mjs verify --envelope ${JSON.stringify(envelopeFile)} --applied${diverged.length ? ' --allow-diverged' : ''}`);
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const repoRoot = git(options.repoRoot ? fromCaller(options.repoRoot) : path.join(path.dirname(SCRIPT), '..'), ['rev-parse', '--show-toplevel']).trim();
    if (options.command === 'create') create(options, repoRoot);
    else verify(options, repoRoot);
  } catch (error) {
    if (!(error instanceof HandoffError)) throw error;
    console.error(`atlas-handoff: ${error.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT) main();

export { patchPaths, unsafePath };
