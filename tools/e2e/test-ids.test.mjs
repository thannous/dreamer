// A journey finds its controls by test ID, written as a string. When the app renames or
// drops an ID, the journey only fails minutes into a run, and only when that run is launched.
// This test reads the sources instead: every literal ID a journey asks for, directly or
// through one of its helpers, must still be written in the app, or be composed there from
// a template. A registry entry (`TID.Button.SaveDream`) counts only while the app uses it.
//
// Limits: it reads text, not JSX. Every string literal in the app sources counts as written,
// not only test IDs, so an ID that survives as another string (a key, a route) still passes.
// IDs listed in an array and unpacked in a loop are not collected, and a helper called as a
// method (`fixtures.tap(id)`) is not followed. An ID composed after a variable
// (`${testID}.option.${value}`) is checked up to the next variable, not beyond.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

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

// The ID registries, and the sources whose `TID.…` each one resolves: Meditation has its own.
const MEDITATION = 'apps/meditation/';
const REGISTRIES = [
  { file: 'lib/testIDs.ts', reads: file => !file.startsWith(MEDITATION) },
  { file: `${MEDITATION}lib/testIDs.ts`, reads: file => file.startsWith(MEDITATION) },
];

// IDs the app does not write: the operating system's own controls.
const OUTSIDE_THE_APP = new Set([
  'com.android.permissioncontroller:id/permission_message',
  'com.android.permissioncontroller:id/permission_deny_button',
  'Return',
]);

const parse = (text, name = 'source.ts') => ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

function visit(node, each) {
  each(node);
  ts.forEachChild(node, child => visit(child, each));
}

/** The registry's entries: `TID.Button.SaveDream` → the text that writes its ID ('btn.saveDream', or a template). */
export function registryEntries(text) {
  const entries = new Map();
  const walk = (object, path) => {
    for (const property of object.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const key = [...path, property.name.getText()];
      if (ts.isObjectLiteralExpression(property.initializer)) walk(property.initializer, key);
      else entries.set(key.join('.'), property.initializer.getText());
    }
  };
  visit(parse(text), node => {
    if (!ts.isVariableDeclaration(node) || node.name.getText() !== 'TID') return;
    let value = node.initializer;
    while (value && (ts.isAsExpression(value) || ts.isSatisfiesExpression(value))) value = value.expression;
    if (value && ts.isObjectLiteralExpression(value)) walk(value, ['TID']);
  });
  return entries;
}

/**
 * The text in which the app writes its IDs: its sources outside the registries, and the
 * registry entries those sources use. The app reads its registries only as `TID.Group.Key`
 * (or `TID.Group.Key(id)`): an entry nothing reads that way no longer reaches a screen.
 */
export function appText(sources, registries) {
  const outside = sources.filter(({ file }) => !registries.some(registry => registry.file === file));
  const used = registries.flatMap(({ text, reads }) => {
    const read = new Set(outside.filter(({ file }) => reads(file)).flatMap(({ text: source }) => source.match(/\bTID(?:\.\w+)+/g) ?? []));
    return [...registryEntries(text)].filter(([key]) => read.has(key)).map(([, value]) => value);
  });
  return [...outside.map(({ text }) => text), ...used].join('\n');
}

const SEPARATORS = '.-_:';

/**
 * Whether a template writes the end of `id` from `at` after a variable: `${x}-toggle` ends
 * there, or `${x}.option.${y}` goes on with another variable after a separator.
 */
function composedAfter(source, id, at) {
  const segment = id.slice(at).match(/^.[^.\-_:]*/)[0];
  if (!source.includes(`}${segment}`)) return false;
  if (source.includes(`}${id.slice(at)}\``)) return true;
  for (let end = at + 2; end < id.length; end++) {
    if (SEPARATORS.includes(id[end - 1]) && source.includes(`}${id.slice(at, end)}\${`)) return true;
  }
  return false;
}

/** Whether `source` writes `id` in full, or builds it from a template or a concatenation. */
export function sourceWrites(source, id) {
  if ([`'${id}'`, `"${id}"`, `\`${id}\``].some(quoted => source.includes(quoted))) return true;
  for (let at = 1; at < id.length; at++) {
    if (!SEPARATORS.includes(id[at])) continue;
    const head = id.slice(0, at + 1);
    // `prefix.${x}` or 'prefix.' + x.
    if (source.includes(`\`${head}\${`) || source.includes(`'${head}' +`) || source.includes(`"${head}" +`)) return true;
    // `${x}.suffix`: only on a base the app writes itself, or `${x}-toggle` would vouch for
    // every ID ending in `-toggle` once any control composes one.
    if (composedAfter(source, id, at) && sourceWrites(source, id.slice(0, at))) return true;
  }
  return false;
}

