#!/usr/bin/env bash

set -euo pipefail

repository_root="$(git rev-parse --show-toplevel)"
classifier="$repository_root/.circleci/scripts/classify-changes.sh"
continuation_config="$repository_root/.circleci/continue.yml"
test_root="$(mktemp -d)"
trap 'rm -rf "$test_root"' EXIT

head_revision="$(git -C "$repository_root" rev-parse HEAD)"
fallback_parameters_file="$test_root/fallback-parameters.json"
(
  cd "$repository_root"
  "$classifier" pr deadbeef "$head_revision" "$fallback_parameters_file" >/dev/null
)

fallback_contract="$(FALLBACK_PARAMETERS_FILE="$fallback_parameters_file" node -e '
const fs = require("fs");
const parameters = JSON.parse(fs.readFileSync(process.env.FALLBACK_PARAMETERS_FILE, "utf8"));
process.stdout.write([parameters.run_full_tests, parameters.run_changed_tests, parameters.require_timing_baseline].join("|"));
')"
if [[ "$fallback_contract" != "true|false|false" ]]; then
  echo "Fallback parameters do not select the full Jest run without a timing baseline: $fallback_contract" >&2
  exit 1
fi

CONTINUATION_CONFIG="$continuation_config" node - <<'NODE'
const fs = require('fs');
const YAML = require('yaml');

const config = YAML.parse(fs.readFileSync(process.env.CONTINUATION_CONFIG, 'utf8'));
const workflowJob = config.workflows?.noctalia?.jobs?.find((job) => job['noctalia-quality']);
const workflowParameters = workflowJob?.['noctalia-quality'];
if (workflowParameters?.run_full_tests !== '<< pipeline.parameters.run_full_tests >>') {
  throw new Error('noctalia workflow does not pass run_full_tests through');
}

const fullGate = config.jobs?.['noctalia-quality']?.steps?.find(
  (step) => step.when?.condition === '<< parameters.run_full_tests >>',
);
if (!fullGate) throw new Error('noctalia job has no full Jest condition');

const jestStep = fullGate.when.steps.find(
  (step) => step.run?.name === 'Run full Noctalia Jest suite and capture timing JSON',
);
if (!jestStep?.run?.command?.includes('npm run test:fast --')) {
  throw new Error('full Jest condition does not invoke npm run test:fast');
}

const timingGate = fullGate.when.steps.find(
  (step) => step.when?.condition === '<< parameters.require_timing_baseline >>',
);
if (!timingGate?.when?.steps?.some((step) => step.restore_cache?.keys?.includes('jest-timing-master-v1-'))) {
  throw new Error('timing baseline restore is not guarded by require_timing_baseline');
}

const publishGate = fullGate.when.steps.find(
  (step) => step.when?.condition === '<< parameters.publish_timing_baseline >>',
);
if (!publishGate) throw new Error('timing baseline publication guard is missing');

const publishRun = publishGate.when.steps.find(
  (step) => step.run?.name === 'Prepare successful master timing baseline',
);
if (!publishRun?.run?.command?.includes('check-jest-duration-regression.js --update-history')) {
  throw new Error('baseline publication does not append the run to the timing history');
}
const publishCache = publishGate.when.steps.find((step) => step.save_cache);
if (!publishCache?.save_cache?.paths?.includes('artifacts/baseline/jest-timing-history.json')) {
  throw new Error('timing history is not part of the published baseline cache');
}

