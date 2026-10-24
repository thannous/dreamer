#!/usr/bin/env node
// Transfer receipt of one TesterArmy run (tools/e2e/run.mjs): reads the run's own evidence, checks
// it with the runner's qualification helpers, copies its files once and writes a receipt that
// references them by sha256. It never decides a pass: a run the wrapper did not qualify, or whose
// files changed since, is refused.
//
//   node scripts/atlas-qualification-receipt.mjs --run <tools/e2e/.e2e/<target>/<run>> --out <dir>
//     [--revision <sha>] [--require-clean]
//
// The receipt lists the passed, skipped and excluded tests as the run recorded them: a filtered
// pilot run (--grep) qualifies its own selection only, and its exclusions are listed, not hidden.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest, verifyEvidenceFiles } from '../tools/e2e/qualification.mjs';
import { inside, realTarget, unsafeDestination } from './lib/atlas-paths.mjs';

const SCHEMA = 'noctalia.qualification-receipt/1';
const SCRIPT = fileURLToPath(import.meta.url);
const REQUIRED = ['evidence.json', 'source-start.json', 'source-end.json', 'collection.json', 'report.json', 'qualification.json', 'end.json', 'files.json'];

class ReceiptError extends Error {}

function parseArgs(argv) {
  const options = { requireClean: false };
  const valued = { '--run': 'run', '--out': 'out', '--revision': 'revision' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--require-clean') options.requireClean = true;
    else if (valued[arg]) {
      if (!argv[index + 1]) throw new ReceiptError(`${arg} needs a value`);
      options[valued[arg]] = argv[index + 1];
      index += 1;
    } else throw new ReceiptError(`unknown argument ${arg}`);
  }
  if (!options.run || !options.out) throw new ReceiptError('--run <run directory> and --out <directory> are required');
  return options;
}

