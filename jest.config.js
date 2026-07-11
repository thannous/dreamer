/** @type {import('jest').Config} */
module.exports = {
  // Keep the lightweight Node CLI tests isolated from the Expo preset.
  projects: [
    '<rootDir>/jest.config.node.js',
    '<rootDir>/jest.config.expo.js',
  ],
  // More Expo/JSDOM workers increase startup and teardown contention locally.
  maxWorkers: process.env.CI ? '50%' : 4,
  // Node's crawler is deterministic here and avoids sandbox-specific Watchman failures.
  watchman: false,
};