// Evaluate the actual site condition across every routing combination.
const siteGate = config.jobs['site-build'].steps.find(step => step.when);
const siteJest = siteGate?.when.steps.find(step => step.run?.name === 'Test site tooling changed since the diff base');
const changedGate = config.jobs['noctalia-quality'].steps.find(step => step.when?.condition === '<< parameters.run_changed_tests >>');
const appJest = changedGate?.when.steps.find(step => step.run?.name === 'Test Noctalia files changed since the diff base');
for (const step of [siteJest, appJest]) {
  if (!step?.run?.command?.includes('npm run test:changed --') ||
      /--(?:selectProjects|ignoreProjects|testPath|testName|findRelatedTests)/.test(step.run.command) ||
      step.run.environment?.JEST_CHANGED_SINCE !== '<< parameters.diff_base >>') {
    throw new Error('Site and application must retain the same affected Jest portfolio and base');
  }
}
for (const job of ['site', 'noctalia']) {
  const parameters = config.workflows[job].jobs[0][job === 'site' ? 'site-build' : 'noctalia-quality'];
  if (parameters.diff_base !== '<< pipeline.parameters.diff_base >>') throw new Error('Diff bases diverge');
}
function evaluate(condition, parameters) {
  if (typeof condition === 'boolean') return condition;
  if (typeof condition === 'string') {
    const key = condition.match(/^<< pipeline\.parameters\.(\w+) >>$/)?.[1];
    if (!Object.hasOwn(parameters, key)) throw new Error(`Unknown condition: ${condition}`);
    return parameters[key];
  }
  if (condition.not !== undefined) return !evaluate(condition.not, parameters);
  if (condition.and) return condition.and.every(child => evaluate(child, parameters));
  if (condition.or) return condition.or.some(child => evaluate(child, parameters));
  throw new Error('Unknown condition structure');
}
for (const run_noctalia of [false, true]) {
  for (const run_changed_tests of [false, true]) {
    for (const run_full_tests of [false, true]) {
      const parameters = { run_noctalia, run_changed_tests, run_full_tests };
      const coveredByApp = run_noctalia && (run_changed_tests || run_full_tests);
      const runsOnSite = evaluate(siteGate.when.condition, parameters);
      if (Number(coveredByApp) + Number(runsOnSite) !== 1) {
        throw new Error(`Root Jest is missing or duplicated for ${JSON.stringify(parameters)}`);
      }
    }
  }
}
for (const command of ['npm run docs:build', 'npm run docs:check']) {
  if (!config.jobs['site-build'].steps.some(step => step.run?.command === command)) {
    throw new Error(`Unconditional site check missing: ${command}`);
  }
}
console.log('Continuation mapping, full-Jest guards and site coverage routing passed.');
NODE

# Remote CI is manual-only: a webhook pipeline must run no workflow (no credits).
# The gate is an OR of GitHub App event.name, legacy trigger_source, current
# trigger.type, and force_full_validation. Every combination below is evaluated.
SETUP_CONFIG="$repository_root/.circleci/config.yml" node - <<'NODE'
const fs = require('fs');
const YAML = require('yaml');

