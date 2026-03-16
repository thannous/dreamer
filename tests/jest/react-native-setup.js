const originalDefineProperties = Object.defineProperties;

Object.defineProperties = function patchedDefineProperties(target, descriptors) {
  if (target === globalThis && descriptors && 'window' in descriptors) {
    const existingWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    if (existingWindow && !existingWindow.configurable) {
      const { window, ...rest } = descriptors;
      return originalDefineProperties(target, rest);
    }
  }

  return originalDefineProperties(target, descriptors);
};

try {
  require('react-native/jest/setup');
} finally {
  Object.defineProperties = originalDefineProperties;
}
