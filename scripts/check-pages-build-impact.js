#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');
const settings = require('../docs-src/config/cloudflare-pages.json');

// Pages '*' spans directories. Do not substitute minimatch/glob semantics.
function matches(pattern, file) {
  const escaped = pattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`^${escaped.join('.*')}$`, 's').test(file);
}

function validateRules(rules) {
  if (!rules || !Array.isArray(rules.include) || !Array.isArray(rules.exclude) ||
      rules.include.length !== 1 || rules.include[0] !== '*' ||
      rules.exclude.some(rule => typeof rule !== 'string' || !rule || rule === '*')) {
    throw new Error('Pages rules must include all unknown paths and use explicit exclusions.');
  }
}

function evaluatePaths(paths, { commitCount = 1, rules = settings.buildWatchPaths } = {}) {
  validateRules(rules);
  if (!Array.isArray(paths) || paths.some(file => typeof file !== 'string' || !file ||
      file.startsWith('/') || file.split('/').includes('..'))) {
    return { build: true, reason: 'invalid-paths', relevantPaths: [] };
  }
  // Mirror Pages' conservative bypasses, including empty pushes.
  if (paths.length === 0 || paths.length >= 3000 || !Number.isInteger(commitCount) ||
      commitCount < 1 || commitCount >= 20) {
    return { build: true, reason: 'provider-fallback', relevantPaths: [] };
  }
  const relevantPaths = paths.filter(file => !rules.exclude.some(rule => matches(rule, file)));
  return {
    build: relevantPaths.length > 0,
    reason: relevantPaths.length ? 'site-or-unknown-input' : 'excluded-inputs-only',
    relevantPaths,
  };
}

function evaluateDiff(base, head, { cwd = process.cwd(), rules = settings.buildWatchPaths } = {}) {
  validateRules(rules);
  try {
    // Resolve to object IDs before using refs in a range; no shell interpolation.
    const resolve = ref => execFileSync('git', ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const baseId = resolve(base);
    const headId = resolve(head);
    execFileSync('git', ['merge-base', '--is-ancestor', baseId, headId], { cwd, stdio: 'pipe' });
    const options = { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 };
    // Disable rename collapsing so BOTH deleted and added paths are checked.
    const paths = execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', baseId, headId], options)
      .split('\0').filter(Boolean);
    const commitCount = Number(execFileSync('git', ['rev-list', '--count', `${baseId}..${headId}`], options).trim());
    return { base: baseId, head: headId, commitCount, ...evaluatePaths(paths, { commitCount, rules }) };
  } catch {
    return { build: true, reason: 'unusable-diff', relevantPaths: [] };
  }
}

function main(args = process.argv.slice(2)) {
  if (args.length !== 4 || args[0] !== '--base' || args[2] !== '--head') {
    throw new Error('Usage: npm run docs:build-impact -- --base <revision> --head <revision>');
  }
  // Read-only diagnostic. A skip result never cancels a job or changes Pages.
  console.log(JSON.stringify(evaluateDiff(args[1], args[3]), null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { evaluateDiff, evaluatePaths, matches, validateRules };
