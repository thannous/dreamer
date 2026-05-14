const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  EXPECTED_PACKAGE_NAME,
  getSupabasePlayIntegritySecretIssues,
  isSupabasePlayIntegritySecretsReady,
  normalizeSnapshot,
  parseArgs,
  updateSupabasePlayIntegritySecretsState,
} = require('./update-supabase-play-integrity-secrets-state');

function tmpFile(name = 'supabase-secrets.json') {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'supabase-play-integrity-secrets-')), name);
}

function validOptions(overrides = {}) {
  return {
    checkedAt: '2026-05-14T21:30:00.000Z',
    source: 'test',
    projectRef: 'usuyppgsmmowzizhaoqj',
    secrets: {
      PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64: { status: 'present' },
      PLAY_INTEGRITY_PACKAGE_NAME: { status: 'present', value: EXPECTED_PACKAGE_NAME },
      GUEST_SESSION_SECRET: { status: 'present' },
    },
    ...overrides,
  };
}

describe('Supabase Play Integrity secrets state updater', () => {
  it('normalizes a ready secrets snapshot without storing secret values', () => {
    const document = normalizeSnapshot(validOptions());

    expect(document.project_ref).toBe('usuyppgsmmowzizhaoqj');
    expect(document.secrets.PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64).toEqual(
      expect.not.objectContaining({ value: expect.any(String) })
    );
    expect(document.secrets.GUEST_SESSION_SECRET).toEqual(expect.not.objectContaining({ value: expect.any(String) }));
    expect(isSupabasePlayIntegritySecretsReady(document)).toBe(true);
  });

  it('reports missing secrets and an unexpected package name', () => {
    const document = normalizeSnapshot(
      validOptions({
        secrets: {
          PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64: { status: 'missing' },
          PLAY_INTEGRITY_PACKAGE_NAME: { status: 'present', value: 'com.example.other' },
          GUEST_SESSION_SECRET: { status: 'unknown' },
        },
      })
    );

    expect(isSupabasePlayIntegritySecretsReady(document)).toBe(false);
    expect(getSupabasePlayIntegritySecretIssues(document)).toEqual([
      'PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64/missing',
      `PLAY_INTEGRITY_PACKAGE_NAME/value=com.example.other expected ${EXPECTED_PACKAGE_NAME}`,
      'GUEST_SESSION_SECRET/unknown',
    ]);
  });

  it('writes the normalized snapshot to the requested file', () => {
    const file = tmpFile();
    updateSupabasePlayIntegritySecretsState(validOptions({ file }));

    const written = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(written.project_ref).toBe('usuyppgsmmowzizhaoqj');
    expect(written.secrets.PLAY_INTEGRITY_PACKAGE_NAME.value).toBe(EXPECTED_PACKAGE_NAME);
  });

  it('rejects unknown statuses', () => {
    expect(() =>
      normalizeSnapshot(
        validOptions({
          secrets: {
            PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64: { status: 'maybe' },
          },
        })
      )
    ).toThrow('Unsupported secret status: maybe.');
  });

  it('parses CLI options', () => {
    const parsed = parseArgs([
      '--project-ref',
      'usuyppgsmmowzizhaoqj',
      '--PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64',
      'present',
      '--PLAY_INTEGRITY_PACKAGE_NAME',
      'present',
      '--PLAY_INTEGRITY_PACKAGE_NAME-value',
      EXPECTED_PACKAGE_NAME,
      '--GUEST_SESSION_SECRET',
      'missing',
      '--checked-at',
      '2026-05-14T21:30:00Z',
      '--file',
      'out.json',
    ]);

    expect(parsed).toMatchObject({
      projectRef: 'usuyppgsmmowzizhaoqj',
      checkedAt: '2026-05-14T21:30:00Z',
      file: expect.stringContaining('out.json'),
    });
    expect(parsed.secrets.GUEST_SESSION_SECRET.status).toBe('missing');
    expect(parsed.secrets.PLAY_INTEGRITY_PACKAGE_NAME.value).toBe(EXPECTED_PACKAGE_NAME);
  });
});
