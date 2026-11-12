// A journey finds its controls by test ID, written as a string. When the app renames or
// drops an ID, the journey only fails minutes into a run, and only when that run is launched.
// This test reads the sources instead: every literal ID a journey asks for must still be
// written in the app, or be composed there from a template.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const here = fileURLToPath(new URL('.', import.meta.url));

function files(dir, keep, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__' || entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files(path, keep, out);
    else if (keep(entry.name)) out.push(path);
  }
  return out;
}

// Where the three apps and the site write their test IDs.
const APP_SOURCES = ['app', 'components', 'routes', 'lib', 'hooks', 'constants', 'context', 'services', 'widgets', 'apps/meditation', 'docs-src'];
const isSource = name => /\.(tsx?|jsx?|mjs|cjs|html|njk)$/.test(name) && !/\.test\./.test(name);

// IDs the app does not write: the operating system's own controls.
const OUTSIDE_THE_APP = new Set([
  'com.android.permissioncontroller:id/permission_message',
  'com.android.permissioncontroller:id/permission_deny_button',
  'Return',
]);

/** The literal IDs of `text` that a journey expects to find: one only asserted absent (`toHaveCount(0)`) may be gone on purpose. */
export function expectedTestIds(text) {
  return [...text.matchAll(/getByTestId\(\s*'([^'$]+)'([^\n;]*)/g)]
    .filter(([, , rest]) => !/^[^)]*\)\)\.toHaveCount\(0\)/.test(rest)).map(([, id]) => id);
}

/** Every such ID of the journeys and their fixtures, with the files that ask for it. */
export function journeyTestIds() {
  const asked = new Map();
  const sources = [...files(join(here, 'tests'), name => name.endsWith('.ts')), ...readdirSync(here).filter(name => name.endsWith('.ts')).map(name => join(here, name))];
  for (const file of sources) {
    for (const id of expectedTestIds(readFileSync(file, 'utf8'))) {
      if (!asked.has(id)) asked.set(id, []);
      asked.get(id).push(relative(root, file));
    }
  }
  return asked;
}

/** Whether `source` writes `id` in full, or builds it from a template or a concatenation. */
export function sourceWrites(source, id) {
  if ([`'${id}'`, `"${id}"`, `\`${id}\``].some(quoted => source.includes(quoted))) return true;
  for (let at = 1; at < id.length; at++) {
    if (!'.-_:'.includes(id[at])) continue;
    const head = id.slice(0, at + 1);
    const tail = id.slice(at).match(/^[.\-_:][^.\-_:]*/)[0];
    // `prefix.${x}`, 'prefix.' + x, or `${x}.suffix`.
    if (source.includes(`\`${head}\${`) || source.includes(`'${head}' +`) || source.includes(`"${head}" +`) || source.includes(`}${tail}`)) return true;
  }
  return false;
}

test('a composed or renamed test ID is told apart from one the source writes', () => {
  const source = "testID='btn.save' testID={`${testID}.price`} testID={`dream.item.${id}`}";
  assert.equal(sourceWrites(source, 'btn.save'), true);
  assert.equal(sourceWrites(source, 'btn.paywall.selectAnnual.price'), true);
  assert.equal(sourceWrites(source, 'dream.item.42'), true);
  assert.equal(sourceWrites(source, 'btn.saveDream'), false);
  assert.equal(sourceWrites(source, 'screen.journal'), false);
});

test('an ID only asserted absent is not expected in the app', () => {
  const journey = [
    "await expect(screen.getByTestId('btn.removed')).toHaveCount(0);",
    "await expect(screen.getByTestId('btn.kept', { visible: true })).toHaveCount(1);",
    "await screen.getByTestId('btn.save').tap();",
  ].join('\n');
  assert.deepEqual(expectedTestIds(journey), ['btn.kept', 'btn.save']);
});

test('every test ID a journey asks for is still written in the app', () => {
  const source = APP_SOURCES.flatMap(dir => files(join(root, dir), isSource)).map(file => readFileSync(file, 'utf8')).join('\n');
  const asked = journeyTestIds();
  assert.ok(asked.size > 300, 'the journeys were not read');
  // Most IDs are written in full: look those up at once, and search the text only for the rest.
  const written = new Set([...source.matchAll(/['"`]([\w.:/-]+)['"`]/g)].map(([, literal]) => literal));
  const gone = [...asked].filter(([id]) => !OUTSIDE_THE_APP.has(id) && !written.has(id) && !sourceWrites(source, id))
    .map(([id, from]) => `${id} (${[...new Set(from)].join(', ')})`);
  assert.deepEqual(gone, [], 'These test IDs are no longer written in the app. Rename them in the journeys too, or restore them in the app.');
});
