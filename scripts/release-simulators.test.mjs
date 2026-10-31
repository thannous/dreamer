import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseOptions, planSteps, runPlan, cleanEnv, stepFailure, disableAndroidUpdates, suiteBuildEnv,
  buildCommand, runSelection, readRun, renderReport, finishWorkspace, iosScheme, buildUntilAccepted, readRefusals, PHONE_ONLY, WORKSPACE_REGENERABLE } from './release-simulators.mjs';
import { validateBuildCommand } from '../tools/e2e/native-release.mjs';

test('defaults to the user journeys on both platforms, the other layers on demand', () => {
  // Thanh, 2026-10-31: « 3 à 4h pour noctalia dream ??? ». The short default is the mock layer.
  const options = parseOptions([]);
  assert.deepEqual([options.ref, options.platforms, options.suites, options.waitMinutes, options.fetch, options.keep],
    ['origin/master', ['ios', 'android'], ['mock'], 30, true, false]);
  assert.deepEqual(parseOptions(['--suites', 'all']).suites, ['production', 'mock', 'backend']);
  assert.deepEqual(parseOptions(['--platform', 'ios', '--suites', 'backend,mock', '--ref', 'abc123']).suites, ['mock', 'backend']);
  assert.throws(() => parseOptions(['--platform', 'iphone']), /--platform/);
  assert.throws(() => parseOptions(['--suites', 'store']), /--suites/);
  assert.throws(() => parseOptions(['--ref', 'master;rm -rf /']), /--ref/);
  assert.throws(() => parseOptions(['--wait-minutes', '0']), /--wait-minutes/);
});

const label = step => [step.kind, step.platform, step.suite ?? step.qa].filter(value => value !== undefined).join(' ');

test('generates each project once, alternates platforms and runs the local backend last', () => {
  assert.deepEqual(planSteps({ platforms: ['ios', 'android'], suites: ['production', 'mock', 'backend'] }).map(label), [
    'prebuild ios false', 'prebuild android false',
    'build ios production', 'run ios production', 'build android production', 'run android production',
    'build ios mock', 'run ios mock', 'build android mock', 'run android mock',
    'backend-start', 'prebuild ios true', 'prebuild android true',
    'build ios backend', 'run ios backend', 'build android backend', 'run android backend',
    'backend-stop',
  ]);
  assert.deepEqual(planSteps({ platforms: ['android'], suites: ['mock'] }).map(step => step.kind), ['prebuild', 'build', 'run']);
});

test('lets a run go on while the other platform builds, never beside its own platform or the backend', async () => {
  const events = [];
  const sleep = ms => new Promise(done => setTimeout(done, ms));
  const execute = async step => {
    events.push(`+${label(step)}`);
    await (step.kind === 'run' ? sleep(20) : Promise.resolve());
    if (label(step) === 'run ios production' && events.includes('fail')) throw new Error('run broke');
    events.push(`-${label(step)}`);
  };
  await runPlan(planSteps({ platforms: ['ios', 'android'], suites: ['production', 'mock', 'backend'] }), execute);
  const at = event => { assert.ok(events.includes(event), event); return events.indexOf(event); };
  // The iOS journeys and the Android build share the time.
  assert.ok(at('+build android production') < at('-run ios production'));
  assert.ok(at('+run android production') < at('-run ios production'));
  // A platform's next build waits for its run: the build rewrites what the run checks.
  assert.ok(at('-run ios production') < at('+build ios mock'));
  assert.ok(at('-run android production') < at('+build android mock'));
  // One build or generation at a time.
  events.forEach((event, index) => {
    if (/^\+(build|prebuild)/.test(event)) assert.equal(events[index + 1], `-${event.slice(1)}`, event);
  });
  // The local server takes one run at a time, after every earlier run.
  assert.ok(at('-run ios mock') < at('+backend-start') && at('-run android mock') < at('+backend-start'));
  assert.ok(at('-run ios backend') < at('+build android backend'));
  assert.equal(events.at(-1), '-backend-stop');

  // A failed run stops the campaign, but only once the other platform's run is over.
  events.length = 0; events.push('fail');
  await assert.rejects(runPlan(planSteps({ platforms: ['ios', 'android'], suites: ['production', 'mock'] }), execute), /run broke/);
  assert.ok(events.includes('-run android production'));
  assert.ok(!events.includes('+build ios mock'));
});

