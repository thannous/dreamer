'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  analyzeMaestroFlowsForBasePhysical,
  assertBasePhysicalMaestroGuard,
  assertReleaseTi429StaysOnBase,
  isPhysicalAndroidDevice,
  shouldGuardBasePhysicalSelection,
} = require('./maestro-base-physical-guard');
const { parseArgs, PRODUCTION_ANDROID_APP_ID } = require('../run-maestro-android');

const BASE = 'com.tanuki75.noctalia';
const REPO_ROOT = path.join(__dirname, '../..');

function writeFlow(root, relative, contents) {
  const absolute = path.join(root, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, contents);
  return relative;
}

describe('maestro-base-physical-guard', () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-base-guard-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('treats Wi-Fi adb serials as physical and emulator serials as not', () => {
    expect(isPhysicalAndroidDevice('emulator-5554')).toBe(false);
    expect(isPhysicalAndroidDevice('ZY3225Q2D5')).toBe(true);
    expect(isPhysicalAndroidDevice('192.168.1.12:5555')).toBe(true);
  });

  it('guards only a physical device with the base identity', () => {
    const base = { appId: BASE, suite: 'release-ti429', lockOwner: 'dreamer' };
    expect(shouldGuardBasePhysicalSelection(base, ['ZY3225Q2D5'])).toBe(true);
    expect(shouldGuardBasePhysicalSelection(base, ['emulator-5554'])).toBe(false);
    expect(shouldGuardBasePhysicalSelection({ ...base, appId: 'com.tanuki75.noctalia.qa' }, ['ZY3225Q2D5'])).toBe(true);
    expect(shouldGuardBasePhysicalSelection({
      appId: BASE,
      suite: 'release-ti429',
      lockOwner: 'lucid',
    }, ['motorola'])).toBe(true);
    expect(shouldGuardBasePhysicalSelection({
      appId: 'com.tanuki75.noctalia.lucid',
      suite: 'lucid',
      lockOwner: 'lucid',
    }, ['ZY3225Q2D5'])).toBe(true);
    expect(shouldGuardBasePhysicalSelection({
      appId: 'com.tanuki75.noctalia.meditation',
      lockOwner: 'meditation',
    }, ['ZY3225Q2D5'])).toBe(true);
    expect(shouldGuardBasePhysicalSelection({
      appId: 'com.tanuki75.noctalia.lucid',
      suite: 'lucid',
      lockOwner: 'lucid',
    }, ['simulated-physical-serial'])).toBe(true);
  });

  it('refuses a direct clearState, including flow-style maps and quoted keys', () => {
    writeFlow(root, 'direct.yml', '- launchApp: {clearState: true}\n');
    writeFlow(root, 'quoted.yml', '- launchApp:\n    "clearState": true\n');
    expect(analyzeMaestroFlowsForBasePhysical(['direct.yml'], { rootDir: root }).join('\n'))
      .toMatch(/clearState is destructive/);
    expect(analyzeMaestroFlowsForBasePhysical(['quoted.yml'], { rootDir: root }).join('\n'))
      .toMatch(/clearState is destructive/);
  });

  it('refuses nested, conditional, and hook destructive commands', () => {
    writeFlow(root, 'nested.yml', [
      'onFlowStart:',
      '  - launchApp:',
      '      clearKeychain: true',
      '---',
      '- runFlow:',
      '    when:',
      '      visible: Home',
      '    commands:',
      '      - uninstallApp',
      '',
    ].join('\n'));
    const issues = analyzeMaestroFlowsForBasePhysical(['nested.yml'], { rootDir: root }).join('\n');
    expect(issues).toMatch(/clearKeychain is destructive/);
    expect(issues).toMatch(/uninstallApp is destructive/);
  });

  it('refuses scalar destructive and unanalyzable commands in a sequence', () => {
    writeFlow(root, 'scalar.yml', [
      '- clearState',
      '- clearKeychain',
      '- uninstallApp',
      '- runScript',
      '- evalScript',
      '',
    ].join('\n'));
    const issues = analyzeMaestroFlowsForBasePhysical(['scalar.yml'], { rootDir: root }).join('\n');
    expect(issues).toMatch(/clearState is destructive/);
    expect(issues).toMatch(/clearKeychain is destructive/);
    expect(issues).toMatch(/uninstallApp is destructive/);
    expect(issues).toMatch(/runScript cannot be analyzed/);
    expect(issues).toMatch(/evalScript cannot be analyzed/);
  });

  it('allows launchApp clearState/clearKeychain false but still refuses those commands even when false', () => {
    writeFlow(root, 'launch-false.yml', '- launchApp:\n    clearState: false\n    clearKeychain: false\n');
    writeFlow(root, 'command-false.yml', '- clearState: false\n- clearKeychain: false\n- uninstallApp: false\n');
    expect(analyzeMaestroFlowsForBasePhysical(['launch-false.yml'], { rootDir: root })).toEqual([]);
    const issues = analyzeMaestroFlowsForBasePhysical(['command-false.yml'], { rootDir: root }).join('\n');
    expect(issues).toMatch(/clearState is destructive/);
    expect(issues).toMatch(/clearKeychain is destructive/);
    expect(issues).toMatch(/uninstallApp is destructive/);
  });

  it('refuses a nested runFlow that clears state', () => {
    writeFlow(root, 'child.yml', '- launchApp:\n    clearState: true\n');
    writeFlow(root, 'parent.yml', '- runFlow: child.yml\n');
    expect(analyzeMaestroFlowsForBasePhysical(['parent.yml'], { rootDir: root }).join('\n'))
      .toMatch(/child.yml:.*clearState is destructive/);
  });

  it('refuses missing, dynamic, and unresolvable runFlow targets without executing them', () => {
    writeFlow(root, 'missing.yml', '- runFlow: no-such.yml\n');
    writeFlow(root, 'dynamic.yml', '- runFlow: ${FLOW}\n');
    writeFlow(root, 'file-dynamic.yml', '- runFlow:\n    file: ${FLOW}\n');
    expect(analyzeMaestroFlowsForBasePhysical(['missing.yml'], { rootDir: root }).join('\n'))
      .toMatch(/missing Maestro flow/);
    expect(analyzeMaestroFlowsForBasePhysical(['dynamic.yml'], { rootDir: root }).join('\n'))
      .toMatch(/dynamic-or-empty-runFlow/);
    expect(analyzeMaestroFlowsForBasePhysical(['file-dynamic.yml'], { rootDir: root }).join('\n'))
      .toMatch(/dynamic-or-empty-runFlow/);
  });

  it('refuses runScript and evalScript instead of executing them', () => {
    writeFlow(root, 'script.yml', '- runScript: helper.js\n- evalScript: ${output.x = 1}\n');
    const issues = analyzeMaestroFlowsForBasePhysical(['script.yml'], { rootDir: root }).join('\n');
    expect(issues).toMatch(/runScript cannot be analyzed/);
    expect(issues).toMatch(/evalScript cannot be analyzed/);
  });

  it('allows a statically non-destructive flow that preserves data', () => {
    writeFlow(root, 'safe.yml', [
      'appId: com.tanuki75.noctalia',
      '---',
      '- launchApp',
      '- runFlow:',
      '    when:',
      '      visible: Home',
      '    commands:',
      '      - tapOn: Home',
      '',
    ].join('\n'));
    expect(analyzeMaestroFlowsForBasePhysical(['safe.yml'], { rootDir: root })).toEqual([]);
    expect(assertBasePhysicalMaestroGuard({
      options: { appId: BASE, suite: 'release-ti429', lockOwner: 'dreamer' },
      devices: ['ZY3225Q2D5'],
      flows: ['safe.yml'],
      rootDir: root,
    })).toEqual({ guarded: true, issues: [] });
  });

  it('does not inspect flows when the selection is not a physical base device', () => {
    writeFlow(root, 'destructive.yml', '- launchApp: {clearState: true}\n');
    expect(assertBasePhysicalMaestroGuard({
      options: { appId: BASE, suite: 'core', lockOwner: 'dreamer' },
      devices: ['emulator-5554'],
      flows: ['destructive.yml'],
      rootDir: root,
    })).toEqual({ guarded: false, issues: [] });
  });

  it('inspects YAML even when CLI appId is a companion identity', () => {
    writeFlow(root, 'base.yml', [
      'appId: com.tanuki75.noctalia',
      '---',
      '- launchApp:',
      '    clearState: true',
      '',
    ].join('\n'));
    expect(() => assertBasePhysicalMaestroGuard({
      options: {
        appId: 'com.tanuki75.noctalia.lucid',
        suite: 'lucid',
        lockOwner: 'lucid',
      },
      devices: ['simulated-physical-serial'],
      flows: ['base.yml'],
      rootDir: root,
    })).toThrow(/clearState is destructive/);
  });

  it('throws an explicit refusal before any caller can run device effects', () => {
    writeFlow(root, 'destructive.yml', '- launchApp: {clearState: true}\n');
    expect(() => assertBasePhysicalMaestroGuard({
      options: { appId: BASE, suite: 'release-ti429', lockOwner: 'dreamer' },
      devices: ['ZY3225Q2D5'],
      flows: ['destructive.yml'],
      rootDir: root,
    })).toThrow(/Refusing Maestro execution on a physical device with the base app identity/);
    expect(() => assertBasePhysicalMaestroGuard({
      options: { appId: BASE, suite: 'release-ti429', lockOwner: 'dreamer' },
      devices: ['ZY3225Q2D5'],
      flows: ['destructive.yml'],
      rootDir: root,
    })).not.toThrow(/\.qa/);
  });

  it('refuses release-ti429 QA retargeting while leaving other Release suites compatible', () => {
    expect(() => assertReleaseTi429StaysOnBase({
      suite: 'release-ti429',
      sideBySideQa: true,
      appId: 'com.tanuki75.noctalia.qa',
    })).toThrow(/must target the base app/);
    expect(() => assertReleaseTi429StaysOnBase({
      suite: 'release',
      sideBySideQa: true,
      appId: 'com.tanuki75.noctalia.qa',
    })).not.toThrow();
  });

  it('lets parseArgs lucid flows clear Lucid state on a physical device', () => {
    const options = parseArgs(['--suite', 'lucid', '--no-start-metro']);
    expect(options.appId).toBe(PRODUCTION_ANDROID_APP_ID);
    expect(assertBasePhysicalMaestroGuard({
      options,
      devices: ['ZY3225Q2D5'],
      flows: ['maestro/lucid-smoke.yml'],
      rootDir: REPO_ROOT,
    })).toEqual({ guarded: true, issues: [] });
  });

  it('still refuses a base flow even when --lock-owner is lucid', () => {
    writeFlow(root, 'base.yml', 'appId: com.tanuki75.noctalia\n---\n- launchApp:\n    clearState: true\n');
    expect(() => assertBasePhysicalMaestroGuard({
      options: {
        appId: BASE,
        suite: 'release-ti429',
        lockOwner: 'lucid',
      },
      devices: ['motorola'],
      flows: ['base.yml'],
      rootDir: root,
    })).toThrow(/clearState is destructive/);
  });

  it('refuses a companion flow that later targets the base app', () => {
    writeFlow(root, 'child.yml', 'appId: com.tanuki75.noctalia\n---\n- launchApp:\n    clearState: true\n');
    writeFlow(root, 'parent.yml', 'appId: com.tanuki75.noctalia.lucid\n---\n- runFlow: child.yml\n');
    expect(analyzeMaestroFlowsForBasePhysical(['parent.yml'], { rootDir: root }).join('\n'))
      .toMatch(/child.yml:.*clearState is destructive/);
  });

  it('refuses a runFlow file cycle instead of treating it as already visited', () => {
    writeFlow(root, 'a.yml', '- runFlow: b.yml\n');
    writeFlow(root, 'b.yml', '- runFlow: a.yml\n');
    expect(analyzeMaestroFlowsForBasePhysical(['a.yml'], { rootDir: root }).join('\n'))
      .toMatch(/runFlow cycle is unanalyzable/);
  });

  it('refuses a companion flow whose launchApp overrides to the base package', () => {
    writeFlow(root, 'override.yml', [
      'appId: com.tanuki75.noctalia.lucid',
      '---',
      '- launchApp:',
      '    appId: com.tanuki75.noctalia',
      '    clearState: true',
      '',
    ].join('\n'));
    expect(analyzeMaestroFlowsForBasePhysical(['override.yml'], { rootDir: root }).join('\n'))
      .toMatch(/clearState is destructive/);
  });

  it('refuses scalar and map clearState targeting base inside a companion flow', () => {
    writeFlow(root, 'scalar-base.yml', [
      'appId: com.tanuki75.noctalia.lucid',
      '---',
      '- clearState: com.tanuki75.noctalia',
      '',
    ].join('\n'));
    writeFlow(root, 'map-base.yml', [
      'appId: com.tanuki75.noctalia.lucid',
      '---',
      '- clearState:',
      '    appId: com.tanuki75.noctalia',
      '',
    ].join('\n'));
    writeFlow(root, 'package-base.yml', [
      'appId: com.tanuki75.noctalia.lucid',
      '---',
      '- uninstallApp:',
      '    packageName: com.tanuki75.noctalia',
      '',
    ].join('\n'));
    expect(analyzeMaestroFlowsForBasePhysical(['scalar-base.yml'], { rootDir: root }).join('\n'))
      .toMatch(/clearState is destructive/);
    expect(analyzeMaestroFlowsForBasePhysical(['map-base.yml'], { rootDir: root }).join('\n'))
      .toMatch(/clearState is destructive/);
    expect(analyzeMaestroFlowsForBasePhysical(['package-base.yml'], { rootDir: root }).join('\n'))
      .toMatch(/uninstallApp is destructive/);
  });

  it('refuses launchApp nested map/scalar clearState targeting base', () => {
    writeFlow(root, 'nested-map.yml', [
      'appId: com.tanuki75.noctalia.lucid',
      '---',
      '- launchApp:',
      '    clearState:',
      '      appId: com.tanuki75.noctalia',
      '',
    ].join('\n'));
    writeFlow(root, 'nested-scalar.yml', [
      'appId: com.tanuki75.noctalia.lucid',
      '---',
      '- launchApp:',
      '    clearState: com.tanuki75.noctalia',
      '',
    ].join('\n'));
    expect(analyzeMaestroFlowsForBasePhysical(['nested-map.yml'], { rootDir: root }).join('\n'))
      .toMatch(/clearState is destructive/);
    expect(analyzeMaestroFlowsForBasePhysical(['nested-scalar.yml'], { rootDir: root }).join('\n'))
      .toMatch(/clearState is destructive/);
  });

  it('allows companion-targeted destructive commands but refuses unanalyzable scripts there', () => {
    writeFlow(root, 'companion-ok.yml', [
      'appId: com.tanuki75.noctalia.lucid',
      '---',
      '- launchApp:',
      '    clearState: true',
      '- clearState: com.tanuki75.noctalia.lucid',
      '- clearState:',
      '    appId: com.tanuki75.noctalia.lucid',
      '',
    ].join('\n'));
    writeFlow(root, 'companion-script.yml', [
      'appId: com.tanuki75.noctalia.lucid',
      '---',
      '- runScript: helper.js',
      '- evalScript: ${output.x = 1}',
      '',
    ].join('\n'));
    expect(analyzeMaestroFlowsForBasePhysical(['companion-ok.yml'], { rootDir: root })).toEqual([]);
    const issues = analyzeMaestroFlowsForBasePhysical(['companion-script.yml'], { rootDir: root }).join('\n');
    expect(issues).toMatch(/runScript cannot be analyzed/);
    expect(issues).toMatch(/evalScript cannot be analyzed/);
  });

  it.each([
    '- launchApp: { appId: null, clearState: true }',
    '- launchApp: { url: null, clearState: true }',
    '- clearState: { appId: null }',
  ])('resolves null command targets to the protected file identity: %s', (command) => {
    writeFlow(root, 'base.yml', `appId: ${BASE}\n---\n${command}\n`);
    writeFlow(root, 'unknown.yml', `${command}\n`);
    for (const flow of ['base.yml', 'unknown.yml']) {
      expect(analyzeMaestroFlowsForBasePhysical([flow], { rootDir: root }).join('\n'))
        .toMatch(/clearState is destructive/);
    }
  });

  it.each([
    `packageName: com.tanuki75.noctalia.lucid\nappId: ${BASE}`,
    `appId: ${BASE}\npackageName: com.tanuki75.noctalia.lucid`,
    `url: ${BASE}`,
    `_appId: ${BASE}`,
    `appId: ${BASE}\nurl: null`,
    `appId: com.tanuki75.noctalia.lucid\nurl: ${BASE}`,
    `url: com.tanuki75.noctalia.lucid\nappId: ${BASE}`,
    `appId: com.tanuki75.noctalia.lucid\n_appId: ${BASE}`,
    'packageName: com.tanuki75.noctalia.lucid',
    'url: https://example.com',
    'appId: invalid-package',
  ])('does not let root aliases or unknown fields hide a protected target: %s', (header) => {
    writeFlow(root, 'root.yml', `${header}\n---\n- clearState\n`);
    expect(analyzeMaestroFlowsForBasePhysical(['root.yml'], { rootDir: root }).join('\n'))
      .toMatch(/clearState is destructive/);
  });

  it.each([
    `- launchApp: { url: ${BASE}, clearState: true }`,
    `- launchApp: { appId: com.tanuki75.noctalia.lucid, url: ${BASE}, clearState: true }`,
    `- launchApp: { url: ${BASE}, appId: com.tanuki75.noctalia.lucid, clearState: true }`,
    '- launchApp: { appId: null, url: com.tanuki75.noctalia.lucid, clearState: true }',
    `- clearState: { packageName: com.tanuki75.noctalia.lucid, appId: ${BASE} }`,
    '- clearState: { url: com.tanuki75.noctalia.lucid }',
    '- launchApp: { clearState: { appId: com.tanuki75.noctalia.lucid } }',
    '- launchApp: { clearState: com.tanuki75.noctalia.lucid }',
  ])('uses command-specific target keys and fails closed on ambiguity: %s', (command) => {
    writeFlow(root, 'command.yml', `appId: ${BASE}\n---\n${command}\n`);
    expect(analyzeMaestroFlowsForBasePhysical(['command.yml'], { rootDir: root }).join('\n'))
      .toMatch(/clearState is destructive/);
  });

  it.each([
    'appId: com.tanuki75.noctalia.lucid',
    'url: com.tanuki75.noctalia.lucid',
    '_appId: com.tanuki75.noctalia.lucid',
    'appId: com.tanuki75.noctalia.lucid\nurl: null',
  ])('preserves genuine companion flows with nullable inherited targets: %s', (header) => {
    writeFlow(root, 'companion.yml', `${header}\n---\n- launchApp: { appId: null, clearState: true }\n- clearState: { appId: null }\n`);
    expect(analyzeMaestroFlowsForBasePhysical(['companion.yml'], { rootDir: root })).toEqual([]);
  });

  it('allows an explicit companion launch url without mistaking it for the file identity', () => {
    writeFlow(root, 'companion.yml', `appId: ${BASE}\n---\n- launchApp: { url: com.tanuki75.noctalia.lucid, clearState: true }\n`);
    expect(analyzeMaestroFlowsForBasePhysical(['companion.yml'], { rootDir: root })).toEqual([]);
  });

  it('inspects destructive retry files and inline retry commands', () => {
    writeFlow(root, 'child.yml', `appId: ${BASE}\n---\n- clearState\n`);
    writeFlow(root, 'retry.yml', 'appId: com.tanuki75.noctalia.lucid\n---\n- retry: { maxRetries: 2, file: child.yml }\n');
    writeFlow(root, 'inline.yml', `appId: ${BASE}\n---\n- retry:\n    maxRetries: 2\n    commands:\n      - clearState\n`);
    expect(analyzeMaestroFlowsForBasePhysical(['retry.yml'], { rootDir: root }).join('\n'))
      .toMatch(/child.yml:.*clearState is destructive/);
    expect(analyzeMaestroFlowsForBasePhysical(['inline.yml'], { rootDir: root }).join('\n'))
      .toMatch(/clearState is destructive/);
  });

  it.each([
    ['{ maxRetries: 2, file: missing.yml }', /missing Maestro flow/],
    ['{ maxRetries: 2, file: "${FLOW}" }', /dynamic-or-empty/],
    ['{ maxRetries: 2, file: null }', /dynamic-or-empty/],
    ['{ maxRetries: 2 }', /target is missing/],
    ['{ maxRetries: 2, file: ../outside.yml }', /external-or-dynamic/],
    ['{ maxRetries: 2, file: retry.yml }', /cycle is unanalyzable/],
  ])('refuses unresolvable retry targets: %s', (retry, error) => {
    writeFlow(root, 'retry.yml', `appId: ${BASE}\n---\n- retry: ${retry}\n`);
    expect(analyzeMaestroFlowsForBasePhysical(['retry.yml'], { rootDir: root }).join('\n')).toMatch(error);
  });

  it('allows non-destructive retry files and inline commands', () => {
    writeFlow(root, 'child.yml', `appId: ${BASE}\n---\n- assertVisible: Home\n`);
    writeFlow(root, 'retry.yml', `appId: ${BASE}\n---\n- retry: { maxRetries: 2, file: child.yml }\n- retry:\n    maxRetries: 2\n    commands:\n      - assertVisible: Home\n`);
    expect(analyzeMaestroFlowsForBasePhysical(['retry.yml'], { rootDir: root })).toEqual([]);
  });

  it.each([
    '- runFlow: "child.yml "',
    '- runFlow: { file: "child.yml " }',
    '- retry: { maxRetries: 2, file: "child.yml " }',
  ])('inspects the exact quoted file name without trimming: %s', (command) => {
    writeFlow(root, 'child.yml', `appId: ${BASE}\n---\n- assertVisible: Home\n`);
    writeFlow(root, 'child.yml ', `appId: ${BASE}\n---\n- clearState\n`);
    writeFlow(root, 'parent.yml', `appId: ${BASE}\n---\n${command}\n`);
    expect(analyzeMaestroFlowsForBasePhysical(['parent.yml'], { rootDir: root }).join('\n'))
      .toMatch(/child.yml :.*clearState is destructive/);
  });

  it('does not substitute an existing trimmed name for a missing exact file', () => {
    writeFlow(root, 'child.yml', `appId: ${BASE}\n---\n- assertVisible: Home\n`);
    writeFlow(root, 'parent.yml', `appId: ${BASE}\n---\n- runFlow: "child.yml "\n`);
    expect(analyzeMaestroFlowsForBasePhysical(['parent.yml'], { rootDir: root }).join('\n'))
      .toMatch(/missing Maestro flow/);
  });

  it('refuses symlinked flows whose lexical sibling differs from the realpath sibling', () => {
    writeFlow(root, 'actual/entry.yml', `appId: ${BASE}\n---\n- runFlow: child.yml\n`);
    writeFlow(root, 'actual/child.yml', `appId: ${BASE}\n---\n- assertVisible: Home\n`);
    writeFlow(root, 'links/child.yml', `appId: ${BASE}\n---\n- clearState\n`);
    fs.symlinkSync('../actual/entry.yml', path.join(root, 'links/entry.yml'));
    writeFlow(root, 'parent.yml', `appId: ${BASE}\n---\n- retry: { file: links/entry.yml }\n`);
    expect(analyzeMaestroFlowsForBasePhysical(['links/entry.yml'], { rootDir: root }).join('\n'))
      .toMatch(/symlink/);
    expect(analyzeMaestroFlowsForBasePhysical(['parent.yml'], { rootDir: root })).not.toEqual([]);
  });

  it('refuses directory symlinks inside the repository', () => {
    writeFlow(root, 'actual/entry.yml', `appId: ${BASE}\n---\n- assertVisible: Home\n`);
    fs.symlinkSync('actual', path.join(root, 'links'));
    expect(analyzeMaestroFlowsForBasePhysical(['links/entry.yml'], { rootDir: root }).join('\n'))
      .toMatch(/symlink/);
  });

  it('allows a symlink alias of the repository root with safe nested flows', () => {
    const realRoot = path.join(root, 'actual');
    writeFlow(realRoot, 'child.yml', `appId: ${BASE}\n---\n- assertVisible: Home\n`);
    writeFlow(realRoot, 'parent.yml', `appId: ${BASE}\n---\n- runFlow: child.yml\n`);
    const rootAlias = path.join(root, 'alias');
    fs.symlinkSync('actual', rootAlias);
    expect(analyzeMaestroFlowsForBasePhysical(['parent.yml'], { rootDir: rootAlias })).toEqual([]);
    expect(analyzeMaestroFlowsForBasePhysical([path.join(realRoot, 'parent.yml')], { rootDir: rootAlias })).toEqual([]);
  });

  it.each(['scalar', 'map', 'retry'])('refuses absolute non-normalized %s targets before resolving symlinks', (kind) => {
    writeFlow(root, 'child.yml', `appId: ${BASE}\n---\n- assertVisible: Home\n`);
    writeFlow(root, 'actual/child.yml', `appId: ${BASE}\n---\n- clearState\n`);
    fs.mkdirSync(path.join(root, 'actual/deep'));
    fs.symlinkSync('actual/deep', path.join(root, 'links'));
    // Do not use path.join: it would remove the very /../ under test.
    const target = JSON.stringify(`${root}/links/../child.yml`);
    const command = kind === 'scalar' ? `- runFlow: ${target}`
      : kind === 'map' ? `- runFlow: { file: ${target} }`
        : `- retry: { maxRetries: 2, file: ${target} }`;
    writeFlow(root, 'parent.yml', `appId: ${BASE}\n---\n${command}\n`);
    expect(analyzeMaestroFlowsForBasePhysical(['parent.yml'], { rootDir: root }).join('\n'))
      .toMatch(/non-normalized absolute flow path/);
  });

  it('keeps normalized absolute and relative parent references compatible', () => {
    writeFlow(root, 'child.yml', `appId: ${BASE}\n---\n- assertVisible: Home\n`);
    writeFlow(root, 'nested/parent.yml', `appId: ${BASE}\n---\n- runFlow: ../child.yml\n- retry: { file: ${JSON.stringify(path.join(root, 'child.yml'))} }\n`);
    expect(analyzeMaestroFlowsForBasePhysical(['nested/parent.yml'], { rootDir: root })).toEqual([]);
  });
});
