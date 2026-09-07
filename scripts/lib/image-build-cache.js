'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hash(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function hashFile(filePath) {
  return hash(fs.readFileSync(filePath));
}

// No checkout paths or filesystem dates enter the persisted manifest. Dependencies
// are hashed by content; callers supply the effective per-output rendering recipe.
function createImageBuildCache({ manifestPath, codePaths, versions }) {
  const context = { code: codePaths.map(hashFile), versions };
  let previous = {};
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest && manifest.schema === 1 && manifest.entries && typeof manifest.entries === 'object') {
      previous = manifest.entries;
    }
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
  }
  const entries = {};
  const sources = new Map();
  return {
    fingerprint(sourcePath, recipe) {
      if (!sources.has(sourcePath)) sources.set(sourcePath, hashFile(sourcePath));
      return hash(stableJson({ context, source: sources.get(sourcePath), recipe }));
    },
    isFresh(key, input, outputPath) {
      const entry = previous[key];
      if (!entry || entry.input !== input) return false;
      try {
        if (entry.output !== hashFile(outputPath)) return false;
      } catch (error) {
        if (error.code === 'ENOENT') return false;
        throw error;
      }
      entries[key] = entry;
      return true;
    },
    record(key, input, outputPath) {
      entries[key] = { input, output: hashFile(outputPath) };
    },
    commit() {
      const contents = `${stableJson({ schema: 1, entries })}\n`;
      try {
        if (fs.readFileSync(manifestPath, 'utf8') === contents) return;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
      const temporary = `${manifestPath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
      try {
        fs.writeFileSync(temporary, contents, { flag: 'wx' });
        fs.renameSync(temporary, manifestPath);
      } finally {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
      }
    },
  };
}

module.exports = { createImageBuildCache };