test('gives the build tools a UTF-8 locale and drops profiles inherited from the shell', () => {
  // Mac mini, 2026-10-31: from an agent shell without a locale, pod install stopped at
  // « CocoaPods requires your terminal to be using UTF-8 ».
  const bare = cleanEnv({ PATH: '/usr/bin', EXPO_PUBLIC_MOCK_MODE: 'true', E2E_DEVICE: 'x', E2E_SIMLOCK_BIN: '/opt/simlock' });
  assert.deepEqual(bare, { PATH: '/usr/bin', E2E_SIMLOCK_BIN: '/opt/simlock', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' });
  assert.equal(cleanEnv({ LANG: 'C', LC_ALL: 'POSIX' }).LC_ALL, 'en_US.UTF-8');
  assert.deepEqual(cleanEnv({ LANG: 'fr_FR.UTF-8' }), { LANG: 'fr_FR.UTF-8' });
  assert.equal(cleanEnv({ LANG: 'fr_FR.UTF-8', LC_ALL: 'C' }).LC_ALL, 'en_US.UTF-8');
  // A step stopped by Ctrl-C reads as interrupted, not as a failed build.
  assert.deepEqual(stepFailure('build en échec (logs/x.log)', false), { error: 'build en échec (logs/x.log)' });
  assert.deepEqual(stepFailure('build en échec (logs/x.log)', true), { error: 'interrompu' });
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
    const { command, binary } = buildCommand(platform, { scheme: 'NoctaliaQA', suite: 'backend' });
    assert.doesNotThrow(() => validateBuildCommand(command, platform));
    // Simlock picks the device at run time, so the build cannot name one.
    if (platform === 'ios') assert.equal(command[command.indexOf('-destination') + 1], 'generic/platform=iOS Simulator');
    assert.match(binary, platform === 'ios' ? /^ios\/build\/backend\/.+\/NoctaliaQA\.app$/ : /app-release\.apk$/);
  }
  assert.deepEqual(runSelection('ios', 'backend'), ['--exclude-tag', 'native-real-dictation', '--exclude-tag', 'native-speech-file']);
  assert.deepEqual(runSelection('android', 'backend'), ['--exclude-tag', 'native-real-dictation']);
  // The light/dark background matrices are visual captures run on their own (3.8.0 run, 2026-10-30).
  assert.deepEqual(runSelection('ios', 'mock'), ['--exclude-tag', 'contextual-backgrounds']);
  assert.deepEqual(runSelection('android', 'production'), []);
  // Three Gradle builds in a row exhausted Metaspace on the Mac mini with the default heap.
  const gradle = buildCommand('android', { suite: 'mock' }).command;
  assert.ok(gradle.includes('--max-workers=4'));
  assert.ok(gradle.includes('-Dorg.gradle.jvmargs=-Xmx6g -XX:MaxMetaspaceSize=1536m'));
  // Production and mock share one Gradle project, and the bundle task does not see EXPO_PUBLIC_* changes.
  assert.deepEqual(gradle.slice(1, 4), [':app:createBundleReleaseJsAndAssets', '--rerun', ':app:assembleRelease']);
});

test('rebuilds through the runner until it accepts a build whose native inputs held still', async () => {
  // Mac mini, 2026-10-31: xcodebuild warm-ups outside the runner settled, yet the runner's own build
  // still added dSYM UUID plists under ios/Pods and was refused (BUILD_INPUTS_CHANGED), as in the
  // Lucid/Méditation runs where the runner's second build passed. Only its environment writes them.
  const builds = outcomes => {
    const calls = [];
    return buildUntilAccepted(async attempt => { calls.push(attempt); return outcomes[attempt - 1]; })
      .then(result => ({ ...result, calls }));
  };
  const moved = { code: 1, refusals: ['BUILD_INPUTS_CHANGED'] }, ok = { code: 0, refusals: [] };
  assert.deepEqual(await builds([moved, moved, ok]), { ...ok, attempts: 3, calls: [1, 2, 3] });
  assert.deepEqual(await builds([ok]), { ...ok, attempts: 1, calls: [1] });
  // Any other refusal is a real failure, reported at once.
  const broken = { code: 1, refusals: ['BUILD_PROFILE_IDENTITY'] };
  assert.deepEqual(await builds([moved, broken]), { ...broken, attempts: 2, calls: [1, 2] });
  assert.deepEqual(await builds([moved, moved, moved, moved, ok]), { ...moved, attempts: 4, calls: [1, 2, 3, 4] });
});

test('names the iOS scheme from the generated project, before CocoaPods creates its workspace', () => {
  // `expo prebuild --no-install` leaves only the template's .xcodeproj (Expo template 58.0.30).
  assert.equal(iosScheme(['.xcode.env', 'NoctaliaQA', 'NoctaliaQA.xcodeproj', 'Podfile', 'Podfile.properties.json']), 'NoctaliaQA');
  assert.equal(iosScheme(['Noctalia.xcodeproj', 'Noctalia.xcworkspace', 'Pods', 'Podfile.lock']), 'Noctalia');
  assert.throws(() => iosScheme(['Podfile']), /found 0/);
  assert.throws(() => iosScheme(['A.xcodeproj', 'B.xcodeproj']), /found 2/);
});

test('lets the workspace go with everything the campaign writes in it', () => {
  const covered = file => WORKSPACE_REGENERABLE.some(item => file === item || file.startsWith(`${item}/`));
  for (const file of ['node_modules/expo/package.json', 'tools/e2e/node_modules/x', 'tools/e2e/.e2e/run/end.json', 'ios/build/mock/x',
    'android/app/build/x', '.expo/x', 'expo-env.d.ts', 'test-results/backend-e2e-cli-home/x']) assert.ok(covered(file), file);
});

test('reads a run folder and writes a French report with the phone-only list', () => {
  const dir = mkdtempSync(join(tmpdir(), 'release-simulators-'));
  try {
    writeFileSync(join(dir, 'end.json'), JSON.stringify({ applicationQualified: false, exitCode: 1, secondaryErrors: [],
      simlock: { leaseId: 'l1', deviceId: 'ios-1', model: 'iPhone 17 Pro', osVersion: '27.1', released: true } }));
    writeFileSync(join(dir, 'report.json'), JSON.stringify({ run: { summary: { passed: 8, failed: 1, skipped: 4 }, results: [
      { selected: true, status: 'passed', titlePath: ['ok'] },
      { selected: true, status: 'failed', titlePath: ['Dreamer release drawer Plus opens its offer and closes back to Capture'], attempts: [
        { status: 'failed', error: { code: 'ASSERTION_FAILED', message: 'expect.toBeChecked failed\nlocator: getByRole("radio")', source: { file: 'tests/dreamer.mobile.e2e.ts', line: 59, column: 3 } } }] },
      { selected: true, status: 'skipped', titlePath: ['skip'] },
    ] } }));
    assert.deepEqual(readRefusals(dir), []);
    assert.deepEqual(readRefusals(join(dir, 'missing')), []);
    const failed = readRun(dir);
    assert.deepEqual([failed.qualified, failed.passed, failed.failed, failed.skipped], [false, 8, 1, 4]);
    assert.equal(failed.device, 'iPhone 17 Pro, 27.1 (Simlock ios-1)');
    assert.deepEqual(failed.failures, ['Dreamer release drawer Plus opens its offer and closes back to Capture']);
    // The report names the failing assertion, so nine failures with one cause read as one.
    assert.deepEqual(failed.causes, [{ text: 'ASSERTION_FAILED: expect.toBeChecked failed (tests/dreamer.mobile.e2e.ts:59)', count: 1 }]);
    const refused = mkdtempSync(join(tmpdir(), 'release-simulators-build-'));
    writeFileSync(join(refused, 'end.json'), JSON.stringify({ exitCode: 3, secondaryErrors: ['BUILD_INPUTS_CHANGED'] }));
    assert.deepEqual(readRefusals(refused), ['BUILD_INPUTS_CHANGED']);
    rmSync(refused, { recursive: true, force: true });
    assert.deepEqual(readRun(join(dir, 'missing')), { qualified: false, exitCode: null, passed: 0, failed: 0, skipped: 0, failures: [], causes: [], errors: [], device: null });

    const results = { 'production:ios': { qualified: true, passed: 9, failed: 0, skipped: 3 }, 'production:android': { ...failed, dir: 'outputs/x/e2e/run' } };
    const base = { revision: 'a'.repeat(40), ref: 'origin/master', startedAt: 's', finishedAt: 'f', platforms: ['ios', 'android'], suites: ['production'] };
    const report = renderReport({ ...base, results, evidence: 'outputs/x/e2e' });
    assert.match(report, /^# Tests sur simulateurs : origin\/master \(aaaaaaaaaaaa\)/);
    assert.match(report, /Des parcours ont échoué/);
    assert.match(report, /\| Configuration production \| OK \(9 réussis, 3 hors profil\) \| ÉCHEC \(8 réussis, 1 en échec, 4 hors profil\) \|/);
    assert.match(report, /- Dreamer release drawer Plus opens its offer/);
    assert.match(report, /Cause \(1 parcours\) : `ASSERTION_FAILED: expect\.toBeChecked failed \(tests\/dreamer\.mobile\.e2e\.ts:59\)`/);
    for (const item of PHONE_ONLY) assert.ok(report.includes(item));
    assert.doesNotMatch(report, /—/);
    const passed = renderReport({ ...base, results: { ...results, 'production:android': { qualified: true, passed: 9, failed: 0, skipped: 3 } } });
    assert.match(passed, /Le périmètre sélectionné est passé/);
    assert.doesNotMatch(passed, /Il ne reste que/);
    assert.doesNotMatch(passed, /## Échecs/);
    assert.match(renderReport({ ...base, finishedAt: null, results: {} }), /Campagne en cours[\s\S]*non lancé/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});


test('a focused iPhone mock campaign names every unexecuted layer and platform', () => {
  const base = { revision: 'b'.repeat(40), ref: 'candidate', startedAt: 's', finishedAt: 'f' };
  const report = renderReport({ ...base, platforms: ['ios'], suites: ['mock'], results: { 'mock:ios': { qualified: true, passed: 7 } } });
  assert.match(report, /Le périmètre sélectionné est passé/);
  assert.doesNotMatch(report, /Il ne reste que|Tout est passé/);
  assert.match(report, /Couverture simulateur non exécutée/);
  for (const item of ['Configuration production / iPhone', 'Configuration production / Android', 'Compte et achats simulés / Android', 'Serveur local réel / iPhone', 'Serveur local réel / Android']) assert.ok(report.includes(item), item);
  const results = Object.fromEntries(['production', 'mock', 'backend'].flatMap(suite => ['ios', 'android'].map(platform => [`${suite}:${platform}`, { qualified: true, passed: 7 }])));
  const full = renderReport({ ...base, platforms: ['ios', 'android'], suites: ['production', 'mock', 'backend'], results });
  assert.match(full, /Tout est passé sur les simulateurs/);
  assert.doesNotMatch(full, /Couverture simulateur non exécutée/);
});

test('keeps the only evidence when relocation fails and releases only after a successful move', () => {
  const root = mkdtempSync(join(tmpdir(), 'release-simulators-evidence-'));
  try {
    const workspace = join(root, 'workspace'), reportDir = join(root, 'report');
    const runs = join(workspace, 'tools/e2e/.e2e'), destination = join(reportDir, 'e2e');
    mkdirSync(runs, { recursive: true }); mkdirSync(destination, { recursive: true });
    writeFileSync(join(runs, 'failure.json'), 'unique failure');
    writeFileSync(join(destination, 'older.json'), 'older campaign');
    const notes = [], results = { 'mock:ios': { dir: runs } };
    const options = { workspace, reportDir, primary: root, task: 'test', keep: false, results, notes,
      releaseWorkspace: () => rmSync(workspace, { recursive: true }) };
    // A nonempty destination forces the real rename to fail; cleanup must not erase the source.
    assert.equal(finishWorkspace(options), runs);
    assert.equal(readFileSync(join(runs, 'failure.json'), 'utf8'), 'unique failure');
    assert.equal(readFileSync(join(destination, 'older.json'), 'utf8'), 'older campaign');
    assert.ok(notes.some(note => note.includes('pour préserver les preuves')));
    assert.equal(results['mock:ios'].dir, runs);
    rmSync(destination, { recursive: true });
    assert.equal(finishWorkspace(options), destination);
    assert.equal(readFileSync(join(destination, 'failure.json'), 'utf8'), 'unique failure');
    assert.equal(existsSync(workspace), false);
    assert.equal(results['mock:ios'].dir, 'report/e2e');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('reuse goes straight to one pilot and six remaining distinct personas, with no preparation step', async () => {
  const { reuseSteps, checkReusedResult } = await import('./release-simulators.mjs');
  const parsed = parseOptions(['--reuse-workspace', '/qa', '--release-receipt', '/qa/release.json', '--platform', 'ios', '--personas', '--budget-gb', '6', '--startup-budget-gb', '4']);
  assert.equal(parsed.budgetGb, 6); assert.equal(parsed.startupBudgetGb, 4);
  assert.deepEqual(reuseSteps(true).map(x => [x.kind, x.expectedPassed]), [['pilot', 1], ['remaining', 6]]);
  assert.ok(reuseSteps(true)[1].args.includes('--exclude-tag'));
  assert.throws(() => checkReusedResult({ qualified: true, exitCode: 0, passed: 1, failed: 0, skipped: 6 }, 7), /INCOMPLETE/);
  assert.doesNotThrow(() => checkReusedResult({ qualified: true, exitCode: 0, passed: 6, failed: 0, skipped: 0 }, 6));
  assert.throws(() => parseOptions(['--personas']), /Reuse requires/);
  assert.throws(() => parseOptions(['--min-free-gb', '30']), /50 GB/);
});

test('reuse and ordinary campaigns share an exclusive lock and never release a replacement owner', async () => {
  const { acquireCampaignLock } = await import('./release-simulators.mjs');
  const root = mkdtempSync(join(tmpdir(), 'release-campaign-lock-')); const path = join(root, 'lock');
  try {
    const unlock = acquireCampaignLock(path);
    assert.throws(() => acquireCampaignLock(path), /in progress/);
    unlock(); assert.equal(existsSync(path), false);
    const owned = acquireCampaignLock(path); writeFileSync(path, '1'); owned();
    assert.equal(readFileSync(path, 'utf8'), '1');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
