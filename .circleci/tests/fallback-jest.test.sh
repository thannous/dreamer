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

console.log('Continuation mapping and full-Jest guards passed.');
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
