#!/usr/bin/env node
'use strict';

const path = require('path');
const { parseSnapshotArgs, readSnapshotInput, parseSnapshotJson, requireSnapshotDate, writeSnapshot } = require('./lib/qa-snapshot');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_TARGET = path.join(ROOT, 'doc_web_interne/docs/google-cloud-project-state.local.json');
const EXPECTED = {
  projectNumber: '359653779023',
  projectId: 'gen-lang-client-0336445544',
};

function parseArgs(argv) {
  return parseSnapshotArgs(argv, {
    file: process.env.GOOGLE_CLOUD_PROJECT_STATE_PATH || DEFAULT_TARGET,
    source: 'gcloud projects list',
  }, printHelp, {
    '--input': 'input',
  });
}

function printHelp() {
  console.log(`
Usage:
  gcloud projects list --filter='PROJECT_NUMBER=359653779023' --format=json | node ./scripts/update-google-cloud-project-state.js
  node ./scripts/update-google-cloud-project-state.js --input <gcloud-projects-list.json>

Options:
  --input <path>       gcloud projects list JSON. Defaults to stdin.
  --file <path>        Snapshot file to update. Defaults to doc_web_interne/docs/google-cloud-project-state.local.json
  --checked-at <iso>   Override timestamp. Defaults to now.
  --source <label>     Snapshot source label.
`.trim());
}

function normalizeSnapshot(input, options) {
  requireSnapshotDate(options.checkedAt);

  const projects = parseSnapshotJson(input, 'Google Cloud project');
  if (!Array.isArray(projects)) {
    throw new Error('Google Cloud project input must be a JSON array from gcloud projects list.');
  }

  const project = projects.find((item) => String(item?.projectNumber ?? '') === EXPECTED.projectNumber);
  if (!project) {
    throw new Error(`Expected projectNumber ${EXPECTED.projectNumber}, but it was not found.`);
  }
  if (project.projectId !== EXPECTED.projectId) {
    throw new Error(`Expected projectId ${EXPECTED.projectId}, got ${project.projectId ?? 'missing'}.`);
  }
  if (project.lifecycleState !== 'ACTIVE') {
    throw new Error(`Expected lifecycleState ACTIVE, got ${project.lifecycleState ?? 'missing'}.`);
  }

  return {
    project_number: String(project.projectNumber),
    project_id: project.projectId,
    name: project.name ?? '',
    lifecycle_state: project.lifecycleState,
    checked_at: options.checkedAt,
    source: options.source,
  };
}

function updateGoogleCloudProjectState(options, input) {
  const document = normalizeSnapshot(input, options);
  writeSnapshot(options.file, document);
  return document;
}

function isProjectSnapshotReady(snapshot) {
  return (
    snapshot?.project_number === EXPECTED.projectNumber &&
    snapshot?.project_id === EXPECTED.projectId &&
    snapshot?.lifecycle_state === 'ACTIVE'
  );
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const document = updateGoogleCloudProjectState(options, readSnapshotInput(options, 'gcloud projects list JSON'));
    console.log(`Updated ${path.relative(ROOT, options.file)}`);
    console.log(`${document.project_number}: ${document.project_id}/${document.lifecycle_state}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

module.exports = {
  EXPECTED,
  isProjectSnapshotReady,
  normalizeSnapshot,
  parseArgs,
  updateGoogleCloudProjectState,
};
