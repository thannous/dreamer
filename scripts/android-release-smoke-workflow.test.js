'use strict';
/* global __dirname, describe, expect, it */

// Contract between .eas/workflows/android-release-smoke.yml and
// scripts/check-android-release-ref.js: each job that checks a built
// versionCode must give the script what it needs for the repository's
// appVersionSource. With remote versioning the script requires
// EXPECTED_ANDROID_VERSION_CODE from the metadata of the same EAS build; a job
// that passed only BUILT_ANDROID_VERSION_CODE made every dispatched smoke fail.

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

const { readReleaseIdentity, readRequireBuiltVersionCode, validateReleaseRef } = require('./check-android-release-ref');

const ROOT = path.resolve(__dirname, '..');
const WORKFLOW = path.join(ROOT, '.eas/workflows/android-release-smoke.yml');
const SCRIPT = path.join(ROOT, 'scripts/check-android-release-ref.js');
const BUILD_OUTPUT = /^\$\{\{\s*needs\.([A-Za-z0-9_]+)\.outputs\.app_build_version\s*\}\}$/;

function readWorkflow() {
  return YAML.parse(fs.readFileSync(WORKFLOW, 'utf8'));
}

function versionSource() {
  const eas = JSON.parse(fs.readFileSync(path.join(ROOT, 'eas.json'), 'utf8'));
  return eas.cli?.appVersionSource || 'local';
}

function versionCheckJobs(workflow) {
  return Object.entries(workflow.jobs).filter(([, job]) => job.env && 'BUILT_ANDROID_VERSION_CODE' in job.env);
}

// Resolve `${{ needs.<build>.outputs.app_build_version }}` to the code the
// build job would report, after checking it names a build job this job needs.
function resolveEnv(workflow, jobName, job, reportedCode) {
  const resolved = {};
  for (const [key, value] of Object.entries(job.env)) {
    const match = typeof value === 'string' ? value.match(BUILD_OUTPUT) : null;
    if (!match) continue;
    const [, buildJob] = match;
    expect([].concat(job.needs || [])).toContain(buildJob);
    expect(workflow.jobs[buildJob]?.type).toBe('build');
    resolved[key] = reportedCode;
  }
  return resolved;
}

// The literal env values of a job (no `${{ }}` expression), as the script reads them.
function staticEnv(job) {
  return Object.fromEntries(
    Object.entries(job.env).filter(([, value]) => !String(value).includes('${{')).map(([key, value]) => [key, String(value)])
  );
}

// Run the real script as the job would, with the build output resolved to
// `reportedCode` and the release tag of the app version.
function runScript(workflow, jobName, job, reportedCode) {
  const tag = `v${readReleaseIdentity(ROOT).version}`;
  return spawnSync(process.execPath, [SCRIPT], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      ...staticEnv(job),
      ...resolveEnv(workflow, jobName, job, reportedCode),
      RELEASE_REF_NAME: tag,
      RELEASE_REF_TYPE: 'tag',
      RELEASE_TAG: tag,
    },
  });
}

function runCheck(env, source) {
  const releaseIdentity = readReleaseIdentity(ROOT);
  return validateReleaseRef({
    builtVersionCode: env.BUILT_ANDROID_VERSION_CODE || '',
    expectedRemoteVersionCode: env.EXPECTED_ANDROID_VERSION_CODE || '',
    requireBuiltVersionCode: readRequireBuiltVersionCode(env),
    versionSource: source,
    // The release tag of the app version, so the build check is what is tested.
    refName: `v${releaseIdentity.version}`,
    refType: 'tag',
    releaseIdentity,
  });
}

describe('android-release-smoke workflow and the release ref guard', () => {
  it('checks the built versionCode in at least one job', () => {
    expect(versionCheckJobs(readWorkflow()).length).toBeGreaterThan(0);
  });

  it('gives every build check the expected code of the same EAS build under remote versioning', () => {
    const workflow = readWorkflow();
    const source = versionSource();
    // A remote counter is ahead of the local mirror: use a code app.json does not hold.
    const reportedCode = String(readReleaseIdentity(ROOT).versionCode + 7);

    for (const [jobName, job] of versionCheckJobs(workflow)) {
      if (source === 'remote') {
        expect(job.env.EXPECTED_ANDROID_VERSION_CODE).toBe(job.env.BUILT_ANDROID_VERSION_CODE);
      }
      const env = { ...staticEnv(job), ...resolveEnv(workflow, jobName, job, reportedCode) };
      expect(env.BUILT_ANDROID_VERSION_CODE).toBe(reportedCode);
      expect(runCheck(env, source)).toMatchObject({
        builtVersionCode: reportedCode,
        versionCode: source === 'remote' ? Number(reportedCode) : expect.any(Number),
      });
    }
  });

  it('makes every build check require a built versionCode', () => {
    for (const [, job] of versionCheckJobs(readWorkflow())) {
      expect(job.env.REQUIRE_BUILT_ANDROID_VERSION_CODE).toBe('1');
    }
  });

  it('fails the build check, through the real script, when the build output is empty', () => {
    const workflow = readWorkflow();
    const reportedCode = String(readReleaseIdentity(ROOT).versionCode + 7);
    for (const [jobName, job] of versionCheckJobs(workflow)) {
      const empty = runScript(workflow, jobName, job, '');
      expect(empty.status).toBe(1);
      expect(empty.stderr).toContain('BUILT_ANDROID_VERSION_CODE is empty');
      expect(empty.stdout).not.toContain('identity valid');

      const built = runScript(workflow, jobName, job, reportedCode);
      expect(built.stderr).toBe('');
      expect(built.status).toBe(0);
      expect(built.stdout).toContain('EAS build matched');
    }
  });

  it('would fail a remote build check that omits the expected code (the bug this guards)', () => {
    expect(() => runCheck({ BUILT_ANDROID_VERSION_CODE: '90' }, 'remote')).toThrow('EXPECTED_ANDROID_VERSION_CODE');
  });
});
