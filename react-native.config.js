// HealthKit is only reachable from Lucid Trainer (services/lucidHealthKit.ts), and
// react-native-nitro-modules is only its runtime. Dreamer builds run with
// NOCTALIA_APP_VARIANT unset or 'noctalia', so they link neither on iOS; that
// keeps about 1.9 MB of native code and the HealthKit framework out of the app.
// Nothing on Android uses either, so they never link there.
const lucid = process.env.NOCTALIA_APP_VARIANT === 'lucid';
const iosOnlyForLucid = () => (lucid ? { android: null } : { android: null, ios: null });

module.exports = {
  dependencies: {
    '@kingstinct/react-native-healthkit': { platforms: iosOnlyForLucid() },
    'react-native-nitro-modules': { platforms: iosOnlyForLucid() },
  },
};
