// Keep the official mock's shared values stable across React renders, like the native hook.
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest hoists this mock factory.
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Version-matched official mock.
  const mock = require('react-native-reanimated/mock');
  return {
    ...mock,
    useSharedValue: (initial: unknown) => React.useState(() => mock.useSharedValue(initial))[0],
  };
});

// The mock store is module-level state shared by every test in a file.
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

/** Every test starts from an empty device. */
beforeEach(async () => {
  await AsyncStorage.clear();
});