// Paths given on the command line are read from where the command was typed (npm --prefix moves the cwd).
const fromCaller = (file) => path.resolve(process.env.INIT_CWD || process.cwd(), file);
const readJson = (dir, name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const testName = (row) => decodeURIComponent(String(row.testId).split('::').slice(1).join('::'));

export function buildReceipt(runDir, options = {}) {
  for (const name of REQUIRED) {
    const file = path.join(runDir, name);
    if (!fs.existsSync(file) || fs.lstatSync(file).isSymbolicLink()) throw new ReceiptError(`${name} is missing: the run left no complete evidence`);
  }
  try {
    verifyEvidenceFiles(runDir);
  } catch (error) {
    throw new ReceiptError(`${error.message}: the run's files no longer match its files.json`);
  }
  const evidence = readJson(runDir, 'evidence.json');
  const end = readJson(runDir, 'end.json');
  const qualification = readJson(runDir, 'qualification.json');
  const run = readJson(runDir, 'report.json').run ?? {};
  const files = readJson(runDir, 'files.json');
  const sourceStart = readJson(runDir, 'source-start.json');
  const sourceEnd = readJson(runDir, 'source-end.json');
  const summary = run.summary ?? {};

  const refusals = [];
  if (end.applicationQualified !== true) refusals.push('end.json: the wrapper did not qualify the run (applicationQualified is not true)');
  if (end.sdkLaunched !== true) refusals.push('end.json: the SDK was not launched');
  if (end.exitCode !== 0 || end.primaryExitCode !== 0) refusals.push(`end.json: exit codes ${end.primaryExitCode}/${end.exitCode}`);
  if (end.stability?.sourceStable !== true || end.stability?.outputsStable !== true) refusals.push('end.json: sources or outputs changed during the run');
  // Every identity of the candidate agrees: the evidence, the qualification, the wrapper's start and
  // end, and the source snapshots taken before and after the run (same revision, same working tree).
  const revisions = new Set([evidence.revision, qualification.revision, end.stability?.startRevision, end.stability?.endRevision, sourceStart.revision, sourceEnd.revision]);
  if (sourceStart.workingTree !== evidence.workingTree || sourceEnd.workingTree !== sourceStart.workingTree) refusals.push('source-start.json, source-end.json and evidence.json describe different working trees');
  if (revisions.size !== 1 || !/^[0-9a-f]{40}$/.test(evidence.revision ?? '')) refusals.push(`the run's revisions disagree: ${[...revisions].join(', ')}`);
  if (qualification.runId !== run.id) refusals.push(`qualification.json run ${qualification.runId} is not report.json run ${run.id}`);
  if (run.status !== 'passed') refusals.push(`report.json: status ${run.status}`);
  for (const key of ['failed', 'interrupted', 'flaky']) if (summary[key] !== 0) refusals.push(`report.json: ${summary[key]} ${key}`);
  if (!Array.isArray(qualification.passed) || qualification.passed.length === 0) refusals.push('qualification.json: no passed test');
  if (options.revision && evidence.revision !== options.revision) refusals.push(`the run tested ${evidence.revision}, not the requested ${options.revision}`);
  if (options.requireClean && end.stability?.sourceClean !== true) refusals.push('the run started from a working tree with local changes');
  if (refusals.length) throw new ReceiptError(`not a qualified run:\n${refusals.map((reason) => `  - ${reason}`).join('\n')}`);

  // Deterministic: the same run always gives the same receipt, so a second transfer changes nothing.
  return {
    schema: SCHEMA,
    run: path.basename(runDir),
    runId: run.id,
    product: evidence.product,
    platform: evidence.platform,
    target: qualification.target,
    revision: evidence.revision,
    sourceClean: end.stability.sourceClean,
    workingTree: evidence.workingTree,
    trackedDiffSha256: evidence.trackedDiffSha256 ?? null,
    command: evidence.command,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    runner: qualification.runner,
    engine: qualification.engine,
    summary,
    passed: qualification.passed.map(testName),
    skipped: (qualification.skipped ?? []).map(testName),
    excluded: (qualification.excluded ?? []).map(testName),
    files: { ...files, 'files.json': digest(fs.readFileSync(path.join(runDir, 'files.json'))), 'end.json': digest(fs.readFileSync(path.join(runDir, 'end.json'))) },
  };
}

// Copies each evidence file once; an existing copy must hold the same bytes, never overwritten.
// The output folder is resolved to its real path first, so it cannot overlap the run it copies
// through an alias; below it, every destination must be a real folder or file (no link, junction or
// alias), all checked before the first copy.
export function transfer(runDir, requestedOut, receipt) {
  const outDir = realTarget(requestedOut);
  if (!outDir) throw new ReceiptError(`the output folder ${requestedOut} goes through a broken link`);
  const source = fs.realpathSync(runDir);
  if (inside(source, outDir) || inside(outDir, source)) throw new ReceiptError(`the output folder ${outDir} overlaps the run ${source}`);
  const target = path.join(outDir, receipt.run);
  const receiptFile = path.join(outDir, `${receipt.run}.receipt.json`);
  const contents = `${JSON.stringify(receipt, null, 2)}\n`;
  const copies = [];
  for (const [name, sha] of Object.entries(receipt.files)) {
    if (name.split('/').includes('..') || path.isAbsolute(name)) throw new ReceiptError(`unsafe evidence path ${name}`);
    copies.push({ from: path.join(runDir, ...name.split('/')), destination: path.join(target, ...name.split('/')), sha });
  }
  for (const destination of [...copies.map((copy) => copy.destination), receiptFile]) {
    const unsafe = unsafeDestination(outDir, destination);
    if (unsafe) throw new ReceiptError(`unsafe destination: ${unsafe}`);
  }
  for (const { destination, sha } of copies) {
    if (fs.existsSync(destination) && digest(fs.readFileSync(destination)) !== sha) throw new ReceiptError(`${destination} exists with other bytes`);
  }
  if (fs.existsSync(receiptFile) && fs.readFileSync(receiptFile, 'utf8') !== contents) throw new ReceiptError(`${receiptFile} exists with another content`);

  let copied = 0;
  for (const { from, destination, sha } of copies) {
    if (fs.existsSync(destination)) continue;
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(from, destination, fs.constants.COPYFILE_EXCL);
    if (digest(fs.readFileSync(destination)) !== sha) throw new ReceiptError(`${destination} changed while copying`);
    copied += 1;
  }
  if (!fs.existsSync(receiptFile)) fs.writeFileSync(receiptFile, contents, { flag: 'wx' });
  return { receiptFile, copied, kept: copies.length - copied, receiptSha256: digest(contents) };
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const runDir = fs.realpathSync(fromCaller(options.run));
    const outDir = fromCaller(options.out);
    const receipt = buildReceipt(runDir, options);
    const { receiptFile, copied, kept, receiptSha256 } = transfer(runDir, outDir, receipt);
    console.log(`qualification-receipt: run ${receipt.runId} (${receipt.run}) on ${receipt.revision}${receipt.sourceClean ? '' : ' with local changes'}`);
    console.log(`  ${receipt.passed.length} passed, ${receipt.skipped.length} skipped, ${receipt.excluded.length} excluded by the selection`);
    console.log(`  ${copied} file(s) copied, ${kept} already there; receipt ${receiptFile} sha256 ${receiptSha256}`);
  } catch (error) {
    if (!(error instanceof ReceiptError)) throw error;
    console.error(`qualification-receipt: ${error.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT) main();
