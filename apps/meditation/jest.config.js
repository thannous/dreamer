/**
 * Jest for Expo SDK 57, as the Expo unit-testing guide prescribes: the
 * `jest-expo` preset brings the React Native transform, the platform mocks and
 * the `@/*` aliases read from tsconfig.
 *
 * `npm test` runs the suite once and exits — never watch mode.
 */
module.exports = {
  preset: 'jest-expo',
  // Reanimated 4 loads react-native-worklets at import time; without this
  // resolver every component that imports Reanimated dies on module load.
  resolver: 'react-native-worklets/jest/resolver.js',
  testMatch: ['<rootDir>/tests/**/*.test.ts?(x)'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    // Uniwind is a Metro plugin: `className` is compiled away at bundle time
    // and the stylesheet does not exist here. `className` itself is an inert
    // prop under the preset, but the two module shapes below have to be faked.
    '\\.css$': '<rootDir>/tests/mocks/styleMock.ts',
    '^uniwind$': '<rootDir>/tests/mocks/uniwind.ts',
  },
  clearMocks: true,
};