const setup = YAML.parse(fs.readFileSync(process.env.SETUP_CONFIG, 'utf8'));
const workflows = Object.keys(setup.workflows ?? {});
if (workflows.length !== 1 || workflows[0] !== 'setup') {
  throw new Error(`The setup config must hold only the gated setup workflow: ${workflows}`);
}
const gate = setup.workflows.setup.when;
const EVENT = '<< pipeline.event.name >>';
const TRIGGER_SOURCE = '<< pipeline.trigger_source >>';
const TRIGGER_TYPE = '<< pipeline.trigger.type >>';
const FORCE = '<< pipeline.parameters.force_full_validation >>';
function resolve(value, ctx) {
  if (value === EVENT) return ctx.eventName;
  if (value === TRIGGER_SOURCE) return ctx.triggerSource;
  if (value === TRIGGER_TYPE) return ctx.triggerType;
  if (value === FORCE) return ctx.force;
  return value;
}
function evaluate(condition, ctx) {
  if (typeof condition === 'boolean') return condition;
  if (condition === FORCE) return ctx.force;
  if (typeof condition === 'string') throw new Error(`Unexpected string condition: ${condition}`);
  if (condition.or) return condition.or.some(child => evaluate(child, ctx));
  if (condition.and) return condition.and.every(child => evaluate(child, ctx));
  if (condition.not !== undefined) return !evaluate(condition.not, ctx);
  if (Array.isArray(condition.equal) && condition.equal.length === 2) {
    return resolve(condition.equal[0], ctx) === resolve(condition.equal[1], ctx);
  }
  throw new Error(`Unknown condition: ${JSON.stringify(condition)}`);
}
const serialized = JSON.stringify(gate);
for (const field of [EVENT, TRIGGER_SOURCE, TRIGGER_TYPE, FORCE]) {
  if (!serialized.includes(field)) throw new Error(`Setup gate is missing ${field}`);
}
function expectRun(label, ctx, shouldRun) {
  const actual = evaluate(gate, ctx);
  if (actual !== shouldRun) {
    throw new Error(`${label} ${shouldRun ? 'must run' : 'must stay off'}: ${JSON.stringify(ctx)} -> ${actual}`);
  }
}
expectRun('GitHub App api event', {
  eventName: 'api', triggerSource: 'webhook', triggerType: 'github_app', force: false,
}, true);
expectRun('legacy OAuth api via trigger_source', {
  eventName: '', triggerSource: 'api', triggerType: 'github_oauth', force: false,
}, true);
expectRun('legacy OAuth api via trigger.type', {
  eventName: '', triggerSource: '', triggerType: 'api', force: false,
}, true);
expectRun('legacy OAuth webhook', {
  eventName: '', triggerSource: 'webhook', triggerType: 'github_oauth', force: false,
}, false);
expectRun('legacy OAuth push event name with webhook source', {
  eventName: 'push', triggerSource: 'webhook', triggerType: 'github_oauth', force: false,
}, false);
expectRun('scheduled pipeline', {
  eventName: 'schedule', triggerSource: 'scheduled_pipeline', triggerType: 'schedule', force: false,
}, false);
expectRun('force_full_validation on an OAuth webhook', {
  eventName: '', triggerSource: 'webhook', triggerType: 'github_oauth', force: true,
}, true);

const eventNames = ['api', 'push', 'pull_request', 'schedule', 'custom_webhook', ''];
const triggerSources = ['api', 'webhook', 'scheduled_pipeline', 'explicit', ''];
const triggerTypes = ['api', 'github_oauth', 'github_app', 'schedule', 'webhook', ''];
let cases = 0;
for (const eventName of eventNames) {
  for (const triggerSource of triggerSources) {
    for (const triggerType of triggerTypes) {
      for (const force of [false, true]) {
        const ctx = { eventName, triggerSource, triggerType, force };
        const shouldRun = eventName === 'api' || triggerSource === 'api' || triggerType === 'api' || force === true;
        expectRun('combination', ctx, shouldRun);
        cases += 1;
      }
    }
  }
}
if (setup.parameters?.force_full_validation?.default !== false) {
  throw new Error('force_full_validation must stay available for manual full runs');
}
console.log(`Setup workflow gate passed ${cases} trigger combinations. Webhook pushes stay off. Legacy OAuth api runs.`);
NODE

fixture_results="$test_root/jest-test-results"
fixture_json="$test_root/jest-results.json"
mkdir -p "$fixture_results"
(
  cd "$repository_root"
  JEST_JUNIT_ADD_FILE_ATTRIBUTE=true \
  JEST_JUNIT_OUTPUT_DIR="$fixture_results" \
  JEST_JUNIT_OUTPUT_NAME=jest.xml \
  npm run test:fast -- \
    scripts/list-scripts.test.js \
    --runInBand \
    --json \
    --outputFile="$fixture_json" \
    --reporters=default \
    --reporters=jest-junit
)

FIXTURE_JSON="$fixture_json" node - <<'NODE'
const fs = require('fs');
const results = JSON.parse(fs.readFileSync(process.env.FIXTURE_JSON, 'utf8'));
if (!results.success || results.numTotalTests < 1 || results.numPassedTests !== results.numTotalTests || results.numFailedTests !== 0) {
  throw new Error(`Jest fallback fixture failed: ${JSON.stringify({
    total: results.numTotalTests,
    passed: results.numPassedTests,
    failed: results.numFailedTests,
    success: results.success,
  })}`);
}
console.log(`Jest fallback fixture passed: ${results.numTotalTests} tests, exit 0.`);
NODE
