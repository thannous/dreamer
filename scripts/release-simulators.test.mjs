import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseOptions, planSteps, chooseIosSimulator, chooseSystemImage, disableAndroidUpdates, suiteBuildEnv,
  buildCommand, runSelection, readRun, renderReport, PHONE_ONLY } from './release-simulators.mjs';
import { validateBuildCommand } from '../tools/e2e/native-release.mjs';

test('defaults test origin/master on both platforms with the three layers', () => {
  const options = parseOptions([]);
  assert.deepEqual([options.ref, options.platforms, options.suites, options.fetch, options.keep],
    ['origin/master', ['ios', 'android'], ['production', 'mock', 'backend'], true, false]);
  assert.deepEqual(parseOptions(['--platform', 'ios', '--suites', 'backend,mock', '--ref', 'abc123']).suites, ['mock', 'backend']);
  assert.throws(() => parseOptions(['--platform', 'iphone']), /--platform/);
  assert.throws(() => parseOptions(['--suites', 'store']), /--suites/);
  assert.throws(() => parseOptions(['--ref', 'master;rm -rf /']), /--ref/);
  assert.throws(() => parseOptions(['--avd', 'Pixel 9']), /--avd/);
});

test('generates each project once and runs the local backend last, one platform at a time', () => {
  const steps = planSteps({ platforms: ['ios', 'android'], suites: ['production', 'mock', 'backend'] })
    .map(step => [step.kind, step.platform, step.suite ?? step.qa].filter(value => value !== undefined).join(' '));
  assert.deepEqual(steps, [
    'prebuild ios false', 'build ios production', 'run ios production', 'build ios mock', 'run ios mock',
    'prebuild android false', 'build android production', 'run android production', 'build android mock', 'run android mock',
    'backend-start',
    'prebuild ios true', 'build ios backend', 'run ios backend', 'stop-app ios',
    'prebuild android true', 'build android backend', 'run android backend', 'stop-app android',
    'backend-stop',
  ]);
  assert.deepEqual(planSteps({ platforms: ['android'], suites: ['mock'] }).map(step => step.kind), ['prebuild', 'build', 'run']);
});

test('picks a classic iPhone on the newest runtime that has one', () => {
  const list = { runtimes: [
    { platform: 'iOS', isAvailable: true, version: '27.1', identifier: 'r271', supportedDeviceTypes: [{ name: 'iPhone Duo', productFamily: 'iPhone', identifier: 'duo' }] },
    { platform: 'iOS', isAvailable: true, version: '27.0', identifier: 'r270', supportedDeviceTypes: [{ name: 'iPhone 17 Pro', productFamily: 'iPhone', identifier: '17pro' }] },
    { platform: 'watchOS', isAvailable: true, version: '27.0', identifier: 'w', supportedDeviceTypes: [] },
  ] };
  assert.deepEqual(chooseIosSimulator(list), { runtime: 'r270', deviceType: '17pro', label: 'iPhone 17 Pro, iOS 27.0' });
  list.runtimes[1].supportedDeviceTypes = [{ name: 'iPhone 18', productFamily: 'iPhone', identifier: '18' }];
  assert.equal(chooseIosSimulator(list).deviceType, '18');
  assert.throws(() => chooseIosSimulator({ runtimes: [list.runtimes[0]] }), /NO_IOS_SIMULATOR_RUNTIME/);
});

test('picks the newest installed Google APIs image for the host architecture', () => {
  const sdk = '/Users/qa/Library/Android/sdk/system-images';
  assert.equal(chooseSystemImage([`${sdk}/android-35/google_apis/arm64-v8a`, `${sdk}/android-37/google_apis_playstore/arm64-v8a`,
    `${sdk}/android-37/google_apis/arm64-v8a`, `${sdk}/android-38/default/arm64-v8a`, `${sdk}/android-39/google_apis/x86_64`]),
  'system-images;android-37;google_apis;arm64-v8a');
  assert.throws(() => chooseSystemImage([`${sdk}/android-37/google_apis/x86_64`]), /NO_ANDROID_SYSTEM_IMAGE/);
});

