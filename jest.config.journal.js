/** Journal contracts execute in Node without Expo/React Native runtime setup. */
module.exports = {
  displayName: 'journal',
  roots: ['<rootDir>/services'],
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/services/__tests__/journalDreamMapper.test.ts',
    '<rootDir>/services/__tests__/journalRepository.test.ts',
  ],
  setupFiles: [],
  setupFilesAfterEnv: [],
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', {
      configFile: false,
      babelrc: false,
      presets: ['babel-preset-expo'],
    }],
  },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
};
