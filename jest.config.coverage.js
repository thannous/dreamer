const baseConfig = require('./jest.config');

const applicationSources = baseConfig.collectCoverageFrom.filter(
  (pattern) => !pattern.startsWith('!')
);
const coverageExclusions = baseConfig.collectCoverageFrom.filter(
  (pattern) => pattern.startsWith('!') && !pattern.includes('*.test.')
);

/** @type {import('jest').Config} */
module.exports = {
  ...baseConfig,
  collectCoverageFrom: [
    ...applicationSources,
    'scripts/**/*.{js,ts}',
    '!**/*.test.{js,ts,tsx}',
    ...coverageExclusions,
  ],
};
