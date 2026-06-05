#!/usr/bin/env node
'use strict';

const Module = require('node:module');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const args = process.argv.slice(2);
const allowStandaloneDevTools = process.env.EXPO_USE_STANDALONE_RN_DEVTOOLS === '1';

if (process.env.CODEX_CI === '1') {
  const watchmanSock = path.join(
    os.homedir(),
    '.local',
    'state',
    'watchman',
    `${os.userInfo().username}-state`,
    'sock',
  );

  // Metro's Watchman probe runs inside the Codex sandbox. Give it writable
  // state and reuse the already-started user Watchman socket when available.
  if (fs.existsSync(watchmanSock)) {
    process.env.WATCHMAN_SOCK ??= watchmanSock;
    process.env.XDG_STATE_HOME ??= path.join(os.tmpdir(), 'codex-watchman-state');
  }
}

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
