// react-native-nitro-modules is only the runtime of the iOS-only HealthKit
// module; nothing on Android uses it, so keep its native library out of the APK.
module.exports = {
  dependencies: {
    'react-native-nitro-modules': { platforms: { android: null } },
  },
};
