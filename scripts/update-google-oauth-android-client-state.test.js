const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  EXPECTED,
  isOAuthAndroidClientSnapshotReady,
  normalizeSnapshot,
  parseArgs,
  updateGoogleOAuthAndroidClientState,
} = require('./update-google-oauth-android-client-state');

function tmpFile(name = 'snapshot.json') {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'google-oauth-android-client-state-')), name);
}

function validOptions(overrides = {}) {
  return {
    clientId: EXPECTED.clientId,
    name: 'Noctalia Android Production',
    packageName: EXPECTED.packageName,
    sha1: EXPECTED.sha1,
    checkedAt: '2026-05-14T12:00:00.000Z',
    source: 'test',
    ...overrides,
  };
}

describe('Google OAuth Android client state updater', () => {
  it('normalizes the Google Cloud Console Android client details', () => {
    const document = normalizeSnapshot(validOptions({ sha1: EXPECTED.sha1.toLowerCase() }));

    expect(document).toMatchObject({
      client_id: EXPECTED.clientId,
      package_name: EXPECTED.packageName,
      sha1: EXPECTED.sha1,
      checked_at: '2026-05-14T12:00:00.000Z',
    });
    expect(isOAuthAndroidClientSnapshotReady(document)).toBe(true);
  });

  it('writes the normalized snapshot to the requested file', () => {
    const file = tmpFile();
    updateGoogleOAuthAndroidClientState(validOptions({ file }));

    const written = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(written.client_id).toBe(EXPECTED.clientId);
    expect(written.package_name).toBe(EXPECTED.packageName);
    expect(written.sha1).toBe(EXPECTED.sha1);
  });

  it('rejects unexpected client ids', () => {
    expect(() => normalizeSnapshot(validOptions({ clientId: 'other.apps.googleusercontent.com' }))).toThrow(
      `Expected client ID ${EXPECTED.clientId}, got other.apps.googleusercontent.com.`
    );
  });

  it('rejects unexpected package names', () => {
    expect(() => normalizeSnapshot(validOptions({ packageName: 'com.example.other' }))).toThrow(
      `Expected package name ${EXPECTED.packageName}, got com.example.other.`
    );
  });

  it('rejects unexpected SHA-1 values', () => {
    expect(() => normalizeSnapshot(validOptions({ sha1: 'AA:BB' }))).toThrow(
      `Expected SHA-1 ${EXPECTED.sha1}, got AA:BB.`
    );
  });

  it('parses CLI options', () => {
    expect(
      parseArgs([
        '--client-id',
        EXPECTED.clientId,
        '--package-name',
        EXPECTED.packageName,
        '--sha1',
        EXPECTED.sha1,
        '--file',
        'out.json',
        '--checked-at',
        '2026-05-14T12:00:00Z',
      ])
    ).toMatchObject({
      clientId: EXPECTED.clientId,
      packageName: EXPECTED.packageName,
      sha1: EXPECTED.sha1,
      file: expect.stringContaining('out.json'),
      checkedAt: '2026-05-14T12:00:00Z',
    });
  });
});
