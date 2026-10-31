// Release gate (verify:release --target app): an app build or OTA may only reference media
// already published. The CDN keeps a 404 for hours, so a painting the app asks for before
// its upload stays missing well after it. Not run by verify:pr: a branch may be reviewed
// before its media are uploaded.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { APP_MEDIA, APP_RECEIPT, missingFromAppReceipt, verifyAppLocal } = require('./lib/app-media');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('every app media object is published and read back from the CDN', () => {
  verifyAppLocal(ROOT);
  const missing = missingFromAppReceipt(ROOT);
  assert.deepEqual(missing, [], `${missing.length} keys of ${APP_MEDIA} are not in ${APP_RECEIPT}. ` +
    'Run `NOCTALIA_MEDIA_CREDENTIALS=<private file> mise exec -- npm run docs:media -- app-upload`, ' +
    'then `mise exec -- npm run docs:media -- app-verify`, and commit the receipt.');
});
