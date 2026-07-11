/** @type {import('jest').Config} */
module.exports = {
  displayName: 'node',
  roots: ['<rootDir>/scripts'],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/scripts/**/*.test.js'],
  // These CommonJS CLI tests need neither Babel transforms nor Expo setup files.
  transform: {},
  setupFiles: [],
  setupFilesAfterEnv: [],
};
