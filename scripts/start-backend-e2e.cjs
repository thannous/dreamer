#!/usr/bin/env node
'use strict';
const { spawnSync } = require('node:child_process');
if (!process.env.E2E_BACKEND_PROFILE) throw new Error('Use npm run test:e2e:backend');
const result = spawnSync(process.execPath, [require.resolve('./expo-safe-runner.js'), '--profile', process.env.E2E_BACKEND_PROFILE, 'start', ...process.argv.slice(2)], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
