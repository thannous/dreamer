#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_TARGET = path.join(ROOT, 'doc_web_interne/docs/google-cloud-project-state.local.json');
const EXPECTED = {
  projectNumber: '359653779023',
  projectId: 'gen-lang-client-0336445544',
};

function parseArgs(argv) {
  const options = {
    file: process.env.GOOGLE_CLOUD_PROJECT_STATE_PATH
      ? path.resolve(ROOT, process.env.GOOGLE_CLOUD_PROJECT_STATE_PATH)
      : DEFAULT_TARGET,
    checkedAt: new Date().toISOString(),
    source: 'gcloud projects list',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input') {
      options.input = path.resolve(ROOT, argv[i + 1] ?? '');
      i += 1;
      continue;
    }
    if (arg === '--file') {
      options.file = path.resolve(ROOT, argv[i + 1] ?? '');
      i += 1;
      continue;
    }
    if (arg === '--checked-at') {
      options.checkedAt = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--source') {
      options.source = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
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

function readInput(options, stdin = process.stdin) {
  if (options.input) {
    return fs.readFileSync(options.input, 'utf8');
  }
  if (stdin.isTTY) {
    throw new Error('Missing --input. You can also pipe gcloud projects list JSON through stdin.');
  }
  return fs.readFileSync(0, 'utf8');
}

function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Google Cloud project input must be valid JSON: ${error instanceof Error ? error.message : error}`);
  }
}

function normalizeSnapshot(input, options) {
  if (Number.isNaN(Date.parse(options.checkedAt))) {
    throw new Error('--checked-at must be a valid date.');
  }

  const projects = parseJson(input);
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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function updateGoogleCloudProjectState(options, input) {
  const document = normalizeSnapshot(input, options);
  writeJson(options.file, document);
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
    const document = updateGoogleCloudProjectState(options, readInput(options));
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
