// Explicit native qualification, never part of the portable Jest inventory.
module.exports = {
  ...require('./jest.config.expo'),
  displayName: 'posix-native',
  testMatch: ['<rootDir>/scripts/*.posix-native.ts'],
};
