/* global __dirname, describe, it, expect */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  EXPECTED,
  getTrackStatus,
  normalizeSnapshot,
  parseArgs,
  readAppVersionCode,
  updateGooglePlayTrackState,
} = require('./update-google-play-track-state');

function tmpFile(name = 'track-state.json') {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'google-play-track-state-')), name);
}

function apiSnapshot(overrides = {}) {
  return {
    track: EXPECTED.track,
    releases: [
      {
        name: '1.2.0',
        versionCodes: [EXPECTED.versionCode],
        status: 'completed',
      },
    ],
    ...overrides,
  };
}

describe('Google Play track state updater', () => {
  it('normalizes an internal track response', () => {
    const document = normalizeSnapshot(JSON.stringify(apiSnapshot()), {
      checkedAt: '2026-05-15T00:00:00.000Z',
      source: 'test',
      packageName: EXPECTED.packageName,
      track: EXPECTED.track,
      expectedVersionCode: EXPECTED.versionCode,
      expectedStatus: EXPECTED.status,
    });

    expect(document.package_name).toBe(EXPECTED.packageName);
    expect(document.track).toBe('internal');
    expect(document.releases[0]).toEqual({
      name: '1.2.0',
      status: 'completed',
      version_codes: [EXPECTED.versionCode],
    });
    expect(getTrackStatus(document)).toEqual({
      ready: true,
      summary: `internal/1.2.0/completed/versionCode=${EXPECTED.versionCode}`,
    });
  });

  it('keeps missing expected version codes blocked', () => {
    const document = normalizeSnapshot(JSON.stringify(apiSnapshot({ releases: [] })), {
      checkedAt: '2026-05-15T00:00:00.000Z',
      source: 'test',
      packageName: EXPECTED.packageName,
      track: EXPECTED.track,
      expectedVersionCode: EXPECTED.versionCode,
      expectedStatus: EXPECTED.status,
    });

    expect(getTrackStatus(document)).toEqual({
      ready: false,
      summary: `internal/missing/${EXPECTED.versionCode}`,
    });
  });

  it('keeps draft releases blocked', () => {
    const document = normalizeSnapshot(
      JSON.stringify(
        apiSnapshot({
          releases: [{ name: '1.2.0', versionCodes: [EXPECTED.versionCode], status: 'draft' }],
        })
      ),
      {
        checkedAt: '2026-05-15T00:00:00.000Z',
        source: 'test',
        packageName: EXPECTED.packageName,
        track: EXPECTED.track,
        expectedVersionCode: EXPECTED.versionCode,
        expectedStatus: EXPECTED.status,
      }
    );

    expect(getTrackStatus(document)).toEqual({
      ready: false,
      summary: `internal/1.2.0/draft/versionCode=${EXPECTED.versionCode}`,
    });
  });

  it('writes the normalized snapshot to the requested file', () => {
    const file = tmpFile();
    updateGooglePlayTrackState(
      {
        file,
        checkedAt: '2026-05-15T00:00:00.000Z',
        source: 'test',
        packageName: EXPECTED.packageName,
        track: EXPECTED.track,
        expectedVersionCode: EXPECTED.versionCode,
        expectedStatus: EXPECTED.status,
      },
      JSON.stringify(apiSnapshot())
    );

    const written = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(written.checked_at).toBe('2026-05-15T00:00:00.000Z');
    expect(written.releases[0].version_codes).toEqual([EXPECTED.versionCode]);
  });

  it('rejects unexpected tracks', () => {
    expect(() =>
      normalizeSnapshot(JSON.stringify(apiSnapshot({ track: 'production' })), {
        checkedAt: '2026-05-15T00:00:00.000Z',
        source: 'test',
        packageName: EXPECTED.packageName,
        track: EXPECTED.track,
        expectedVersionCode: EXPECTED.versionCode,
        expectedStatus: EXPECTED.status,
      })
    ).toThrow('Expected track internal, got production.');
  });

  it('rejects invalid expected version codes', () => {
    expect(() =>
      normalizeSnapshot(JSON.stringify(apiSnapshot()), {
        checkedAt: '2026-05-15T00:00:00.000Z',
        source: 'test',
        packageName: EXPECTED.packageName,
        track: EXPECTED.track,
        expectedVersionCode: 'zero',
        expectedStatus: EXPECTED.status,
      })
    ).toThrow('--expected-version-code must be a positive integer.');
  });

  it('parses CLI options', () => {
    expect(
      parseArgs([
        '--input',
        'in.json',
        '--file',
        'out.json',
        '--checked-at',
        '2026-05-15T00:00:00Z',
        '--track',
        'internal',
        '--expected-version-code',
        '41',
      ])
    ).toMatchObject({
      input: expect.stringContaining('in.json'),
      file: expect.stringContaining('out.json'),
      checkedAt: '2026-05-15T00:00:00Z',
      track: 'internal',
      expectedVersionCode: '41',
    });
  });

  it('defaults the expected versionCode to the Android candidate in app.json', () => {
    const appConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8'));

    expect(readAppVersionCode()).toBe(String(appConfig.expo.android.versionCode));
    expect(parseArgs([]).expectedVersionCode).toBe(String(appConfig.expo.android.versionCode));
  });

  it('can evaluate track readiness against a newer candidate than the stored snapshot expectation', () => {
    const document = normalizeSnapshot(JSON.stringify(apiSnapshot()), {
      checkedAt: '2026-05-15T00:00:00.000Z',
      source: 'test',
      packageName: EXPECTED.packageName,
      track: EXPECTED.track,
      expectedVersionCode: EXPECTED.versionCode,
      expectedStatus: EXPECTED.status,
    });
    const nextVersionCode = String(Number(EXPECTED.versionCode) + 1);

    expect(getTrackStatus(document, nextVersionCode)).toEqual({
      ready: false,
      summary: `internal/missing/${nextVersionCode}`,
    });
  });
});
