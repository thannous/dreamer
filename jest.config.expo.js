const preset = require('jest-expo/jest-preset');

/** @type {import('jest').Config} */
module.exports = {
  ...preset,
  displayName: 'expo',
  // Keep Jest's haste map focused on application trees that actually contain tests.
  // Script tests run in the separate, transform-free Node project.
  roots: [
    '<rootDir>/app',
    '<rootDir>/components',
    '<rootDir>/context',
    '<rootDir>/hooks',
    '<rootDir>/lib',
    '<rootDir>/services',
    '<rootDir>/tests',
    // TypeScript script tests still rely on the Expo/Babel transform.
    '<rootDir>/scripts',
  ],
  testEnvironment: 'node',
  setupFiles: (preset.setupFiles ?? []).map((entry) =>
    /@react-native[\\/]jest-preset[\\/]jest[\\/]setup\.js$/.test(entry) ||
    /react-native[\\/]jest[\\/]setup\.js$/.test(entry)
      ? '<rootDir>/tests/jest/react-native-setup.js'
      : entry
  ),
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: (preset.transformIgnorePatterns ?? []).map((pattern) =>
    pattern.replace('(.pnpm|react-native', '(.pnpm|.deno|react-native')
  ),
  moduleNameMapper: {
    ...(preset.moduleNameMapper ?? {}),
    '^@/(.*)$': '<rootDir>/$1',
    '^react-native$': '<rootDir>/tests/react-native-stub.ts',
    '^react-native-reanimated$': '<rootDir>/tests/react-native-reanimated-stub.ts',
    '^@react-native-masked-view/masked-view$': '<rootDir>/tests/masked-view-stub.ts',
    '^@expo/ui/community/masked-view$': '<rootDir>/tests/masked-view-stub.ts',
    '^@expo/ui/community/datetime-picker$': '<rootDir>/tests/expo-ui-datetime-picker-stub.tsx',
    '^@expo/ui$': '<rootDir>/tests/expo-ui-stub.tsx',
    '^expo-blur$': '<rootDir>/tests/expo-blur-stub.ts',
    '^@expo/vector-icons/.+$': '<rootDir>/tests/expo-vector-icons-subpath-stub.ts',
    '^@expo/vector-icons$': '<rootDir>/tests/expo-vector-icons-stub.ts',
    '^expo-linear-gradient$': '<rootDir>/tests/expo-linear-gradient-stub.ts',
    '^expo$': '<rootDir>/tests/expo-stub.ts',
    '^react-native-svg$': '<rootDir>/tests/react-native-svg-stub.ts',
  },
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/scripts/.*\\.test\\.js$',
    '\\.perf\\.test\\.(ts|tsx)$',
    '<rootDir>/supabase/functions/.*\\.test\\.ts$',
  ],
};
