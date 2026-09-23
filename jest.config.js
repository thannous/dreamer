const os = require('node:os');

// Leave two cores for the machine and cap at 8. On a 10-core Mac a warm run
// dropped from about 17s with 4 workers to about 13s with 8. CI keeps half.
const localWorkers = Math.max(4, Math.min(8, os.availableParallelism() - 2));

/** @type {import('jest').Config} */
module.exports = {
  // Keep the lightweight Node CLI tests isolated from the Expo preset.
  projects: [
    '<rootDir>/jest.config.node.js',
    '<rootDir>/jest.config.journal.js',
    '<rootDir>/jest.config.expo.js',
  ],
  maxWorkers: process.env.CI ? '50%' : localWorkers,
  // Node's crawler is deterministic here and avoids sandbox-specific Watchman failures.
  watchman: false,
  // Include application files that no test imports yet, so coverage cannot hide gaps.
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'constants/**/*.{ts,tsx}',
    'context/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'services/**/*.{ts,tsx}',
    '!**/*.test.{ts,tsx}',
    '!**/__tests__/**',
  ],
};
