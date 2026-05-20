#!/usr/bin/env node
'use strict';

const Module = require('node:module');

const args = process.argv.slice(2);
const allowStandaloneDevTools = process.env.EXPO_USE_STANDALONE_RN_DEVTOOLS === '1';

if (!allowStandaloneDevTools) {
  // RN 0.83+ can open DevTools through a downloaded Electron shell. On this
  // Mac that shell crashes during AppKit registration when launched from Codex,
  // so keep Expo on the browser-backed DevTools path unless explicitly opted in.
  const originalLoad = Module._load;
  let patchedDevMiddleware;

  Module._load = function loadWithSafeDevTools(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);

    if (request !== '@react-native/dev-middleware') {
      return loaded;
    }

    if (!loaded || typeof loaded.createDevMiddleware !== 'function') {
      return loaded;
    }

    if (!patchedDevMiddleware) {
      patchedDevMiddleware = {
        ...loaded,
        createDevMiddleware(options = {}) {
          return loaded.createDevMiddleware({
            ...options,
            unstable_experiments: {
              ...options.unstable_experiments,
              enableStandaloneFuseboxShell: false,
            },
          });
        },
      };
    }

    return patchedDevMiddleware;
  };
}

process.argv = [process.argv[0], require.resolve('expo/bin/cli'), ...args];
require('expo/bin/cli');
