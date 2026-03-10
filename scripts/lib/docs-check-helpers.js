'use strict';

const fs = require('fs');
const path = require('path');

const DOCS_BUILD_STATE_FILE = '.docs-build-state.json';

function docsBuildStatePath(rootDir) {
  return path.join(rootDir, DOCS_BUILD_STATE_FILE);
}

function decodeHtmlEntities(str) {
  if (!str) return '';
  const named = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&apos;': "'"
  };
  let out = String(str);
  for (const [key, value] of Object.entries(named)) out = out.split(key).join(value);
  out = out.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
  out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)));
  return out;
}

function normalizeForSearch(str) {
  return decodeHtmlEntities(String(str || ''))
    .replace(/[’‘]/g, "'")
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function writeDocsBuildState(rootDir, nextState) {
  const current = readDocsBuildState(rootDir) || {};
  const state = {
    ...current,
    ...nextState,
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(docsBuildStatePath(rootDir), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  return state;
}

function readDocsBuildState(rootDir) {
  const filePath = docsBuildStatePath(rootDir);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function markDocsBuildStarted(rootDir) {
  return writeDocsBuildState(rootDir, {
    status: 'building',
    startedAt: new Date().toISOString(),
    completedAt: null,
    error: null
  });
}

function markDocsBuildSucceeded(rootDir, metadata = {}) {
  return writeDocsBuildState(rootDir, {
    status: 'ready',
    completedAt: new Date().toISOString(),
    error: null,
    ...metadata
  });
}

function markDocsBuildFailed(rootDir, error) {
  return writeDocsBuildState(rootDir, {
    status: 'failed',
    completedAt: new Date().toISOString(),
    error: error ? String(error.message || error) : 'Unknown docs build failure'
  });
}

function assertDocsBuildReady(rootDir) {
  const state = readDocsBuildState(rootDir);
  if (!state) return;

  if (state.status === 'building') {
    throw new Error(
      'Docs build is currently in progress. Wait for `npm run docs:build` to finish before running checks.'
    );
  }

  if (state.status === 'failed') {
    throw new Error(
      `The last docs build failed. Re-run \`npm run docs:build\` before trusting check results.${state.error ? ` Last error: ${state.error}` : ''}`
    );
  }
}

module.exports = {
  DOCS_BUILD_STATE_FILE,
  assertDocsBuildReady,
  decodeHtmlEntities,
  docsBuildStatePath,
  markDocsBuildFailed,
  markDocsBuildStarted,
  markDocsBuildSucceeded,
  normalizeForSearch,
  readDocsBuildState,
};
