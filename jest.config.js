/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^react-native$': '<rootDir>/tests/react-native-stub.ts',
    '^react-native-reanimated$': '<rootDir>/tests/react-native-reanimated-stub.ts',
    '^@react-native-masked-view/masked-view$': '<rootDir>/tests/masked-view-stub.ts',
    '^expo-blur$': '<rootDir>/tests/expo-blur-stub.ts',
    '^@expo/vector-icons/.+$': '<rootDir>/tests/expo-vector-icons-subpath-stub.ts',
    '^@expo/vector-icons$': '<rootDir>/tests/expo-vector-icons-stub.ts',
    '^expo-linear-gradient$': '<rootDir>/tests/expo-linear-gradient-stub.ts',
  },
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '\\.perf\\.test\\.(ts|tsx)$'],
};
