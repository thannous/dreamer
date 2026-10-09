'use strict';

const { runNpm, runPrePush } = require('./run-jest-changed');

// Lint targets (brand check, app, components, hooks, lib, context, constants,
// services, tests, supabase/functions, scripts) are all product surfaces in
// the CI classifier. A diff that selects none of them is internal or planning
// documentation, or generated docs output. Site content sets run_site and
// stays on the full path, including docs:build and docs:check inside pre-push.
const PRODUCT_KEYS = [
  'run_noctalia',
  'run_meditation',
  'run_site',
  'run_edge_functions',
  'run_edge_contracts',
  'run_changed_tests',
  'run_full_tests',
];

function selectsNoProductSurface(parameters) {
  return PRODUCT_KEYS.every((key) => parameters?.[key] === false);
}

function verifyFast({
  runPrePushImpl = runPrePush,
  runNpmImpl = runNpm,
  log = console.log,
} = {}) {
  let parameters;
  const status = runPrePushImpl({
    observeImpl(value) {
      parameters = value;
    },
  });
  if (status !== 0) return status;
  if (!parameters) throw new Error('Pre-push finished without a classification.');
  if (selectsNoProductSurface(parameters)) {
    log('verify:fast: no product surface changed (documentation outside site content). lint and lint:scripts skipped. The checked-out SHA is still bound.');
    return 0;
  }
  for (const script of ['lint', 'lint:scripts']) {
    const code = runNpmImpl(script);
    if (code !== 0) return code;
  }
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = verifyFast();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = { verifyFast, selectsNoProductSurface };
