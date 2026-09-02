'use strict';
/* global describe, expect, it */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  MANIFEST_PATH,
  LOCAL_RECEIPT_RELATIVE,
  MIN_LONG_FRAGMENT_CHARS,
  buildPlan,
  extractQuotedInputTexts,
  inspectHarness,
  inspectImageIndependentFlow,
  inspectAnalysisSuccessFlow,
  inspectLongFragmentFlow,
  inspectNamedScreenshots,
  inspectSearchRecovery,
  inspectPermissionsVoiceMode,
  inspectReleaseIdentityAnchors,
  parseArgs,
  recordEvidence,
  validateHarness,
  yamlLooksParseable,
} = require('./run-dreamer-vnext-ti429-harness');

const ROOT = path.resolve(__dirname, '..');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('Dreamer VNext TI-429 harness', () => {
  it('parses plan/validate/record commands without Maestro flags', () => {
    expect(parseArgs([])).toMatchObject({ command: 'plan' });
    expect(parseArgs(['validate'])).toMatchObject({ command: 'validate' });
    expect(parseArgs(['record'])).toMatchObject({ command: 'record' });
    expect(parseArgs(['record'])).toEqual({ command: 'record' });
    expect(() => parseArgs(['--device', 'adb-serial'])).toThrow('Unknown argument');
    expect(() => parseArgs(['--evidence-dir', 'tmp'])).toThrow('Unknown argument');
    expect(() => parseArgs(['--receipt', 'tmp.json'])).toThrow('Unknown argument');
  });

  it('covers the TI-429 criteria with automated, manual and blocked modes', () => {
    const inspection = inspectHarness(ROOT);
    expect(inspection.ok).toBe(true);
    expect(inspection.counts.automated).toBeGreaterThanOrEqual(12);
    expect(inspection.counts.manual).toBeGreaterThanOrEqual(8);
    expect(inspection.counts.blocked).toBe(1);

    const ids = inspection.manifest.checks.map((check) => check.id);
    expect(ids).toEqual(expect.arrayContaining([
      'write-tell-shared-draft',
      'draft-kill-relaunch',
      'short-fragment',
      'long-fragment',
      'long-10k-human',
      'offline-local',
      'offline-auth-sync',
      'analysis-success',
      'analysis-failed',
      'analysis-interrupt',
      'analysis-quota',
      'image-independent',
      'journal-detail-trends-deeplinks',
      'analysis-ready-detail-deeplink',
      'guest-free-plus-no-purchase',
      'notifications-permission',
      'talkback',
      'contrast',
      'large-text',
      'reduce-motion',
      'localization',
      'format-mobile',
      'format-tablet',
      'format-web',
    ]));

    const byId = Object.fromEntries(inspection.manifest.checks.map((check) => [check.id, check]));
    expect(byId.talkback.mode).toBe('manual');
    expect(byId.localization.mode).toBe('manual');
    expect(byId['format-tablet'].mode).toBe('manual');
    expect(byId['format-web'].runtime).toBe('web');
    expect(byId['analysis-failed'].runtime).toBe('mock-native');
    expect(byId['analysis-quota'].runtime).toBe('mock-native');
    expect(byId['guest-free-plus-no-purchase'].runtime).toBe('mock-native');
    expect(byId['write-tell-shared-draft'].runtime).toBe('release-native');
    expect(byId['analysis-ready-detail-deeplink'].mode).toBe('blocked');
    expect(byId['analysis-ready-detail-deeplink'].runtime).toBe('release-native');
    expect(byId['analysis-ready-detail-deeplink'].flow).toBeUndefined();
    expect(byId['analysis-ready-detail-deeplink'].command).toBeUndefined();
    expect(byId['journal-detail-trends-deeplinks'].notes).toMatch(/Does not cover analysis-ready/);
  });

  it('requires the long-fragment flow to keep a >600 character story and the end sentinel', () => {
    const flowText = read(path.join(ROOT, 'maestro/release-long-fragment.yml'));
    const longest = extractQuotedInputTexts(flowText).reduce(
      (max, value) => (value.length > max.length ? value : max),
      ''
    );
    expect(longest.length).toBeGreaterThan(MIN_LONG_FRAGMENT_CHARS);
    expect(longest.startsWith('LONG-START')).toBe(true);
    expect(longest.endsWith('LONG-END')).toBe(true);
    expect(flowText.indexOf('assertVisible: "LONG-START"')).toBeLessThan(flowText.indexOf('text: "LONG-END"'));
    expect(flowText.indexOf('text: "LONG-END"')).toBeLessThan(flowText.lastIndexOf('assertVisible: "LONG-END"'));
    expect(inspectLongFragmentFlow(flowText, {
      minInputLength: MIN_LONG_FRAGMENT_CHARS,
      startSentinel: 'LONG-START',
      endSentinel: 'LONG-END',
    })).toEqual([]);
  });

  it('requires the image flow to assert both CTAs without starting analysis or generating an image', () => {
    const flowText = read(path.join(ROOT, 'maestro/release-image-independent.yml'));
    expect(flowText).toContain('id: btn.dream.primaryCta');
    expect(flowText).toContain('id: btn.journal.illustrate');
    expect(flowText).not.toMatch(/-\s*tapOn:\s*\n\s*id:\s*btn.dream.primaryCta/);
    expect(flowText).not.toContain('Interpretation|Interprétation');
    const illustrateAt = flowText.indexOf('id: btn.journal.illustrate');
    expect(flowText.lastIndexOf('id: btn.dream.primaryCta')).toBeLessThan(illustrateAt);
    expect(flowText.lastIndexOf('id: component.transcriptCard')).toBeLessThan(illustrateAt);
    expect(inspectImageIndependentFlow(flowText)).toEqual([]);
  });

  it('inspects the image flow as primary+transcript, delete anchor, then assertNotVisible illustrate', () => {
    const valid = [
      'id: btn.dream.primaryCta',
      'id: component.transcriptCard',
      'id: btn.dream.delete',
      'assertNotVisible:',
      '  id: btn.journal.illustrate',
      '',
    ].join('\n');
    expect(inspectImageIndependentFlow(valid)).toEqual([]);

    expect(inspectImageIndependentFlow([
      '- tapOn:',
      '    id: btn.dream.primaryCta',
      'id: component.transcriptCard',
      'id: btn.dream.delete',
      'assertNotVisible:',
      '  id: btn.journal.illustrate',
      '',
    ].join('\n'))).toEqual(expect.arrayContaining([
      'image flow starts analysis; it must only assert the analysis CTA',
    ]));
    expect(inspectImageIndependentFlow([
      'id: btn.dream.primaryCta',
      'id: component.transcriptCard',
      'id: btn.dream.delete',
      '- tapOn:',
      '    id: btn.journal.illustrate',
      'assertNotVisible:',
      '  id: btn.journal.illustrate',
      '',
    ].join('\n'))).toEqual(expect.arrayContaining([
      'image flow generates an illustration; it must only assert the illustration CTA is absent',
    ]));
    expect(inspectImageIndependentFlow([
      'id: btn.dream.primaryCta',
      'id: component.transcriptCard',
      '- tapOn:',
      '    id: btn.dream.delete',
      'assertNotVisible:',
      '  id: btn.journal.illustrate',
      '',
    ].join('\n'))).toEqual(expect.arrayContaining([
      'image flow must not tap delete; delete is only a lower-viewport anchor',
    ]));
    expect(inspectImageIndependentFlow([
      'id: btn.dream.delete',
      'assertNotVisible:',
      '  id: btn.journal.illustrate',
      'id: btn.dream.primaryCta',
      'id: component.transcriptCard',
      '',
    ].join('\n'))).toEqual(expect.arrayContaining([
      'image flow must assert primaryCta+transcript, then scroll to delete, then assertNotVisible illustrate',
    ]));
  });

  it('inspects analysis-success as interpretation before illustrate, without tapping illustrate', () => {
    const valid = [
      '- assertVisible: "Interpretation|Interprétation"',
      '- assertVisible:',
      '    id: btn.journal.illustrate',
      '',
    ].join('\n');
    expect(inspectAnalysisSuccessFlow(valid)).toEqual([]);

    expect(inspectAnalysisSuccessFlow([
      '- assertVisible: "Interpretation|Interprétation"',
      '- tapOn:',
      '    id: btn.journal.illustrate',
      '',
    ].join('\n'))).toEqual(expect.arrayContaining([
      'analysis flow must assert the illustration CTA without tapping it',
    ]));
    expect(inspectAnalysisSuccessFlow([
      '- assertVisible:',
      '    id: btn.journal.illustrate',
      '- assertVisible: "Interpretation|Interprétation"',
      '',
    ].join('\n'))).toEqual(expect.arrayContaining([
      'analysis flow must wait for interpretation before asserting the illustration CTA',
    ]));
    expect(inspectAnalysisSuccessFlow('- assertVisible: "Interpretation|Interprétation"\n')).toEqual(
      expect.arrayContaining(['analysis flow must assert btn.journal.illustrate after a successful analysis'])
    );
  });

  it('keeps at most one named TI-429 screenshot per flow', () => {
    const check = { id: 'short-fragment' };
    expect(inspectNamedScreenshots('takeScreenshot: journal-list\n', check)).toEqual([]);
    expect(inspectNamedScreenshots('takeScreenshot: ti429-short-fragment\n', check)).toEqual([]);
    expect(inspectNamedScreenshots([
      'takeScreenshot: ti429-short-fragment',
      'takeScreenshot: ti429-short-fragment-again',
      '',
    ].join('\n'), check)).toEqual([
      'short-fragment has 2 TI-429 screenshots; keep at most one',
    ]);
  });

  it('applies search recovery only to the allowlisted checks', () => {
    const missingHide = [
      '- tapOn:',
      '    id: input.searchDreams',
      '- tapOn:',
      '    id: "dream.item.*"',
      '- assertVisible:',
      '    id: component.transcriptCard',
      '',
    ].join('\n');
    const hideAfterItem = [
      '- tapOn:',
      '    id: input.searchDreams',
      '- tapOn:',
      '    id: "dream.item.*"',
      '- hideKeyboard',
      '- assertVisible:',
      '    id: component.transcriptCard',
      '',
    ].join('\n');
    const valid = [
      '- tapOn:',
      '    id: input.searchDreams',
      '- hideKeyboard',
      '- tapOn:',
      '    id: "dream.item.*"',
      '- assertVisible:',
      '    id: component.transcriptCard',
      '',
    ].join('\n');

    expect(inspectSearchRecovery(missingHide, { id: 'short-fragment' })).toEqual(expect.arrayContaining([
      'short-fragment must hideKeyboard after journal search before tapping a dream item',
    ]));
    expect(inspectSearchRecovery(hideAfterItem, { id: 'offline-local' })).toEqual(expect.arrayContaining([
      'offline-local hides the keyboard after tapping a dream item',
    ]));
    expect(inspectSearchRecovery(valid, { id: 'analysis-interrupt' })).toEqual([]);
    expect(inspectSearchRecovery(missingHide, { id: 'offline-auth-sync' })).toEqual([]);
    expect(inspectSearchRecovery(hideAfterItem, { id: 'analysis-failed' })).toEqual([]);
  });

  it('requires two voice-mode switches before the two recordToggle taps', () => {
    const valid = [
      '- tapOn:',
      '    id: btn.recording.inputMode.voice',
      '- tapOn:',
      '    id: btn.recordToggle',
      '- tapOn:',
      '    id: btn.recording.inputMode.voice',
      '- tapOn:',
      '    id: btn.recordToggle',
      '',
    ].join('\n');
    expect(inspectPermissionsVoiceMode(valid)).toEqual([]);

    expect(inspectPermissionsVoiceMode([
      '- tapOn:',
      '    id: btn.recording.inputMode.voice',
      '- tapOn:',
      '    id: btn.recordToggle',
      '- tapOn:',
      '    id: btn.recordToggle',
      '',
    ].join('\n'))).toEqual(expect.arrayContaining([
      'permissions flow must enter voice mode before both recordToggle taps',
    ]));
    expect(inspectPermissionsVoiceMode([
      '- tapOn:',
      '    id: btn.recordToggle',
      '- tapOn:',
      '    id: btn.recording.inputMode.voice',
      '',
    ].join('\n'))).toEqual(expect.arrayContaining([
      'permissions flow must tap voice input mode before looking for recordToggle',
    ]));
  });

  it('wires the new Release flows into the Maestro suite and package scripts without launching them', () => {
    const packageJson = JSON.parse(read(path.join(ROOT, 'package.json')));
    const runner = read(path.join(ROOT, 'scripts/run-maestro-android.js'));

    expect(packageJson.scripts['test:e2e:release:ti429:plan']).toContain('run-dreamer-vnext-ti429-harness.js plan');
    expect(packageJson.scripts['test:e2e:release:ti429:validate']).toContain('run-dreamer-vnext-ti429-harness.js validate');
    expect(packageJson.scripts['test:e2e:release:ti429:record']).toContain('run-dreamer-vnext-ti429-harness.js record');
    expect(packageJson.scripts['test:e2e:release:ti429:local']).toContain('--suite release-ti429');
    expect(packageJson.scripts['test:e2e:release:ti429:local']).toContain('--no-start-metro');
    expect(packageJson.scripts['test:e2e:release:ti429:local']).not.toContain('journal-dream-cta-labels.yml');
    expect(runner).toContain("'release-ti429':");
    expect(runner).toContain("'maestro/release-write-tell.yml'");
    expect(runner).toContain("'maestro/release-draft-kill-relaunch.yml'");
    expect(runner).toContain("'maestro/release-journal-trends-deeplinks.yml'");
  });

  it('plans a dated evidence tree without executing Maestro or claiming a pass', () => {
    const plan = buildPlan(ROOT, new Date('2026-09-01T12:00:00.000Z'));
    expect(plan.ticket).toBe('TI-429');
    expect(plan.ok).toBe(true);
    expect(plan.evidenceDir).toContain('maestro-results/android/ti429/');
    expect(plan.checks.every((check) => check.status === 'blocked' || check.status === 'manual')).toBe(true);
    expect(plan.checks.some((check) => check.status === 'pass')).toBe(false);
    expect(plan.checks.filter((check) => check.mode === 'automated').every((check) => check.status === 'blocked')).toBe(true);
    const analysisReady = plan.checks.find((check) => check.id === 'analysis-ready-detail-deeplink');
    expect(analysisReady).toMatchObject({ mode: 'blocked', runtime: 'release-native', status: 'blocked', flow: null, command: null });
    expect(plan.limits.some((limit) => limit.includes('never launches Maestro'))).toBe(true);
    expect(plan.limits.some((limit) => limit.includes('release-ti429 suite'))).toBe(true);
  });

  it('records a local receipt and dated folders without ADB or Maestro', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ti429-harness-'));
    const copyNames = [
      MANIFEST_PATH,
      'package.json',
      'scripts/run-maestro-android.js',
      'scripts/run-dreamer-vnext-ti429-harness.js',
      'maestro/release-write-tell.yml',
      'maestro/release-draft-kill-relaunch.yml',
      'maestro/release-long-fragment.yml',
      'maestro/release-analysis-interrupt.yml',
      'maestro/release-image-independent.yml',
      'maestro/release-journal-trends-deeplinks.yml',
      'maestro/release-lifecycle.yml',
      'maestro/release-offline-local.yml',
      'maestro/release-auth-offline-sync.yml',
      'maestro/release-analysis.yml',
      'maestro/journal-dream-cta-labels.yml',
      'maestro/free-analysis-limit.yml',
      'maestro/subscription-qa-lab.yml',
      'maestro/release-notification-permission.yml',
    ];
    for (const relative of copyNames) {
      const source = path.join(ROOT, relative);
      const destination = path.join(tmp, relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination);
    }

    const receipt = recordEvidence(tmp, new Date('2026-09-01T12:00:00.000Z'));
    expect(receipt.maestroExecuted).toBe(false);
    expect(receipt.adbUsed).toBe(false);
    expect(receipt.checks.some((check) => check.status === 'pass')).toBe(false);
    expect(fs.existsSync(path.join(tmp, receipt.evidenceDir, 'matrix.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, receipt.evidenceDir, 'automated'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, receipt.evidenceDir, 'manual'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, receipt.evidenceDir, 'blocked'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, LOCAL_RECEIPT_RELATIVE))).toBe(true);
    expect(validateHarness(tmp).ok).toBe(true);
  });

  it('requires dynamic appId/scheme anchors and side-by-side QA commands for release-native proof', () => {
    const inspection = inspectHarness(ROOT);
    expect(inspection.ok).toBe(true);

    const releaseNative = inspection.manifest.checks.filter((check) => (
      check.runtime === 'release-native' && check.mode === 'automated'
    ));
    expect(releaseNative.length).toBeGreaterThan(0);
    for (const check of releaseNative) {
      expect(check.command).toContain('--side-by-side-qa');
      const flowText = read(path.join(ROOT, check.flow));
      expect(inspectReleaseIdentityAnchors(flowText, check)).toEqual([]);
      expect(yamlLooksParseable(path.join(ROOT, check.flow), check)).toBe(true);
      expect(flowText).toContain('appId: ${APP_ID || "com.tanuki75.noctalia"}');
      expect(flowText).not.toMatch(/^\s*appId:\s*com\.tanuki75\.noctalia\s*$/m);
      expect(flowText).not.toMatch(/^\s*appId:\s*\$\{APP_ID\}\s*$/m);
    }

    const trends = inspection.manifest.checks.find((check) => check.id === 'journal-detail-trends-deeplinks');
    expect(trends.requiredTokens).toEqual(expect.arrayContaining([
      '${DEEP_LINK_SCHEME || "noctalia"}://journal',
      '${DEEP_LINK_SCHEME || "noctalia"}://statistics',
      '${DEEP_LINK_SCHEME || "noctalia"}://weekly-recap',
      '${DEEP_LINK_SCHEME || "noctalia"}://recording',
    ]));
    expect(inspection.manifest.limits.some((limit) => (
      limit.includes('com.tanuki75.noctalia.qa') && limit.includes('not Store')
    ))).toBe(true);

    expect(inspectReleaseIdentityAnchors('appId: com.tanuki75.noctalia\n---\n', {
      runtime: 'release-native',
      flow: 'maestro/release-smoke.yml',
      mode: 'automated',
      command: 'node ./scripts/run-maestro-android.js --suite release --no-start-metro',
    })).toEqual(expect.arrayContaining([
      'release-native flow must use appId: ${APP_ID || "com.tanuki75.noctalia"}',
      'release-native flow still hardcodes the production appId',
      'canonical command is missing --side-by-side-qa for physical QA proof',
    ]));
    expect(inspectReleaseIdentityAnchors('appId: ${APP_ID}\n---\n- openLink: ${DEEP_LINK_SCHEME}://journal\n', {
      runtime: 'release-native',
      flow: 'maestro/release-journal-trends-deeplinks.yml',
      mode: 'automated',
      command: 'node ./scripts/run-maestro-android.js --suite release-ti429 --no-start-metro --side-by-side-qa',
    })).toEqual(expect.arrayContaining([
      'release-native flow must use appId: ${APP_ID || "com.tanuki75.noctalia"}',
      'release-native flow still hardcodes the production appId',
      'release-native flow still hardcodes noctalia:// instead of ${DEEP_LINK_SCHEME || "noctalia"}://',
    ]));
  });
});
