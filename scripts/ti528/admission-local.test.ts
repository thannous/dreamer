import { describe, expect, it, jest } from '@jest/globals';
import { createHash, randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const { Client } = require('pg');
const { readLocalStatus } = require('./local-config.cjs');

// Opt-in only: this suite talks to the isolated TI-528 Supabase project and
// never uses credentials from the repository environment.
const localStatusPath = process.env.TI528_LOCAL_STATUS;
const suite = localStatusPath ? describe : describe.skip;
const realFetch = jest.requireActual('node-fetch') as typeof fetch;

type AdmissionClaim = {
  allowed?: boolean;
  code?: string;
  actor_count?: number | null;
  global_count?: number | null;
};

type LocalStatus = {
  API_URL: string;
  ANON_KEY: string;
  SERVICE_ROLE_KEY: string;
  DB_URL: string;
};

const hashSyntheticActor = (label: string): string =>
  createHash('sha256').update(`ti528:${label}`).digest('hex');

const claim = async (
  client: SupabaseClient,
  actorHash: string,
  capability: string,
  actorLimit: number,
  globalLimit: number,
  windowSeconds = 600
): Promise<{ data: AdmissionClaim | null; error: any }> => {
  const result = await client.rpc('claim_ai_request_window', {
    p_actor_hash: actorHash,
    p_capability: capability,
    p_window_seconds: windowSeconds,
    p_actor_limit: actorLimit,
    p_global_limit: globalLimit,
  });
  return result as { data: AdmissionClaim | null; error: any };
};

suite('TI528 real local AI admission qualification', () => {
  it('enforces service-role-only actor/global windows atomically', async () => {
    const status = readLocalStatus(localStatusPath) as LocalStatus;
    const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
      global: { fetch: realFetch },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const anonymous = createClient(status.API_URL, status.ANON_KEY, {
      global: { fetch: realFetch },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const db = new Client({ connectionString: status.DB_URL });
    const createdUserIds: string[] = [];
    const capabilities = [
      `ti528_actor_${randomUUID().replaceAll('-', '')}`,
      `ti528_global_${randomUUID().replaceAll('-', '')}`,
      `ti528_iso_a_${randomUUID().replaceAll('-', '')}`,
      `ti528_iso_b_${randomUUID().replaceAll('-', '')}`,
    ];

    try {
      await db.connect();

      // The RPC is intentionally hidden from both public Data API roles.
      const anonymousDenied = await claim(
        anonymous,
        hashSyntheticActor('anonymous'),
        capabilities[0],
        1,
        1
      );
      expect(anonymousDenied.data).toBeNull();
      expect(anonymousDenied.error).not.toBeNull();

      const email = `ti528-admission-${randomUUID()}@example.test`;
      const password = randomUUID();
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(created.error).toBeNull();
      const userId = created.data.user?.id;
      expect(userId).toBeTruthy();
      if (!userId) throw new Error('Synthetic admission user was not created');
      createdUserIds.push(userId);

      const authenticated = createClient(status.API_URL, status.ANON_KEY, {
        global: { fetch: realFetch },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      expect((await authenticated.auth.signInWithPassword({ email, password })).error).toBeNull();
      const authenticatedDenied = await claim(
        authenticated,
        hashSyntheticActor('authenticated'),
        capabilities[0],
        1,
        1
      );
      expect(authenticatedDenied.data).toBeNull();
      expect(authenticatedDenied.error).not.toBeNull();

      const actorHash = hashSyntheticActor('actor-limit');
      const actorResults = await Promise.all(
        Array.from({ length: 7 }, () => claim(admin, actorHash, capabilities[0], 3, 100))
      );
      actorResults.forEach((result) => expect(result.error).toBeNull());
      const actorAllowed = actorResults
        .map((result) => result.data)
        .filter((result): result is AdmissionClaim => result?.allowed === true);
      const actorDenied = actorResults
        .map((result) => result.data)
        .filter((result): result is AdmissionClaim => result?.allowed !== true);
      expect(actorAllowed).toHaveLength(3);
      expect(actorAllowed.map((result) => result.actor_count).sort((a, b) => Number(a) - Number(b)))
        .toEqual([1, 2, 3]);
      expect(actorDenied).toHaveLength(4);
      expect(actorDenied.every((result) => result.code === 'AI_ACTOR_RATE_LIMIT')).toBe(true);

      // This limiter has no request identifier: a repeated call is a new
      // claim, so no retry-idempotence guarantee is made for this primitive.
      const repeatedFirst = await claim(
        admin,
        hashSyntheticActor('repeat'),
        capabilities[2],
        3,
        100
      );
      const repeatedSecond = await claim(
        admin,
        hashSyntheticActor('repeat'),
        capabilities[2],
        3,
        100
      );
      expect(repeatedFirst.error).toBeNull();
      expect(repeatedSecond.error).toBeNull();
      expect(repeatedFirst.data?.allowed).toBe(true);
      expect(repeatedSecond.data?.allowed).toBe(true);
      expect(repeatedFirst.data?.actor_count).toBe(1);
      expect(repeatedSecond.data?.actor_count).toBe(2);

      // Capability is part of the bucket key. The same actor gets an
      // independent counter for another capability.
      const isolatedAFirst = await claim(
        admin,
        hashSyntheticActor('capability-isolation'),
        capabilities[2],
        3,
        100
      );
      const isolatedASecond = await claim(
        admin,
        hashSyntheticActor('capability-isolation'),
        capabilities[2],
        3,
        100
      );
      const isolatedB = await claim(
        admin,
        hashSyntheticActor('capability-isolation'),
        capabilities[3],
        3,
        100
      );
      expect(isolatedAFirst.error).toBeNull();
      expect(isolatedASecond.error).toBeNull();
      expect(isolatedB.error).toBeNull();
      expect(isolatedAFirst.data?.actor_count).toBe(1);
      expect(isolatedASecond.data?.actor_count).toBe(2);
      expect(isolatedB.data?.actor_count).toBe(1);

      const globalResults = await Promise.all(
        Array.from({ length: 10 }, (_, index) =>
          claim(admin, hashSyntheticActor(`global-${index}`), capabilities[1], 100, 4)
        )
      );
      globalResults.forEach((result) => expect(result.error).toBeNull());
      const globalAllowed = globalResults
        .map((result) => result.data)
        .filter((result): result is AdmissionClaim => result?.allowed === true);
      const globalDenied = globalResults
        .map((result) => result.data)
        .filter((result): result is AdmissionClaim => result?.allowed !== true);
      expect(globalAllowed).toHaveLength(4);
      expect(globalAllowed.map((result) => result.global_count).sort((a, b) => Number(a) - Number(b)))
        .toEqual([1, 2, 3, 4]);
      expect(globalDenied).toHaveLength(6);
      expect(globalDenied.every((result) => result.code === 'AI_GLOBAL_RATE_LIMIT')).toBe(true);
    } finally {
      // Each capability is unique to this run; remove only this test's
      // hashed buckets and leave any other local qualification untouched.
      try {
        await db.query('delete from public.ai_rate_limit_buckets where capability = any($1::text[])', [capabilities]);
      } finally {
        for (const userId of createdUserIds) {
          await admin.auth.admin.deleteUser(userId);
        }
        await db.end();
      }
    }
  }, 120000);
});
