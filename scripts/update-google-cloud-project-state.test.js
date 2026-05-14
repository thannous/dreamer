const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  EXPECTED,
  isProjectSnapshotReady,
  normalizeSnapshot,
  parseArgs,
  updateGoogleCloudProjectState,
} = require('./update-google-cloud-project-state');

function tmpFile(name = 'snapshot.json') {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'google-cloud-project-state-')), name);
}

function gcloudProjects(overrides = {}) {
  return [
    {
      createTime: '2025-10-22T10:17:33.566454Z',
      lifecycleState: 'ACTIVE',
      name: 'dreamweaver',
      projectId: EXPECTED.projectId,
      projectNumber: EXPECTED.projectNumber,
      ...overrides,
    },
  ];
}

describe('Google Cloud project state updater', () => {
  it('normalizes the gcloud projects list response', () => {
    const document = normalizeSnapshot(JSON.stringify(gcloudProjects()), {
      checkedAt: '2026-05-14T12:00:00.000Z',
      source: 'test',
    });

    expect(document).toMatchObject({
      project_number: EXPECTED.projectNumber,
      project_id: EXPECTED.projectId,
      lifecycle_state: 'ACTIVE',
      checked_at: '2026-05-14T12:00:00.000Z',
    });
    expect(isProjectSnapshotReady(document)).toBe(true);
  });

  it('writes the normalized snapshot to the requested file', () => {
    const file = tmpFile();
    updateGoogleCloudProjectState(
      { file, checkedAt: '2026-05-14T12:00:00.000Z', source: 'test' },
      JSON.stringify(gcloudProjects())
    );

    const written = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(written.project_number).toBe(EXPECTED.projectNumber);
    expect(written.project_id).toBe(EXPECTED.projectId);
  });

  it('rejects unexpected project ids', () => {
    expect(() =>
      normalizeSnapshot(JSON.stringify(gcloudProjects({ projectId: 'other-project' })), {
        checkedAt: '2026-05-14T12:00:00.000Z',
        source: 'test',
      })
    ).toThrow(`Expected projectId ${EXPECTED.projectId}, got other-project.`);
  });

  it('rejects missing project numbers', () => {
    expect(() =>
      normalizeSnapshot(JSON.stringify([]), {
        checkedAt: '2026-05-14T12:00:00.000Z',
        source: 'test',
      })
    ).toThrow(`Expected projectNumber ${EXPECTED.projectNumber}, but it was not found.`);
  });

  it('rejects inactive projects', () => {
    expect(() =>
      normalizeSnapshot(JSON.stringify(gcloudProjects({ lifecycleState: 'DELETE_REQUESTED' })), {
        checkedAt: '2026-05-14T12:00:00.000Z',
        source: 'test',
      })
    ).toThrow('Expected lifecycleState ACTIVE, got DELETE_REQUESTED.');
  });

  it('rejects invalid checkedAt values', () => {
    expect(() => normalizeSnapshot('[]', { checkedAt: 'not-a-date', source: 'test' })).toThrow(
      '--checked-at must be a valid date.'
    );
  });

  it('parses CLI options', () => {
    expect(parseArgs(['--input', 'in.json', '--file', 'out.json', '--checked-at', '2026-05-14T12:00:00Z'])).toMatchObject({
      input: expect.stringContaining('in.json'),
      file: expect.stringContaining('out.json'),
      checkedAt: '2026-05-14T12:00:00Z',
    });
  });
});
