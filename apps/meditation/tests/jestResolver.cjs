const workletsResolver = require('react-native-worklets/jest/resolver.js');

// Jest has no UI runtime for Reanimated's new native CSS registration.
// Use the JS mutable implementation too: Worklets' Jest shareables do not run native decorators.
module.exports = (request, options) => workletsResolver(request,
  ['./initializers', './mutables', '../mutables'].includes(request) && options.basedir.includes('react-native-reanimated')
    ? { ...options, extensions: options.extensions?.filter((extension) => !extension.includes('native')) }
    : options
);
