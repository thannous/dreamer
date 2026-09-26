#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const EAS_CLI_VERSION = '21.0.0';
const PAGE_SIZE = 50;
const MAX_PAGES = 100;
const BLOCKING_STATUSES = new Set(['FINISHED', 'IN_PROGRESS', 'IN_QUEUE', 'AWAITING_BUILD']);
const RETRYABLE_STATUSES = new Set(['ERRORED', 'CANCELED']);
const BUILD_ID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

async function findConflictingSubmission(queryPage, buildId, platform, pageSize = PAGE_SIZE) {
  if (!BUILD_ID_PATTERN.test(buildId) || !['android', 'ios'].includes(platform)) {
    throw new Error('Internal submission lookup requires a build ID and android|ios platform');
  }
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error('Invalid EAS submission page size');
  }

  let offset = 0;
  for (let pageNumber = 0; pageNumber < MAX_PAGES; pageNumber++) {
    const page = await queryPage({ platform: platform.toUpperCase(), offset, limit: pageSize });
    if (!Array.isArray(page) || page.length > pageSize) {
      throw new Error('Invalid EAS submission response; no submission started');
    }
    for (const submission of page) {
      if (!submission || typeof submission.id !== 'string'
        || typeof submission.status !== 'string'
        || !Object.prototype.hasOwnProperty.call(submission, 'submittedBuild')
        || (submission.submittedBuild !== null
          && typeof submission.submittedBuild?.id !== 'string')) {
        throw new Error('Invalid EAS submission response; no submission started');
      }
      if (submission.submittedBuild?.id !== buildId) continue;
      if (BLOCKING_STATUSES.has(submission.status)) return submission;
      if (!RETRYABLE_STATUSES.has(submission.status)) {
        throw new Error('Unknown EAS submission status; no submission started');
      }
    }
    if (page.length < pageSize) return null;
    offset += page.length;
  }
  throw new Error('EAS submission history exceeds the preflight limit; no submission started');
}

function findPinnedEasRoot() {
  for (const directory of (process.env.PATH || '').split(path.delimiter)) {
    const binary = path.join(directory, process.platform === 'win32' ? 'eas.cmd' : 'eas');
    if (!fs.existsSync(binary)) continue;
    const candidates = [path.resolve(directory, '..', 'eas-cli')];
    try { candidates.push(path.resolve(fs.realpathSync(binary), '../..')); }
    catch { /* npm's Windows shim is not a symlink. */ }
    for (const root of candidates) {
      try {
        if (require(path.join(root, 'package.json')).version === EAS_CLI_VERSION) return root;
      } catch {
        // Another executable on PATH is not the pinned EAS CLI.
      }
    }
  }
  throw new Error('Pinned eas-cli@21.0.0 is unavailable; no submission started');
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    if (!['--project-id', '--platform', '--build-id'].includes(key) || !args[index + 1]) {
      throw new Error('Usage: check-eas-internal-submission.js --project-id UUID --platform android|ios --build-id UUID');
    }
    options[key.slice(2)] = args[index + 1];
  }
  if (!BUILD_ID_PATTERN.test(options['project-id'] || '')
    || !BUILD_ID_PATTERN.test(options['build-id'] || '')
    || !['android', 'ios'].includes(options.platform)) {
    throw new Error('Invalid EAS project, build ID or platform; no submission started');
  }
  return options;
}

async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  const root = findPinnedEasRoot();
  const { getStateJsonPath } = require(path.join(root, 'build/utils/paths'));
  const { createGraphqlClient } = require(path.join(root, 'build/commandUtils/context/contextUtils/createGraphqlClient'));
  const gql = require(require.resolve('graphql-tag', { paths: [root] }));
  const accessToken = process.env.EXPO_TOKEN || null;
  const statePath = getStateJsonPath();
  const sessionSecret = !accessToken && fs.existsSync(statePath)
    ? JSON.parse(fs.readFileSync(statePath, 'utf8')).auth?.sessionSecret
    : null;
  if (!sessionSecret && !accessToken) {
    throw new Error('EAS login or EXPO_TOKEN is required to check prior submissions');
  }

  const client = createGraphqlClient({ accessToken, sessionSecret });
  const query = gql(
    'query NoctaliaSubmittedBuilds($appId: String!, $offset: Int!, $limit: Int!, '
    + '$platform: AppPlatform) { '
    + 'app { byId(appId: $appId) { submissions(filter: { platform: $platform }, '
    + 'offset: $offset, limit: $limit) { id status submittedBuild { id } '
    + 'androidConfig { track releaseStatus } iosConfig { ascAppIdentifier } } } } }'
  );
  const queryPage = async ({ platform, offset, limit }) => {
    const result = await client.query(query, {
      appId: options['project-id'], platform, offset, limit,
    }, { requestPolicy: 'network-only' }).toPromise();
    if (result.error) throw new Error('EAS submission lookup failed; no submission started');
    const page = result.data?.app?.byId?.submissions;
    if (!Array.isArray(page)) throw new Error('Invalid EAS submission response; no submission started');
    return page;
  };

  const existing = await findConflictingSubmission(
    queryPage, options['build-id'], options.platform
  );
  if (existing) {
    throw new Error(
      'EAS build ' + options['build-id'] + ' already has a ' + existing.status
      + ' submission (' + existing.id + '); no new submission started'
    );
  }
  console.log('No completed or active EAS submission found for build ' + options['build-id'] + '.');
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { findConflictingSubmission, main };
