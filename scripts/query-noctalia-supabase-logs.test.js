'use strict';

const {
  INVOCATIONS_QUERY,
  LOGS_ENDPOINT,
  OVERVIEW_QUERY,
  SafeFailure,
  queryLogs,
  runAudit,
  sanitizeRows,
} = require('./query-noctalia-supabase-logs');

const overview = {
  edge_events: '12',
  postgres_events: '34',
  function_edge_events: '5',
  function_runtime_events: '9',
  sync_requests: '3',
  sync_4xx: '0',
  sync_5xx: '0',
  rate_limit_events: '0',
  timeout_network_events: '0',
  auth_config_events: '0',
  model_events: '0',
  retry_exhausted_events: '0',
  fallback_activated_events: '0',
  queue_saturation_events: '0',
  persistence_events: '0',
  content_blocked_events: '0',
  postgres_chain_errors: '0',
  runtime_chain_errors: '0',
};

function response(result, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue({ result }),
  };
}

describe('Noctalia Supabase aggregate log client', () => {
  it('uses only fixed aggregate queries and explicit one-hour/twenty-four-hour windows', async () => {
    const calls = [];
    const fetchFn = jest.fn(async (url, options) => {
      calls.push({ url, options });
      const sql = url.searchParams.get('sql');
      return sql === OVERVIEW_QUERY
        ? response([overview])
        : response([{ component: 'api', status: '200', events: '3' }]);
    });

    const result = await runAudit({
      readToken: () => 'sbp_fc_dummy_token_for_tests_1234567890',
      fetchFn,
      now: () => new Date('2026-09-04T12:00:00.000Z'),
    });

    expect(result.status).toBe('ok');
    expect(result.windows['1h'].overview.edge_events).toBe(12);
    expect(result.windows['24h'].invocations).toEqual([
      { component: 'api', status: 200, events: 3 },
    ]);
    expect(calls).toHaveLength(4);
    expect(new Set(calls.map(({ url }) => url.searchParams.get('sql')))).toEqual(
      new Set([OVERVIEW_QUERY, INVOCATIONS_QUERY]),
    );
    expect(new Set(calls.map(({ url }) => url.origin + url.pathname))).toEqual(
      new Set([LOGS_ENDPOINT]),
    );
    expect(calls.every(({ options }) => options.method === 'GET')).toBe(true);
  });

  it('never reads or returns an HTTP error body', async () => {
    const json = jest.fn();
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 403, json });

    await expect(queryLogs({
      token: 'sbp_fc_dummy_token_for_tests_1234567890',
      sql: OVERVIEW_QUERY,
      start: new Date('2026-09-04T11:00:00.000Z'),
      end: new Date('2026-09-04T12:00:00.000Z'),
      allowedKeys: new Set(Object.keys(overview)),
      fetchFn,
    })).rejects.toMatchObject({ code: 'credential_rejected', exitCode: 3 });
    expect(json).not.toHaveBeenCalled();
  });

  it('fails closed when a response contains a non-allowlisted column', () => {
    expect(() => sanitizeRows(
      [{ edge_events: '12', event_message: 'must not escape' }],
      new Set(['edge_events']),
    )).toThrow(expect.objectContaining({ code: 'unexpected_logs_response' }));
  });

  it('returns a controlled blocker when the credential is unavailable', async () => {
    await expect(runAudit({
      readToken: () => { throw new SafeFailure('credential_missing', 2); },
      fetchFn: jest.fn(),
    })).rejects.toMatchObject({ code: 'credential_missing', exitCode: 2 });
  });
});
