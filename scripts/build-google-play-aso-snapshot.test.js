/* global Buffer, describe, it, expect */

const zlib = require('zlib');
const {
  buildSnapshot,
  buildReportedPeriodComparison,
  compareSnapshots,
  decodeReportBuffer,
  normalizeStorePerformanceCsv,
  parseCsv,
  validateConsoleObservation,
} = require('./build-google-play-aso-snapshot');

const CSV = [
  'Date,Package name,Traffic source,Search term,UTM source,UTM campaign,Store listing acquisitions,Store listing visitors,Store listing conversion rate',
  '2026-08-01,com.tanuki75.noctalia,Other,,,,1,4,0.25',
  '2026-08-02,com.tanuki75.noctalia,Other,,,,3,6,0.5',
  '2026-08-02,com.example.other,Explore,,,,50,100,0.5',
].join('\r\n');

function observation(dayCount = 28) {
  const endDay = dayCount === 28 ? '2026-08-08' : '2026-08-07';
  return validateConsoleObservation({
    schema_version: 1,
    package_name: 'com.tanuki75.noctalia',
    period: { start: '2026-07-12', end: endDay },
    metrics: [
      { family: 'store_listing_clicks', id: 'visitors', segment: 'all', unit: 'count', value: 100 },
    ],
  });
}

describe('Google Play ASO snapshot', () => {
  it('decodes the real report shape: gzip containing UTF-16LE with BOM', () => {
    const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(CSV, 'utf16le')]);
    expect(decodeReportBuffer(zlib.gzipSync(utf16))).toBe(CSV);
  });

  it('parses quoted commas and escaped quotes', () => {
    expect(parseCsv('a,b\n"hello, world","a ""quote"""\n')).toEqual([
      ['a', 'b'],
      ['hello, world', 'a "quote"'],
    ]);
  });

  it('filters the package and aggregates legacy metrics by traffic source', () => {
    const report = normalizeStorePerformanceCsv(CSV);
    expect(report).toMatchObject({
      metric_family: 'legacy_store_listing_acquisitions',
      period: { start: '2026-08-01', end: '2026-08-02', day_count: 2 },
      row_count: 2,
      totals: { acquisitions: 4, visitors: 10, conversion_rate: 0.4 },
      by_traffic_source: {
        Other: { acquisitions: 4, visitors: 10, conversion_rate: 0.4 },
      },
    });
  });

  it('keeps matching metric families comparable and rejects unequal period lengths', () => {
    const baseline = { console_observation: observation(28) };
    baseline.console_observation.metrics[0].value = 80;
    const current = { console_observation: observation(28) };
    const compared = compareSnapshots(current, baseline);
    expect(compared.metrics[0]).toMatchObject({
      comparable: true,
      absolute_change: 20,
      relative_change_percent: 25,
    });

    const unequal = compareSnapshots(
      { console_observation: observation(27) },
      baseline
    );
    expect(unequal.metrics[0]).toMatchObject({
      comparable: false,
      reason: 'unit_or_period_length_mismatch',
      absolute_change: null,
    });
  });

  it('preserves Play Console period deltas without deriving invented baseline counts', () => {
    const current = observation(28);
    current.period.comparison_start = '2026-06-14';
    current.period.comparison_end = '2026-07-11';
    current.metrics[0].change_percent_vs_previous_period = -19.05;

    expect(buildReportedPeriodComparison(current)).toMatchObject({
      status: 'reported_by_play_console',
      previous_period: { start: '2026-06-14', end: '2026-07-11', day_count: 28 },
      metrics: [
        {
          id: 'visitors',
          current: 100,
          change_percent_vs_previous_period: -19.05,
          comparable: true,
        },
      ],
    });
  });

  it('redacts a Cloud Storage URI from the generated snapshot', () => {
    const snapshot = buildSnapshot(
      {
        packageName: 'com.tanuki75.noctalia',
        checkedAt: '2026-08-09T12:00:00.000Z',
        storePerformance: 'gs://private-bucket/private-file.csv',
      },
      { readBinarySource: () => Buffer.from(CSV, 'utf8') }
    );
    expect(snapshot.store_performance.source).toBe('google_play_cloud_storage_report');
    expect(JSON.stringify(snapshot)).not.toContain('private-bucket');
    expect(snapshot.read_only).toBe(true);
  });
});
