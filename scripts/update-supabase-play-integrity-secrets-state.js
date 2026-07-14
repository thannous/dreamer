#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_TARGET = path.join(ROOT, 'doc_web_interne/docs/supabase-play-integrity-secrets-state.local.json');
const EXPECTED_PACKAGE_NAME = 'com.tanuki75.noctalia';
const REQUIRED_SECRETS = {
  PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64: {
    label: 'Play Integrity service account JSON',
    expected: 'present',
  },
  PLAY_INTEGRITY_PACKAGE_NAME: {
    label: 'Play Integrity package name',
    expected: EXPECTED_PACKAGE_NAME,
  },
  GUEST_SESSION_SECRET: {
    label: 'Guest session signing secret',
    expected: 'present',
  },
};

function parseArgs(argv) {
  const options = {
    file: process.env.SUPABASE_PLAY_INTEGRITY_SECRETS_STATE_PATH
      ? path.resolve(ROOT, process.env.SUPABASE_PLAY_INTEGRITY_SECRETS_STATE_PATH)
      : DEFAULT_TARGET,
    checkedAt: new Date().toISOString(),
    source: 'Supabase dashboard or CLI secrets read-only check',
    secrets: {},
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
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
    if (arg === '--project-ref') {
      options.projectRef = argv[i + 1];
      i += 1;
      continue;
    }

    const secretName = Object.keys(REQUIRED_SECRETS).find((name) => arg === `--${name}`);
    if (secretName) {
      options.secrets[secretName] = {
        ...(options.secrets[secretName] ?? {}),
        status: argv[i + 1],
      };
      i += 1;
      continue;
    }

    const valueName = Object.keys(REQUIRED_SECRETS).find((name) => arg === `--${name}-value`);
    if (valueName) {
      options.secrets[valueName] = {
        ...(options.secrets[valueName] ?? {}),
        value: argv[i + 1],
      };
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
  node ./scripts/update-supabase-play-integrity-secrets-state.js \\
    --project-ref usuyppgsmmowzizhaoqj \\
    --PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64 present \\
    --PLAY_INTEGRITY_PACKAGE_NAME present \\
    --PLAY_INTEGRITY_PACKAGE_NAME-value com.tanuki75.noctalia \\
    --GUEST_SESSION_SECRET present

Options:
  --file <path>                                      Snapshot file to update. Defaults to doc_web_interne/docs/supabase-play-integrity-secrets-state.local.json
  --checked-at <iso>                                 Override timestamp. Defaults to now.
  --source <label>                                   Snapshot source label.
  --project-ref <ref>                                Supabase project ref.
  --PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64 <status>
  --PLAY_INTEGRITY_PACKAGE_NAME <status>
  --PLAY_INTEGRITY_PACKAGE_NAME-value <package-name> Records only the package name, not secret material.
  --GUEST_SESSION_SECRET <status>

Statuses: present, missing, unknown.
`.trim());
}

function normalizeStatus(value) {
  const status = String(value || 'unknown').trim().toLowerCase();
  if (!['present', 'missing', 'unknown'].includes(status)) {
    throw new Error(`Unsupported secret status: ${value}.`);
  }
  return status;
}

function normalizeSnapshot(options) {
  if (Number.isNaN(Date.parse(options.checkedAt))) {
    throw new Error('--checked-at must be a valid date.');
  }
  const secrets = {};
  for (const [name, config] of Object.entries(REQUIRED_SECRETS)) {
    const input = options.secrets[name] ?? {};
    const status = normalizeStatus(input.status);
    secrets[name] = {
      label: config.label,
      status,
    };
    if (name === 'PLAY_INTEGRITY_PACKAGE_NAME') {
      secrets[name].value = String(input.value || '').trim();
    }
  }
  return {
    checked_at: options.checkedAt,
    source: options.source,
    project_ref: String(options.projectRef || '').trim(),
    secrets,
  };
}

function getSupabasePlayIntegritySecretIssues(snapshot) {
  const issues = [];
  for (const name of Object.keys(REQUIRED_SECRETS)) {
    const secret = snapshot?.secrets?.[name];
    const status = normalizeStatus(secret?.status);
    if (status !== 'present') {
      issues.push(`${name}/${status}`);
      continue;
    }
    if (name === 'PLAY_INTEGRITY_PACKAGE_NAME') {
      const value = String(secret?.value || '').trim();
      if (value !== EXPECTED_PACKAGE_NAME) {
        issues.push(`${name}/value=${value || 'missing'} expected ${EXPECTED_PACKAGE_NAME}`);
      }
    }
  }
  return issues;
}

function isSupabasePlayIntegritySecretsReady(snapshot) {
  return getSupabasePlayIntegritySecretIssues(snapshot).length === 0;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function updateSupabasePlayIntegritySecretsState(options) {
  const document = normalizeSnapshot(options);
  writeJson(options.file, document);
  return document;
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const document = updateSupabasePlayIntegritySecretsState(options);
    const issues = getSupabasePlayIntegritySecretIssues(document);
    console.log(`Updated ${path.relative(ROOT, options.file)}`);
    console.log(`Supabase Play Integrity secrets: ${issues.length === 0 ? 'ready' : `blocked (${issues.join(', ')})`}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

module.exports = {
  EXPECTED_PACKAGE_NAME,
  REQUIRED_SECRETS,
  getSupabasePlayIntegritySecretIssues,
  isSupabasePlayIntegritySecretsReady,
  normalizeSnapshot,
  parseArgs,
  updateSupabasePlayIntegritySecretsState,
};
