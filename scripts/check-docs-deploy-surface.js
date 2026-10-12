#!/usr/bin/env node


'use strict';

const { createDeployStaging, summarizeDeployStaging } = require('./lib/docs-deploy-staging');
const path = require('path');
const { spawnSync } = require('child_process');

function main() {
  const staging = createDeployStaging();
  try {
    // A file can exist in docs/ but be omitted from the actual upload.
    const links = spawnSync(process.execPath, [
      path.join(__dirname, 'check-docs-links.js'),
      `--docs-dir=${staging.deployDir}`,
    ], { stdio: 'inherit' });
    if (links.error) throw links.error;
    if (links.status !== 0) throw new Error('Broken links in the deployment staging directory.');
    const summary = summarizeDeployStaging(staging.deployDir);
    console.log(
      `[docs-deploy-surface] Passed: allowlisted staging contains ${summary.files} files ` +
        `(${summary.bytes} bytes), valid internal links, and no source, audit, template, script or unapproved data artifacts.`
    );
  } finally {
    staging.cleanup();
  }
}

try {
  main();
} catch (error) {
  console.error(`[docs-deploy-surface] Failed: ${error.message || error}`);
  process.exit(1);
}
