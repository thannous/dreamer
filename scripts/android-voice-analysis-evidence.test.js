'use strict';
/* global describe, expect, it */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  evaluateVoiceAnalysisEvidence,
  inspectVoiceAnalysisWiring,
  invalidateVoiceAnalysisEvidence,
  VOICE_ANALYSIS_EVIDENCE,
  VOICE_ANALYSIS_FLOW,
  writeVoiceAnalysisEvidence,
} = require('./android-voice-analysis-evidence');

const BUILD = {
  packageName: 'com.example.voiceqa',
  versionName: '2.0.2',
  versionCode: 34,
};

function writeFile(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function setupFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-evidence-'));
  writeFile(
    root,
    'app.json',
    JSON.stringify({
      expo: {
        version: BUILD.versionName,
        android: {
          package: BUILD.packageName,
          versionCode: BUILD.versionCode,
        },
      },
    })
  );
  writeFile(
    root,
    'package.json',
    JSON.stringify({
      scripts: {
        'test:e2e:release:voice-analysis:local':
          'node scripts/run-maestro-android.js --suite release-voice-analysis --no-start-metro',
      },
    })
  );
  writeFile(
    root,
    VOICE_ANALYSIS_FLOW,
    [
      'appId: com.example.voiceqa',
      '---',
      '- tapOn:',
      '    id: btn.recordToggle',
      '- assertVisible: forest|moon',
      '- assertVisible: fox|door',
      '- tapOn:',
      '    id: btn.saveDream',
      '- assertVisible:',
      '    id: component.transcriptCard',
      '- assertVisible: Interpretation|Interprétation',
      '- tapOn:',
      '    id: btn.auth.signOut',
      '',
    ].join('\n')
  );
  writeFile(
    root,
    'scripts/run-maestro-android.js',
    [
      `const flow = '${VOICE_ANALYSIS_FLOW}';`,
      "const suites = { 'release-voice-analysis': [flow] };",
      'invalidateVoiceAnalysisEvidence();',
      'writeVoiceAnalysisEvidence();',
      '',
    ].join('\n')
  );
  return root;
}

describe('Android Release voice runtime evidence', () => {
  it('accepts the microphone-only flow and receipt wiring', () => {
    const root = setupFixture();

    expect(inspectVoiceAnalysisWiring(root)).toMatchObject({ ok: true });
  });

  it('is manual before a build and blocked for qualification without a receipt', () => {
    const root = setupFixture();

    expect(evaluateVoiceAnalysisEvidence({ rootDir: root, phase: 'prebuild' }))
      .toMatchObject({ status: 'manual' });
    expect(evaluateVoiceAnalysisEvidence({ rootDir: root, phase: 'qualification' }))
      .toMatchObject({ status: 'blocked' });
  });

  it('writes an atomic, versioned receipt and accepts it', () => {
    const root = setupFixture();
    const verifiedAt = new Date('2026-07-11T08:00:00.000Z');

    const receipt = writeVoiceAnalysisEvidence({
      rootDir: root,
      buildIdentity: { ...BUILD, versionCode: String(BUILD.versionCode) },
      targetKind: 'emulator',
      now: () => verifiedAt,
    });

    expect(receipt).toMatchObject({
      qualification: true,
      versionCode: BUILD.versionCode,
      targetKind: 'emulator',
      verifiedAt: verifiedAt.toISOString(),
    });
    expect(evaluateVoiceAnalysisEvidence({ rootDir: root }))
      .toMatchObject({ status: 'pass' });
    expect(fs.statSync(path.join(root, VOICE_ANALYSIS_EVIDENCE)).mode & 0o777)
      .toBe(0o600);
  });

  it('blocks a stale receipt when the flow semantics change', () => {
    const root = setupFixture();
    writeVoiceAnalysisEvidence({
      rootDir: root,
      buildIdentity: BUILD,
      targetKind: 'physical',
    });
    fs.appendFileSync(path.join(root, VOICE_ANALYSIS_FLOW), '# changed\n');

    expect(evaluateVoiceAnalysisEvidence({ rootDir: root }))
      .toMatchObject({ status: 'blocked' });
  });

  it('invalidates the old receipt before a new attempt', () => {
    const root = setupFixture();
    writeVoiceAnalysisEvidence({
      rootDir: root,
      buildIdentity: BUILD,
      targetKind: 'emulator',
    });

    expect(invalidateVoiceAnalysisEvidence(root)).toBe(true);
    expect(invalidateVoiceAnalysisEvidence(root)).toBe(false);
    expect(evaluateVoiceAnalysisEvidence({ rootDir: root }))
      .toMatchObject({ status: 'blocked' });
  });

  it('fails wiring that can inject transcript text', () => {
    const root = setupFixture();
    fs.appendFileSync(path.join(root, VOICE_ANALYSIS_FLOW), '- inputText: shortcut\n');

    expect(evaluateVoiceAnalysisEvidence({ rootDir: root }))
      .toMatchObject({ status: 'fail' });
  });
});