test('turns off expo-updates in the generated Android manifest, whatever the attribute order', () => {
  const manifest = '<application>\n  <meta-data android:name="expo.modules.updates.ENABLED" android:value="true"/>\n'
    + '  <meta-data android:value="https://u.expo.dev/x" android:name="expo.modules.updates.EXPO_UPDATE_URL"/>\n</application>';
  const result = disableAndroidUpdates(manifest);
  assert.equal(result.found, true);
  assert.match(result.manifest, /expo\.modules\.updates\.ENABLED" android:value="false"/);
  assert.match(result.manifest, /android:value="https:\/\/u\.expo\.dev\/x"/);
  const reordered = disableAndroidUpdates('<meta-data android:value="true" android:name="expo.modules.updates.ENABLED" />');
  assert.equal(reordered.manifest, '<meta-data android:value="false" android:name="expo.modules.updates.ENABLED" />');
  assert.deepEqual(disableAndroidUpdates('<application/>'), { manifest: '<application/>', found: false });
});

test('builds each layer with the profile the guarded runner accepts', () => {
  const production = suiteBuildEnv('production', { easProduction: { EXPO_PUBLIC_API_URL: 'https://api', SHARP_IGNORE_GLOBAL_LIBVIPS: '1', EXPO_PUBLIC_MOCK_MODE: 'true' } });
  assert.equal(production.E2E_BUILD_PROFILE, 'production-apk');
  assert.equal(production.EXPO_PUBLIC_API_URL, 'https://api');
  assert.equal(production.EXPO_PUBLIC_MOCK_MODE, 'false');
  assert.equal(production.SHARP_IGNORE_GLOBAL_LIBVIPS, undefined);
  assert.deepEqual(suiteBuildEnv('mock'), { E2E_BUILD_PROFILE: 'mock-persistent', E2E_BUILD_ENV_FILE: '.env.mock',
    EXPO_PUBLIC_MOCK_MODE: 'true', EXPO_PUBLIC_MOCK_PERSISTENCE: 'true', EXPO_PUBLIC_MOCK_AUDIO: 'true', EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED: 'true' });
  assert.equal(suiteBuildEnv('backend', { backend: { manifestFile: '/private/tmp/qa/manifest.json' } }).E2E_NATIVE_BACKEND_MANIFEST, '/private/tmp/qa/manifest.json');
  assert.throws(() => suiteBuildEnv('backend'), /live stack/);
  for (const platform of ['ios', 'android']) {
    const { command, binary } = buildCommand(platform, { scheme: 'NoctaliaQA', udid: 'UDID', suite: 'backend' });
    assert.doesNotThrow(() => validateBuildCommand(command, platform));
    assert.match(binary, platform === 'ios' ? /^ios\/build\/backend\/.+\/NoctaliaQA\.app$/ : /app-release\.apk$/);
  }
  assert.deepEqual(runSelection('ios', 'backend'), ['--exclude-tag', 'native-real-dictation', '--exclude-tag', 'native-speech-file']);
  assert.deepEqual(runSelection('android', 'backend'), ['--exclude-tag', 'native-real-dictation']);
  assert.deepEqual(runSelection('ios', 'mock'), []);
});

test('reads a run folder and writes a French report with the phone-only list', () => {
  const dir = mkdtempSync(join(tmpdir(), 'release-simulators-'));
  try {
    writeFileSync(join(dir, 'end.json'), JSON.stringify({ applicationQualified: false, exitCode: 1, secondaryErrors: [] }));
    writeFileSync(join(dir, 'report.json'), JSON.stringify({ run: { summary: { passed: 8, failed: 1, skipped: 4 }, results: [
      { selected: true, status: 'passed', titlePath: ['ok'] },
      { selected: true, status: 'failed', titlePath: ['Dreamer release drawer Plus opens its offer and closes back to Capture'] },
      { selected: true, status: 'skipped', titlePath: ['skip'] },
    ] } }));
    const failed = readRun(dir);
    assert.deepEqual([failed.qualified, failed.passed, failed.failed, failed.skipped], [false, 8, 1, 4]);
    assert.deepEqual(failed.failures, ['Dreamer release drawer Plus opens its offer and closes back to Capture']);
    assert.deepEqual(readRun(join(dir, 'missing')), { qualified: false, exitCode: null, passed: 0, failed: 0, skipped: 0, failures: [], errors: [] });

    const results = { 'production:ios': { qualified: true, passed: 9, failed: 0, skipped: 3 }, 'production:android': { ...failed, dir: 'outputs/x/e2e/run' } };
    const base = { revision: 'a'.repeat(40), ref: 'origin/master', startedAt: 's', finishedAt: 'f', platforms: ['ios', 'android'], suites: ['production'] };
    const report = renderReport({ ...base, results, evidence: 'outputs/x/e2e' });
    assert.match(report, /^# Tests sur simulateurs : origin\/master \(aaaaaaaaaaaa\)/);
    assert.match(report, /Des parcours ont échoué/);
    assert.match(report, /\| Configuration production \| OK \(9 réussis, 3 hors profil\) \| ÉCHEC \(8 réussis, 1 en échec, 4 hors profil\) \|/);
    assert.match(report, /- Dreamer release drawer Plus opens its offer/);
    for (const item of PHONE_ONLY) assert.ok(report.includes(item));
    assert.doesNotMatch(report, /—/);
    const passed = renderReport({ ...base, results: { ...results, 'production:android': { qualified: true, passed: 9, failed: 0, skipped: 3 } } });
    assert.match(passed, /Tout est passé sur les simulateurs/);
    assert.doesNotMatch(passed, /## Échecs/);
    assert.match(renderReport({ ...base, finishedAt: null, results: {} }), /Campagne en cours[\s\S]*non lancé/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