const calledName = call => ts.isIdentifier(call.expression) ? call.expression.text
  : ts.isPropertyAccessExpression(call.expression) ? call.expression.name.text : undefined;

/** The strings an argument can be: 'id', `id`, or a choice between them. */
function literals(node) {
  if (ts.isStringLiteralLike(node)) return [node.text];
  if (ts.isParenthesizedExpression(node)) return literals(node.expression);
  if (ts.isConditionalExpression(node)) return [...literals(node.whenTrue), ...literals(node.whenFalse)];
  return [];
}

function bindsName(binding, name) {
  if (ts.isIdentifier(binding)) return binding.text === name;
  return binding.elements.some(element => !ts.isOmittedExpression(element) && bindsName(element.name, name));
}

function declaresName(node, name) {
  const list = ts.isForOfStatement(node) || ts.isForInStatement(node) || ts.isForStatement(node) ? node.initializer : undefined;
  if (list && ts.isVariableDeclarationList(list)) return list.declarations.some(declaration => bindsName(declaration.name, name));
  if (!ts.isBlock(node) && !ts.isSourceFile(node)) return false;
  return node.statements.some(statement => ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => bindsName(declaration.name, name)));
}

function functionName(fn) {
  if (fn.name && ts.isIdentifier(fn.name)) return fn.name.text;
  const { parent } = fn;
  if ((ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent)) && ts.isIdentifier(parent.name)) return parent.name.text;
  return undefined;
}

/** The named function and the position of the parameter that `identifier` reads, if it reads one. */
function parameterOf(identifier) {
  for (let node = identifier.parent; node; node = node.parent) {
    if (ts.isFunctionLike(node)) {
      const at = node.parameters.findIndex(parameter => bindsName(parameter.name, identifier.text));
      // A destructured parameter is not the ID itself.
      if (at >= 0) return ts.isIdentifier(node.parameters[at].name) ? { name: functionName(node), at } : undefined;
    } else if (declaresName(node, identifier.text)) return undefined;
  }
  return undefined;
}

/** Only asserted absent: `expect(getByTestId(id)).toHaveCount(0)`, an ID that may be gone on purpose. */
function assertedAbsent(call) {
  const expectation = call.parent;
  if (!ts.isCallExpression(expectation) || calledName(expectation) !== 'expect' || expectation.arguments[0] !== call) return false;
  const matcher = expectation.parent;
  if (!ts.isPropertyAccessExpression(matcher) || matcher.name.text !== 'toHaveCount') return false;
  const count = matcher.parent;
  return ts.isCallExpression(count) && count.arguments.length === 1 && count.arguments[0].getText() === '0';
}

/** Where a relative import of `file` points among the journeys, if it points to one. */
function moduleAt(file, specifier, journeys) {
  if (!specifier.startsWith('.')) return undefined;
  const base = join(dirname(file), specifier);
  return [base, `${base}.ts`, join(base, 'index.ts')].find(candidate => journeys.has(candidate));
}

/** Each journey file parsed once: its calls, the functions it names, and the names it imports or re-exports. */
function readJourneys(sources) {
  const journeys = new Map(sources.map(({ file, text }) => [file, { ast: parse(text, file), calls: [], defines: new Set(), links: new Map() }]));
  for (const [file, journey] of journeys) {
    visit(journey.ast, node => {
      if (ts.isCallExpression(node)) journey.calls.push(node);
      if (ts.isFunctionLike(node) && functionName(node)) journey.defines.add(functionName(node));
      const named = ts.isImportDeclaration(node) ? node.importClause?.namedBindings : ts.isExportDeclaration(node) ? node.exportClause : undefined;
      const from = named && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? moduleAt(file, node.moduleSpecifier.text, journeys) : undefined;
      if (from && (ts.isNamedImports(named) || ts.isNamedExports(named))) {
        for (const element of named.elements) journey.links.set(element.name.text, { from, name: (element.propertyName ?? element.name).text });
      }
    });
  }
  return journeys;
}

/** The function a name called in `file` stands for: one the file defines, or one it imports. */
function definition(journeys, file, name, seen = new Set()) {
  const key = `${file}#${name}`;
  if (journeys.get(file)?.defines.has(name)) return key;
  const link = journeys.get(file)?.links.get(name);
  if (!link || seen.has(key)) return undefined;
  return definition(journeys, link.from, link.name, seen.add(key));
}

/**
 * The helpers that hand one of their parameters to `getByTestId`, directly or through another
 * such helper: `file#name` → the positions of those parameters. Read from the journeys' own
 * code, so a new helper is covered without a list to keep. A name resolves in the file that
 * calls it, so another file's unrelated `box(selector)` is not taken for a helper `box(id)`.
 */
