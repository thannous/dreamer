#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { ESLint } = require('eslint');

// Same application scope as the former expo lint package command.
const TARGETS = ['app', 'components', 'hooks', 'lib', 'context', 'constants', 'services', 'tests', 'supabase/functions', 'scripts'];
const BASELINE = 'scripts/lint-warnings-baseline.json';
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

async function main(args = process.argv.slice(2), root = process.cwd()) {
  if (args.length && (args.length !== 1 || args[0] !== '--prune')) throw new Error('Usage: check-lint-warnings.js [--prune]');
  const baselineFile = path.join(root, BASELINE);
  const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
  validateBaseline(baseline);
  // Same rules and results on every core; one process took 82 s against 57 s on 4 cores.
  const eslint = new ESLint({ cwd: root, concurrency: 'auto' });
  const results = await eslint.lintFiles(TARGETS);
  const formatted = (await eslint.loadFormatter('stylish')).format(results);
  if (formatted) console.log(formatted);
  const errorCount = results.reduce((sum, result) => sum + result.errorCount + result.fatalErrorCount, 0);
  if (errorCount) { console.error('ESLint errors remain fatal; the warning baseline cannot allow them.'); return 1; }
  const warnings = collectWarnings(results, root);
  const { added, removed } = compareWarnings(warnings, baseline.warnings);
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
  console.log(`ESLint warning baseline: ${warnings.reduce((sum, finding) => sum + finding.count, 0)} known warnings; no new warnings.`);
  return 0;
}

module.exports = { TARGETS, BASELINE, collectWarnings, compareWarnings, validateBaseline, main };
if (require.main === module) main().then(code => { process.exitCode = code; }).catch(error => {
  console.error(error.message); process.exitCode = 1;
});
