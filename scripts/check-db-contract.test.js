/* global describe, expect, it */
const {
  runGuestAnalysisIdempotencyBehaviorCheck,
  runGuestQuotaImageSupportBehaviorCheck,
} = require('./check-db-contract');

function createMockClient(responses) {
  const queue = [...responses];
  const calls = [];

  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      const next = queue.shift();
      if (next instanceof Error) {
        throw next;
      }
      return next ?? { rows: [] };
    },
  };
}

describe('check-db-contract guest image quota behavior', () => {
  it('passes when guest quota RPCs support image claims and releases', async () => {
    const client = createMockClient([
      { rows: [] },
      {
        rows: [
          {
            result: {
              analysis_count: 0,
              exploration_count: 0,
              image_count: 0,
              is_upgraded: false,
            },
          },
        ],
      },
      {
        rows: [
          {
            result: {
              allowed: true,
              new_count: 1,
              is_upgraded: false,
            },
          },
        ],
      },
      { rows: [{ result: { image_count: 1 } }] },
      { rows: [{ result: { released: true, new_count: 0 } }] },
      { rows: [{ result: { image_count: 0 } }] },
      { rows: [] },
    ]);

    const result = await runGuestQuotaImageSupportBehaviorCheck(client);

    expect(result).toEqual({
      ok: true,
      details: 'guest quota RPCs support image_count claims and release semantics',
    });
    expect(client.calls[2]).toMatchObject({
      sql: 'select public.increment_guest_quota($1::text, $2::text, $3::integer) as result',
      params: [expect.any(String), 'image', 1],
    });
    expect(client.calls.at(-1)).toMatchObject({ sql: 'ROLLBACK' });
  });

  it('fails when get_guest_quota_status omits image_count', async () => {
    const client = createMockClient([
      { rows: [] },
      {
        rows: [
          {
            result: {
              analysis_count: 0,
              exploration_count: 0,
              is_upgraded: false,
            },
          },
        ],
      },
      { rows: [] },
    ]);

    const result = await runGuestQuotaImageSupportBehaviorCheck(client);

    expect(result.ok).toBe(false);
    expect(result.details).toMatch(/image_count/i);
    expect(client.calls.at(-1)).toMatchObject({ sql: 'ROLLBACK' });
  });
});

describe('check-db-contract guest analysis idempotency behavior', () => {
  it('passes when the same request retries without consuming quota twice', async () => {
    const client = createMockClient([
      { rows: [] },
      { rows: [{ result: { allowed: true, new_count: 1, claimed: true, duplicate: false } }] },
      { rows: [{ result: { allowed: true, new_count: 1, claimed: false, duplicate: true } }] },
      { rows: [{ result: { allowed: false, new_count: 1, claimed: false, duplicate: false } }] },
      { rows: [] },
    ]);

    const result = await runGuestAnalysisIdempotencyBehaviorCheck(client);

    expect(result).toEqual({
      ok: true,
      details: 'guest analysis quota is claimed exactly once per request UUID',
    });
    expect(client.calls[1]).toMatchObject({
      sql: 'select public.claim_guest_analysis_quota($1::text, $2::uuid, $3::integer) as result',
      params: [expect.any(String), '3f73ab45-9a14-4db9-94a3-d24724457d9e', 1],
    });
    expect(client.calls[2].params).toEqual(client.calls[1].params);
    expect(client.calls.at(-1)).toMatchObject({ sql: 'ROLLBACK' });
  });

  it('fails when a duplicate request increments the quota again', async () => {
    const client = createMockClient([
      { rows: [] },
      { rows: [{ result: { allowed: true, new_count: 1, claimed: true } }] },
      { rows: [{ result: { allowed: true, new_count: 2, duplicate: true } }] },
      { rows: [] },
    ]);

    const result = await runGuestAnalysisIdempotencyBehaviorCheck(client);

    expect(result.ok).toBe(false);
    expect(result.details).toMatch(/must not increment quota twice/i);
    expect(client.calls.at(-1)).toMatchObject({ sql: 'ROLLBACK' });
  });
});
