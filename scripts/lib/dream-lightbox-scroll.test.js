'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('dream dialog scrolling with the real Lenis runtime', () => {
  // JSDOM 27 and Lenis use native ESM; execute the integration in Node rather
  // than Jest's CommonJS transformer, without mocking either dependency.
  const result = spawnSync(process.execPath, ['--test', path.join(__dirname, 'dream-lightbox-scroll.fixture.cjs')], {
    encoding: 'utf8',
    timeout: 15000,
  });
  if (result.status !== 0) throw new Error(result.error?.message || `${result.stdout}\n${result.stderr}`);
}, 20000);
