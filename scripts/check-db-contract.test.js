/* global describe, expect, it */
const {
  parseStatusEnv,
  readLocalStackDbUrl,
  resolveDbUrl,
  runGuestAnalysisIdempotencyBehaviorCheck,
  runGuestChatIdempotencyBehaviorCheck,
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
      { rows: [{ result: { allowed: false, code: 'ANALYSIS_ALREADY_CLAIMED', new_count: 1, claimed: false, duplicate: true } }] },
      { rows: [{ result: { allowed: false, code: 'ANALYSIS_TRANSCRIPT_MISMATCH', new_count: 1, claimed: false, duplicate: true } }] },
      { rows: [{ result: { allowed: false, new_count: 1, claimed: false, duplicate: false } }] },
      { rows: [] },
    ]);

    const result = await runGuestAnalysisIdempotencyBehaviorCheck(client);

    expect(result).toEqual({
      ok: true,
      details: 'guest analysis receipts reject changed transcripts and repeated provider work',
    });
    expect(client.calls[1]).toMatchObject({
      sql: 'select public.claim_guest_analysis_quota($1::text, $2::uuid, $3::integer, $4::text) as result',
      params: [expect.any(String), '3f73ab45-9a14-4db9-94a3-d24724457d9e', 1, 'a'.repeat(64)],
    });
    expect(client.calls[2].params).toEqual(client.calls[1].params);
    expect(client.calls[3].params[3]).toBe('b'.repeat(64));
    expect(client.calls.at(-1)).toMatchObject({ sql: 'ROLLBACK' });
  });

  it('fails when a duplicate request increments the quota again', async () => {
    const client = createMockClient([
      { rows: [] },
      { rows: [{ result: { allowed: true, new_count: 1, claimed: true } }] },
      { rows: [{ result: { allowed: false, code: 'ANALYSIS_ALREADY_CLAIMED', new_count: 2, duplicate: true } }] },
      { rows: [] },
    ]);

    const result = await runGuestAnalysisIdempotencyBehaviorCheck(client);

    expect(result.ok).toBe(false);
    expect(result.details).toMatch(/must not increment quota twice/i);
    expect(client.calls.at(-1)).toMatchObject({ sql: 'ROLLBACK' });
  });
});

describe('check-db-contract guest chat idempotency behavior', () => {
  it('passes when the same per-dream request does not consume chat safety quota twice', async () => {
    const client = createMockClient([
      { rows: [] },
      { rows: [{ result: { allowed: true, new_count: 1, claimed: true, duplicate: false } }] },
      { rows: [{ result: { allowed: true, new_count: 1, claimed: false, duplicate: true } }] },
      { rows: [{ result: { allowed: false, new_count: 1, claimed: false, duplicate: false } }] },
      { rows: [] },
    ]);

    const result = await runGuestChatIdempotencyBehaviorCheck(client);

    expect(result).toEqual({
      ok: true,
      details: 'guest chat quota is claimed exactly once per dream and request UUID',
    });
    expect(client.calls[1]).toMatchObject({
      sql: 'select public.claim_guest_chat_message($1::text, $2::text, $3::uuid, $4::integer) as result',
      params: [expect.any(String), 'local-dream-42', '3f73ab45-9a14-4db9-94a3-d24724457d9e', 1],
    });
    expect(client.calls[2].params).toEqual(client.calls[1].params);
    expect(client.calls.at(-1)).toMatchObject({ sql: 'ROLLBACK' });
  });
});

describe('local database URL resolution', () => {
  // Shape printed by Supabase CLI 2.121.0 for `status --env --output-format json` on a native stack.
  const statusEnv = '{"API_URL":"http://127.0.0.1:20710","DB_URL":"postgresql://postgres:postgres@127.0.0.1:32102/postgres"}\n';

  it('--local reads DB_URL from supabase status --env instead of assuming port 54322', () => {
    const calls = [];
    const spawn = (binary, argv, options) => {
      calls.push({ binary, argv, env: options.env });
      return { status: 0, stdout: statusEnv };
    };
    expect(readLocalStackDbUrl({}, spawn)).toBe('postgresql://postgres:postgres@127.0.0.1:32102/postgres');
    expect(calls[0].argv).toEqual(['status', '--env', '--output-format', 'json']);
    expect(calls[0].binary.replace(/\\/g, '/')).toMatch(/node_modules\/\.bin\/supabase$/);
    expect(calls[0].env.SUPABASE_EXPERIMENTAL_STACK).toBe('1');
    expect(resolveDbUrl({ local: true }, {}, () => 'from-status')).toBe('from-status');
  });

  it('--local fails instead of guessing a port when no local stack is running', () => {
    expect(() => readLocalStackDbUrl({}, () => ({ status: 1, stdout: '' }))).toThrow(/needs a running local stack/);
    expect(() => readLocalStackDbUrl({}, () => ({ status: 0, stdout: 'API_URL="x"\n' }))).toThrow(/needs a running local stack/);
    expect(parseStatusEnv('{"API_URL":"x"}')).toBe(null);
    expect(parseStatusEnv("API_URL='x'\nDB_URL='postgresql://u@127.0.0.1:25000/postgres'\n")).toBe('postgresql://u@127.0.0.1:25000/postgres');
  });

  it('explicit URLs keep priority and never call the CLI', () => {
    const readLocal = () => { throw new Error('must not run'); };
    expect(resolveDbUrl({ local: true, dbUrl: 'a' }, {}, readLocal)).toBe('a');
    expect(resolveDbUrl({ local: true }, { SUPABASE_DB_URL: 'b' }, readLocal)).toBe('b');
    expect(resolveDbUrl({ local: true }, { DATABASE_URL: 'c' }, readLocal)).toBe('c');
    expect(resolveDbUrl({ local: true }, { SUPABASE_LOCAL_DB_URL: 'd' }, readLocal)).toBe('d');
    expect(resolveDbUrl({ local: false }, {}, readLocal)).toBe(null);
  });
});
