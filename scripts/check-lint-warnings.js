#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { ESLint } = require('eslint');

// Same application scope as the former expo lint package command.
const TARGETS = ['app', 'components', 'hooks', 'lib', 'context', 'constants', 'services', 'tests', 'supabase/functions', 'scripts'];
const BASELINE = 'scripts/lint-warnings-baseline.json';
// A change to one of these can change the result of every file.
const WHOLE_SCOPE = ['eslint.config.js', 'package.json', 'package-lock.json', 'tsconfig.json', 'babel.config.js', 'scripts/check-lint-warnings.js', BASELINE];
const CODE = /\.(?:[cm]?js|jsx|tsx?)$/;
const key = finding => JSON.stringify([finding.file, finding.rule, finding.message, finding.sourceSha256]);

function semanticMessage(message, root) {
  // React Compiler renders locations and numbered code frames inside messages.
  // Those are diagnostics, not warning identity: inserting a comment is harmless.
  return message.replaceAll(root + path.sep, '<root>/').replaceAll(root.replaceAll('\\', '/') + '/', '<root>/')
    .split('\n').filter(line => !/^\s*(?:>\s*)?\d+\s*\|/.test(line)
      && !/^\s*\|/.test(line) && !/^<root>\/.*:\d+:\d+(?:-\d+)?$/.test(line)).join('\n').trim();
}

function collectWarnings(results, root) {
  const findings = new Map();
  for (const result of results) {
    const source = result.source ?? fs.readFileSync(result.filePath, 'utf8');
    const lines = source.split(/\r?\n/);
    const file = path.relative(root, result.filePath).split(path.sep).join('/');
    if (file.startsWith('../') || path.isAbsolute(file)) throw new Error('ESLint returned a file outside the project.');
    for (const message of result.messages.filter(entry => entry.severity === 1)) {
      const start = message.line - 1;
      let span;
      if (Number.isInteger(message.endLine) && Number.isInteger(message.endColumn)) {
        span = lines.slice(start, message.endLine);
        span[span.length - 1] = span.at(-1).slice(0, message.endColumn - 1);
        span[0] = span[0].slice(message.column - 1);
        span = span.join('\n');
      } else span = lines[start] ?? '';
      const finding = { file, rule: message.ruleId ?? '<unclassified>', message: semanticMessage(message.message, root),
        sourceSha256: createHash('sha256').update(span).digest('hex') };
      const identity = key(finding);
      const previous = findings.get(identity);
      if (previous) previous.count++;
      else findings.set(identity, { ...finding, count: 1 });
    }
  }
  return [...findings.values()].sort((a, b) => key(a).localeCompare(key(b)));
}

function validateBaseline(baseline) {
  if (baseline.schemaVersion !== 1 || JSON.stringify(baseline.targets) !== JSON.stringify(TARGETS) || !Array.isArray(baseline.warnings))
    throw new Error('Invalid ESLint warning baseline or changed lint scope.');
  const identities = new Set();
  for (const finding of baseline.warnings) {
    if (typeof finding.file !== 'string' || finding.file.startsWith('/') || finding.file.split(/[\\/]/).includes('..')
      || typeof finding.rule !== 'string' || !finding.rule || typeof finding.message !== 'string'
      || !/^[a-f0-9]{64}$/.test(finding.sourceSha256) || !Number.isSafeInteger(finding.count) || finding.count < 1
      || identities.has(key(finding))) throw new Error('Invalid or duplicate ESLint warning fingerprint.');
    identities.add(key(finding));
  }
}

function compareWarnings(current, baseline) {
  const currentCounts = new Map(current.map(finding => [key(finding), finding.count]));
  const baselineCounts = new Map(baseline.map(finding => [key(finding), finding.count]));
  return {
    added: current.filter(finding => finding.count > (baselineCounts.get(key(finding)) ?? 0)),
    removed: baseline.filter(finding => finding.count > (currentCounts.get(key(finding)) ?? 0)),
  };
}

// Module identity for the import graph: the path without its extension,
// platform suffix or /index, so `./Card` matches Card.web.tsx or Card/index.ts.
function moduleKey(file) {
  return file.replace(/\.(?:d\.ts|[cm]?js|jsx|tsx?|json)$/, '').replace(/\.(?:web|native|ios|android)$/, '').replace(/\/index$/, '');
}

function specifierKey(from, specifier) {
  if (specifier.startsWith('@/')) return moduleKey(path.posix.normalize(specifier.slice(2)));
  if (specifier.startsWith('.')) return moduleKey(path.posix.join(path.posix.dirname(from), specifier));
  return null;
}

const IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"\n]+)['"]/g;
const REEXPORT = /\bexport\s+(?:type\s+)?(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s*from\s*['"]([^'"\n]+)['"]/g;

/**
 * The files whose lint result can differ from the merge base: the changed
 * ones, and those importing a module whose exports changed (import/named and
 * the other import rules read them), through any chain of re-exports. Null
 * when a change reaches every file, or when there is no base to compare with.
 */
function lintScope({ changed, files, read }) {
  if (changed.some((file) => WHOLE_SCOPE.includes(file))) return null;
  const inTargets = (file) => TARGETS.some((target) => file.startsWith(`${target}/`)) && CODE.test(file);
  const specifiers = new Map(files.filter(inTargets).map((file) => {
    const source = read(file);
    const keys = (pattern) => [...source.matchAll(pattern)].map((match) => specifierKey(file, match[1])).filter(Boolean);
    return [file, { imports: new Set(keys(IMPORT)), reexports: new Set(keys(REEXPORT)) }];
  }));
  const affected = new Set(changed.map(moduleKey));
  for (let grew = true; grew;) {
    grew = false;
    for (const [file, { reexports }] of specifiers) {
      const key = moduleKey(file);
      if (!affected.has(key) && [...reexports].some((target) => affected.has(target))) { affected.add(key); grew = true; }
    }
  }
  const scope = new Set(changed.filter((file) => specifiers.has(file)));
  for (const [file, { imports }] of specifiers) if ([...imports].some((target) => affected.has(target))) scope.add(file);
  return [...scope].sort();
}

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return result.status === 0 ? result.stdout : null;
}

// A PR lints what changed since its merge base with origin/master and what
// depends on it; a release (VERIFY_LOCAL_KIND=release) lints every file.
function changedScope(root, env) {
  if (env.VERIFY_LOCAL_KIND === 'release') return { files: null, reason: 'a release lints every file' };
  const base = git(root, ['merge-base', 'HEAD', 'origin/master'])?.trim();
  if (!base) return { files: null, reason: 'no merge base with origin/master' };
  const diff = git(root, ['diff', '--name-only', '--no-renames', base]);
  const tracked = git(root, ['ls-files', '--cached', '--others', '--exclude-standard', '--', ...TARGETS]);
  if (diff === null || tracked === null) return { files: null, reason: 'git could not list the changes' };
  const changed = diff.split('\n').filter(Boolean);
  let files;
  try {
    files = lintScope({ changed, files: tracked.split('\n').filter(Boolean), read: (file) => fs.readFileSync(path.join(root, file), 'utf8') });
  } catch (error) {
    return { files: null, reason: `the import graph could not be read (${error.message})` };
  }
  return files ? { files, base } : { files: null, reason: 'a change reaches every file' };
}

async function main(args = process.argv.slice(2), root = process.cwd(), env = process.env) {
  if (args.some((arg) => !['--prune', '--changed'].includes(arg)) || new Set(args).size !== args.length) {
    throw new Error('Usage: check-lint-warnings.js [--prune | --changed]');
  }
  if (args.length > 1) throw new Error('--prune checks every file; it cannot take --changed.');
  const baselineFile = path.join(root, BASELINE);
  const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
  validateBaseline(baseline);
  // Same rules and results on every core; one process took 82 s against 57 s on 4 cores.
  const eslint = new ESLint({ cwd: root, concurrency: 'auto' });
  let scope = null;
  if (args.includes('--changed')) {
    const changed = changedScope(root, env);
    if (changed.files) {
      const files = [];
      for (const file of changed.files) if (!(await eslint.isPathIgnored(path.join(root, file)))) files.push(file);
      scope = new Set(files);
      console.log(`ESLint on ${files.length} files changed since ${changed.base.slice(0, 12)} or importing them; a release lints every file.`);
    } else {
      console.log(`ESLint on every file: ${changed.reason}.`);
    }
  }
  const results = scope ? (scope.size ? await eslint.lintFiles([...scope]) : []) : await eslint.lintFiles(TARGETS);
  const formatted = (await eslint.loadFormatter('stylish')).format(results);
  if (formatted) console.log(formatted);
  const errorCount = results.reduce((sum, result) => sum + result.errorCount + result.fatalErrorCount, 0);
  if (errorCount) { console.error('ESLint errors remain fatal; the warning baseline cannot allow them.'); return 1; }
  const warnings = collectWarnings(results, root);
  const allowed = scope ? baseline.warnings.filter((finding) => scope.has(finding.file)) : baseline.warnings;
  const { added, removed } = compareWarnings(warnings, allowed);
  if (added.length) {
    console.error('New ESLint warnings are not allowed:');
    for (const finding of added) console.error(`  ${finding.file} ${finding.rule}: ${finding.message.split('\n')[0]} [${finding.sourceSha256.slice(0, 12)}; count=${finding.count}]`);
    return 1;
  }
  if (removed.length) {
    if (!args.includes('--prune')) {
      console.error('Resolved ESLint warnings must leave the baseline. Run npm run lint:warnings -- --prune; this only removes existing allowances.');
      return 1;
    }
    fs.writeFileSync(baselineFile, JSON.stringify({ ...baseline, warnings }, null, 2) + '\n');
    console.log(`Removed ${removed.length} resolved warning fingerprints from the baseline.`);
  }
  const known = warnings.reduce((sum, finding) => sum + finding.count, 0);
  console.log(`ESLint warning baseline: ${known} known warnings${scope ? ` in the ${scope.size} files checked` : ''}; no new warnings.`);
  return 0;
}

module.exports = { TARGETS, BASELINE, WHOLE_SCOPE, collectWarnings, compareWarnings, lintScope, moduleKey, validateBaseline, main };
if (require.main === module) main().then(code => { process.exitCode = code; }).catch(error => {
  console.error(error.message); process.exitCode = 1;
});
