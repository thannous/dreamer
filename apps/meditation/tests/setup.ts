import AsyncStorage from '@react-native-async-storage/async-storage';

// The mock store is module-level state shared by every test in a file.
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

/** Every test starts from an empty device. */
beforeEach(async () => {
  await AsyncStorage.clear();
});
