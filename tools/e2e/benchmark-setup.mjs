// Performance evidence only. This command never qualifies application behavior.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, copyFileSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { cpus, release } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
export function parseArgs(args) {
  if (!args.length) return 3;
  if (args.length === 2 && args[0] === '--runs' && /^[1-5]$/.test(args[1])) return Number(args[1]);
  throw new Error('Usage: npm run test:testerarmy:benchmark -- [--runs 1..5]');
}

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function bytes(directory) {
  return readdirSync(directory, { withFileTypes: true }).reduce((sum, item) => {
    const target = join(directory, item.name);
    return sum + (item.isDirectory() ? bytes(target) : statSync(target).size);
  }, 0);
}

// A failed or cancelled phase must remain visible in the partial receipt.
export function measure(command, args, { cwd, env, log, launch = spawnSync }) {
  const fd = openSync(log, 'w');
  const start = performance.now();
  let result;
  try {
    result = launch(command, args, { cwd, env, stdio: ['ignore', fd, fd], timeout: 600_000 });
  } finally {
    closeSync(fd);
  }
  const phase = {
    elapsedMs: Math.round(performance.now() - start),
    exitCode: result.status, signal: result.signal, error: result.error?.message ?? null,
    passed: !result.error && !result.signal && result.status === 0,
  };
  return phase;
}

export function benchmark(runs, { repository = root, npmCli = process.env.npm_execpath, phase = measure } = {}) {
  if (!npmCli) throw new Error('Run through npm so the benchmark uses the same npm CLI on every OS.');
  const output = join(repository, '.tmp/e2e-benchmark');
  mkdirSync(output, { recursive: true });
  const workspace = mkdtempSync(join(output, 'run-'));
  const evidence = join(output, 'results', basename(workspace));
  mkdirSync(evidence, { recursive: true });
  const tool = join(repository, 'tools/e2e');
  const sha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' });
  if (sha.status !== 0) throw new Error('Cannot identify the benchmark source revision.');
  const report = {
    schemaVersion: 1, purpose: 'installation-benchmark', applicationQualified: false,
    sourceRevision: sha.stdout.trim(), node: process.version,
    npmVersion: process.env.npm_config_user_agent?.match(/\bnpm\/([^\s]+)/)?.[1] ?? null,
    inputSha256: Object.fromEntries(['package.json', 'package-lock.json', 'install-browsers.mjs', 'benchmark-setup.mjs'].map(file =>
      [file, createHash('sha256').update(readFileSync(join(tool, file))).digest('hex')])),
    platform: process.platform, osRelease: release(), logicalCpus: cpus().length,
    lockSha256: createHash('sha256').update(readFileSync(join(tool, 'package-lock.json'))).digest('hex'),
    npmCache: 'isolated, empty on the first install and shared by later repetitions',
    browserCache: 'new empty directory for each variant and repetition; no CircleCI cache restore',
    excluded: ['root dependency install', 'Linux system packages', 'application journeys', 'CircleCI queue and artifact transfer'],
    samples: [], passed: false,
  };
  const receipt = join(evidence, 'benchmark.json');
  const persist = () => writeFileSync(receipt, `${JSON.stringify(report, null, 2)}\n`);
  const run = (name, args, env) => {
    console.log(`[benchmark] ${name}`);
    const result = { name, ...phase(process.execPath, [npmCli, ...args], { cwd: repository, env, log: join(evidence, `${name}.log`) }) };
    report.samples.push(result);
    persist();
    if (!result.passed) throw new Error(`${name} failed; see ${receipt}`);
    return result;
  };
  persist();
  try {
    for (let repeat = 1; repeat <= runs; repeat++) {
      const fixture = join(workspace, `e2e-${repeat}`);
      mkdirSync(fixture);
      for (const file of ['package.json', 'package-lock.json', 'install-browsers.mjs'])
        copyFileSync(join(tool, file), join(fixture, file));
      // npm's explicit cache argument avoids differences in inherited config.
      run(`npm-${repeat}`, ['ci', '--prefix', fixture, '--cache', join(workspace, 'npm-cache')], process.env);
      const require = createRequire(join(fixture, 'package.json'));
      const engine = require.resolve('@e2e-dev/web');
      const core = createRequire(engine).resolve('playwright-core/package.json');
      const corePackage = JSON.parse(readFileSync(core, 'utf8'));
      report.playwright = corePackage.version;
      report.browserRevisions = JSON.parse(readFileSync(join(dirname(core), 'browsers.json'), 'utf8')).browsers;
      // Alternate order to reduce systematic CDN/order bias. Both start empty.
      for (const variant of repeat % 2 ? ['full', 'shell'] : ['shell', 'full']) {
        const browserPath = join(workspace, `chromium-${variant}-${repeat}`);
        const args = ['run', 'browsers:install', '--prefix', fixture, '--'];
        if (variant === 'shell') args.push('--only-shell');
        const result = run(`${variant}-${repeat}`, args, { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browserPath });
        result.installedBytes = bytes(browserPath);
        result.installedDirectories = readdirSync(browserPath).filter(name => !name.startsWith('.'));
        persist();
      }
    }
    const summary = variant => {
      const samples = report.samples.filter(sample => sample.name.startsWith(`${variant}-`));
      return { medianMs: median(samples.map(sample => sample.elapsedMs)), samples: samples.length };
    };
    report.summary = { npm: summary('npm'), full: summary('full'), shell: summary('shell') };
    report.summary.chromiumSavedMs = report.summary.full.medianMs - report.summary.shell.medianMs;
    report.passed = true;
    return { receipt, report };
  } finally {
    persist();
    console.log(`[benchmark] receipt: ${receipt}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { report } = benchmark(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(report.summary, null, 2));
}
