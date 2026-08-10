/* global describe, it, expect, jest */

const {
  API_ROOT,
  buildMetricQuery,
  exportVitals,
  getAccessToken,
  normalizeMetricRows,
} = require('./export-google-play-vitals');

function response(document, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Forbidden',
    text: async () => JSON.stringify(document),
  };
}

describe('Google Play Vitals exporter', () => {
  it('builds a daily Los Angeles query with an exclusive end date', () => {
    expect(buildMetricQuery('2026-07-12', '2026-08-09', ['crashRate'])).toEqual({
      timelineSpec: {
        aggregationPeriod: 'DAILY',
        startTime: { year: 2026, month: 7, day: 12, timeZone: { id: 'America/Los_Angeles' } },
        endTime: { year: 2026, month: 8, day: 9, timeZone: { id: 'America/Los_Angeles' } },
      },
      metrics: ['crashRate'],
      pageSize: 1000,
    });
  });

  it('normalizes camelCase and snake_case metric rows', () => {
    expect(
      normalizeMetricRows([
        {
          startTime: { year: 2026, month: 8, day: 1 },
          end_time: { year: 2026, month: 8, day: 2 },
          metrics: [
            { metric: 'crashRate', decimalValue: { value: '0.012' } },
            { metric: 'distinctUsers', decimal_value: '30' },
          ],
        },
      ])
    ).toEqual([
      {
        start_time: '2026-08-01',
        end_time: '2026-08-02',
        aggregation_period: 'DAILY',
        metrics: { crashRate: 0.012, distinctUsers: 30 },
      },
    ]);
  });

  it('queries crash and ANR endpoints without a mutation method', async () => {
    const fetchImpl = jest.fn(async (url, options) => {
      expect(options.method).toBe('POST');
      expect(url).toMatch(/(crashRateMetricSet|anrRateMetricSet):query$/);
      return response({ rows: [] });
    });
    const document = await exportVitals(
      {
        packageName: 'com.tanuki75.noctalia',
        start: '2026-07-12',
        end: '2026-08-09',
        checkedAt: '2026-08-09T00:00:00.000Z',
      },
      { accessToken: 'test-token', fetchImpl }
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][0]).toContain(API_ROOT);
    expect(document).toMatchObject({
      package_name: 'com.tanuki75.noctalia',
      read_only: true,
      period: { end_exclusive: '2026-08-09', time_zone: 'America/Los_Angeles' },
    });
  });

  it('uses an explicit access token without calling gcloud', () => {
    const execFile = jest.fn();
    expect(getAccessToken({ GOOGLE_PLAY_REPORTING_ACCESS_TOKEN: ' token ' }, execFile)).toBe('token');
    expect(execFile).not.toHaveBeenCalled();
  });

  it('adds a scope hint to authorization failures', async () => {
    const fetchImpl = jest.fn(async () => response({ error: { message: 'insufficient scopes' } }, 403));
    await expect(
      exportVitals(
        { packageName: 'com.tanuki75.noctalia', start: '2026-07-12', end: '2026-08-09' },
        { accessToken: 'bad-token', fetchImpl }
      )
    ).rejects.toThrow('playdeveloperreporting');
  });
});