function testIdHelpers(journeys) {
  const helpers = new Map();
  for (let grew = true; grew;) {
    grew = false;
    for (const [file, { calls }] of journeys) {
      for (const call of calls) {
        for (const at of positions(journeys, helpers, file, call)) {
          const argument = call.arguments[at];
          const parameter = argument && ts.isIdentifier(argument) ? parameterOf(argument) : undefined;
          if (!parameter?.name) continue;
          const key = `${file}#${parameter.name}`;
          if (!helpers.has(key)) helpers.set(key, new Set());
          if (helpers.get(key).has(parameter.at)) continue;
          helpers.get(key).add(parameter.at);
          grew = true;
        }
      }
    }
  }
  return helpers;
}

/** The positions at which `call` takes a test ID: `getByTestId`'s first, or a helper's. */
function positions(journeys, helpers, file, call) {
  if (calledName(call) === 'getByTestId') return [0];
  if (!ts.isIdentifier(call.expression)) return [];
  return [...helpers.get(definition(journeys, file, call.expression.text)) ?? []];
}

/** The literal IDs that journeys expect to find, themselves or through a helper, as [id, file] in reading order. */
export function askedTestIds(sources) {
  const journeys = readJourneys(sources);
  const helpers = testIdHelpers(journeys);
  return [...journeys].flatMap(([file, { calls }]) => calls
    .filter(call => calledName(call) !== 'getByTestId' || !assertedAbsent(call))
    .flatMap(call => positions(journeys, helpers, file, call).flatMap(at => call.arguments[at] ? literals(call.arguments[at]) : []))
    .map(id => [id, file]));
}

/** The literal IDs one journey `text` expects to find. */
export const expectedTestIds = text => askedTestIds([{ file: 'journey.ts', text }]).map(([id]) => id);

/** Every such ID of the journeys and their fixtures, with the files that ask for it. */
export function journeyTestIds() {
  const sources = [...files(join(here, 'tests'), name => name.endsWith('.ts')), ...readdirSync(here).filter(name => name.endsWith('.ts')).map(name => join(here, name))]
    .map(file => ({ file, text: readFileSync(file, 'utf8') }));
  const asked = new Map();
  for (const [id, file] of askedTestIds(sources)) {
    if (!asked.has(id)) asked.set(id, []);
    asked.get(id).push(relative(root, file));
  }
  return asked;
}

test('a composed or renamed test ID is told apart from one the source writes', () => {
  const source = "testID='btn.save' testID='btn.paywall.selectAnnual' testID={`${testID}.price`} testID={`dream.item.${id}`}";
  assert.equal(sourceWrites(source, 'btn.save'), true);
  assert.equal(sourceWrites(source, 'btn.paywall.selectAnnual.price'), true);
  assert.equal(sourceWrites(source, 'dream.item.42'), true);
  assert.equal(sourceWrites(source, 'btn.saveDream'), false);
  assert.equal(sourceWrites(source, 'screen.journal'), false);
});

test('an ID composed after a variable needs a base the app writes, and the rest of the template', () => {
  const source = [
    "<Disclosure testID='sleep-timer' /> <Pressable testID={`${testID}-toggle`} />",
    "<Choice testID='settings-choice' /> <Option testID={`${testID}.option.${option.value}`} />",
  ].join('\n');
  assert.equal(sourceWrites(source, 'sleep-timer-toggle'), true);
  assert.equal(sourceWrites(source, 'sleep-playback-toggle'), false, 'the app writes `-toggle` after a variable, but never `sleep-playback`');
  assert.equal(sourceWrites(source, 'sleep-timer-toggle-extra'), false, 'the template ends at `-toggle`');
  assert.equal(sourceWrites(source, 'settings-choice.option.fr'), true);
  assert.equal(sourceWrites(source, 'settings-choice.option'), false, 'the template goes on with a variable after `.option.`');
  assert.equal(sourceWrites("<Row testID={`${prefix}-timer`} /> testID='sleep' testID={`${testID}-sheet`}", 'sleep-timer-sheet'), true,
    'a base may itself be composed');
  assert.equal(sourceWrites("<Row testID={`${prefix}-timer`} /> testID={`${testID}-sheet`}", 'sleep-timer-sheet'), false,
    'down to a base the app writes');
});

