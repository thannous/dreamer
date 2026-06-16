const originalDefineProperties = Object.defineProperties;

Object.defineProperties = function patchedDefineProperties(target, descriptors) {
  if (target && descriptors && 'window' in descriptors) {
    const existingWindow = Object.getOwnPropertyDescriptor(target, 'window');
    if (existingWindow) {
      const { window, ...rest } = descriptors;
      return originalDefineProperties(target, rest);
    }
  }

  return originalDefineProperties(target, descriptors);
};

try {
  require('@react-native/jest-preset/jest/setup');
} finally {
  Object.defineProperties = originalDefineProperties;
}
