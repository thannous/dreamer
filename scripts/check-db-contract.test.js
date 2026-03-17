/* global describe, expect, it */
const { runGuestQuotaImageSupportBehaviorCheck } = require('./check-db-contract');

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