test('a registry entry the app no longer reads is not written by the app', () => {
  const registry = [
    'export const TID = {',
    "  Button: { Save: 'btn.save', Gone: 'btn.gone', Item: (id: string) => `dream.item.${id}` },",
    "  Screen: { Paywall: 'screen.paywall', Journal: 'screen.journal' },",
    '} as const;',
  ].join('\n');
  const sources = [
    { file: 'lib/testIDs.ts', text: registry },
    { file: 'app/save.tsx', text: '<Button testID={TID.Button.Save} /> {dreams.map(d => <Row testID={TID.Button.Item(d.id)} />)}' },
    { file: 'app/legacy.tsx', text: "<Text testID='screen.journal' />" },
    { file: `${MEDITATION}lib/testIDs.ts`, text: registry },
    { file: `${MEDITATION}app/paywall.tsx`, text: '<View testID={TID.Screen.Paywall} />' },
  ];
  const text = appText(sources, [
    { ...REGISTRIES[0], text: registry },
    { ...REGISTRIES[1], text: registry },
  ]);
  assert.equal(sourceWrites(text, 'btn.save'), true);
  assert.equal(sourceWrites(text, 'dream.item.42'), true);
  assert.equal(sourceWrites(text, 'screen.journal'), true, 'written as a literal outside the registry');
  assert.equal(sourceWrites(text, 'screen.paywall'), true, 'read by Meditation from its own registry');
  assert.equal(sourceWrites(text, 'btn.gone'), false, 'still defined, but no screen reads it');
  assert.equal(sourceWrites(appText(sources.slice(0, 3), [{ ...REGISTRIES[0], text: registry }]), 'screen.paywall'), false,
    "Meditation's use does not keep Dreamer's entry alive");
});

test('an ID only asserted absent is not expected in the app', () => {
  const journey = [
    "await expect(screen.getByTestId('btn.removed')).toHaveCount(0);",
    "await expect(screen.getByTestId('btn.kept', { visible: true })).toHaveCount(1);",
    "await screen.getByTestId('btn.save').tap();",
    'await screen.getByTestId(open ? "btn.close" : `btn.open`).tap();',
  ].join('\n');
  assert.deepEqual(expectedTestIds(journey), ['btn.kept', 'btn.save', 'btn.close', 'btn.open']);
});

test("an ID handed to a helper that calls getByTestId is expected, at that helper's position only", () => {
  const fixtures = [
    "export async function billingTap(screen, id: string, direction: 'up' | 'down' = 'down') {",
    '  const target = screen.getByTestId(id, { visible: true });',
    '  await screen.scrollUntilVisible(target, { direction });',
    '}',
    'export const tapAll = async (screen, first: string, ...rest) => { await billingTap(screen, first); };',
    "export async function typeInto(screen, text: string) { await screen.getByTestId('input.dream').fill(text); }",
    'export function shadowed(id: string) { for (const id of ids) screen.getByTestId(id); }',
  ].join('\n');
  const journey = [
    "import { billingTap, tapAll as tapEach, typeInto, shadowed } from '../fixtures';",
    "await billingTap(screen, 'sleep-playback-toggle', 'up');",
    "await tapEach(screen, 'btn.first');",
    "await typeInto(screen, 'a dream about the sea');",
    "shadowed('not.an.id');",
  ].join('\n');
  // Another journey's own `box` reads a CSS selector, not a test ID, whatever `box` means elsewhere.
  const site = "const box = (id: string) => document.querySelector(id); box('.atlas-rail');";
  const explorer = "const box = (id: string) => page.getByTestId(id).boundingBox(); await box('btn.explore');";
  const sources = [['fixtures.ts', fixtures], ['tests/journey.ts', journey], ['tests/site.ts', site], ['tests/explorer.ts', explorer]]
    .map(([file, text]) => ({ file: `tools/e2e/${file}`, text }));
  assert.deepEqual(askedTestIds(sources), [
    ['input.dream', 'tools/e2e/fixtures.ts'],
    ['sleep-playback-toggle', 'tools/e2e/tests/journey.ts'],
    ['btn.first', 'tools/e2e/tests/journey.ts'],
    ['btn.explore', 'tools/e2e/tests/explorer.ts'],
  ]);
});

test('every test ID a journey asks for is still written in the app', () => {
  const sources = APP_SOURCES.flatMap(dir => files(join(root, dir), isSource))
    .map(file => ({ file: relative(root, file).split('\\').join('/'), text: readFileSync(file, 'utf8') }));
  const registries = REGISTRIES.map(registry => ({ ...registry, text: readFileSync(join(root, registry.file), 'utf8') }));
  const source = appText(sources, registries);
  const asked = journeyTestIds();
  assert.ok(asked.size > 300, 'the journeys were not read');
  // Most IDs are written in full: look those up at once, and search the text only for the rest.
  const written = new Set([...source.matchAll(/['"`]([\w.:/-]+)['"`]/g)].map(([, literal]) => literal));
  const gone = [...asked].filter(([id]) => !OUTSIDE_THE_APP.has(id) && !written.has(id) && !sourceWrites(source, id))
    .map(([id, from]) => `${id} (${[...new Set(from)].join(', ')})`);
  assert.deepEqual(gone, [], 'These test IDs are no longer written in the app. Rename them in the journeys too, or restore them in the app.');
});
