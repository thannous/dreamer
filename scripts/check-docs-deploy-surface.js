#!/usr/bin/env node
/* eslint-disable no-console */

'use strict';

const { createDeployStaging, summarizeDeployStaging } = require('./lib/docs-deploy-staging');

function main() {
  const staging = createDeployStaging();
  try {
    const summary = summarizeDeployStaging(staging.deployDir);
    console.log(
      `[docs-deploy-surface] Passed: allowlisted staging contains ${summary.files} files ` +
        `(${summary.bytes} bytes) and no source, audit, template, script or raw data artifacts.`
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
