'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// End-to-end CLI: real argument parsing, runner, reports and process exit.
// Only the ADB boundary is synthetic; these assertions are not phone perf evidence.
describe('Android performance report CLI', () => {
  it.each([
    ['valid', 3, 0, 100],
    ['mixed', 2, 2, 100],
    ['invalid', 0, 2, null],
    ['missing-marker', 0, 2, null],
  ])('%s retains evidence and only aggregates valid runs', (scenario, valid, exit, p95) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-perf-cli-'));
    try {
      const result = spawnSync(process.execPath, [
        path.join(__dirname, 'measure-android-performance.js'), '--device', 'synthetic',
        '--runs', '3', '--settle-ms', '0', '--timeout-ms', '1', '--output', dir,
      ], { encoding: 'utf8', env: { ...process.env,
        ADB_BIN: path.join(__dirname, 'fixtures/performance-adb.cjs'),
        PERF_FIXTURE_SCENARIO: scenario, PERF_FIXTURE_STATE: path.join(dir, 'state'),
      } });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(exit);
      const report = JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8'));
      expect(report.schemaVersion).toBe(2);
      expect(report.summary.cold).toMatchObject({
        totalCount: 3, validCount: valid, invalidCount: 3 - valid, count: valid,
        amTotalMs: { count: valid, p95 }, frameP95Ms: { count: 0, median: null },
      });
      expect(report.runs).toHaveLength(3);
      expect(report.runs.filter(r => r.valid)).toHaveLength(valid);
      expect(report.failures.length).toBe(3 - valid);
      const csv = fs.readFileSync(path.join(dir, 'report.csv'), 'utf8').trim().split('\n');
      expect(csv).toHaveLength(4);
      expect(csv[0]).toContain('valid,failure_reasons');
      if (scenario === 'mixed') {
        expect(report.runs[2].launch.totalTimeMs).toBe(9999);
        expect(csv[3]).toContain('false,fatal_error');
      }
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }, 30000);
});
