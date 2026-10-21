'use strict';
/* global __dirname */
const { describe, it } = require('node:test');
const { expect } = require('expect');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const migration = (name) =>
  fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', `${name}.sql`), 'utf8');
const actor = 'a'.repeat(64);
const otherActor = 'b'.repeat(64);

// Synthetic PostgreSQL run of the rolling 24-hour AI budget: no hosted DB, no credentials.
describe('daily AI request budget migration', () => {
  it('admits up to the daily limit per actor and capability, then says when one frees up', { timeout: 30000 }, async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        create role anon; create role authenticated; create role service_role; create role supabase_admin;
        create schema auth;
        create function auth.jwt() returns jsonb language sql as $$
          select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
        $$;
      `);
      await db.exec(migration('20260722124500_add_ai_sync_admission_control'));
      await db.exec(migration('20261021170000_add_daily_ai_request_budget'));
      await db.exec(`select set_config('request.jwt.claims', '{"role":"service_role"}', false)`);
      const claim = async (who, capability, limit) =>
        (await db.query('select public.claim_ai_daily_budget($1, $2, $3) as result', [who, capability, limit])).rows[0].result;

      // An old hour outside the window never counts.
      await db.query(`insert into public.ai_rate_limit_buckets (actor_hash, capability, window_started_at, request_count)
        values ($1, 'transcribe_day', date_trunc('hour', clock_timestamp()) - interval '25 hours', 500)`, [actor]);

      const admitted = [];
      for (let index = 0; index < 30; index += 1) admitted.push(await claim(actor, 'transcribe', 30));
      expect(admitted.every((result) => result.allowed === true)).toBe(true);
      expect(admitted[29].daily_count).toBe(30);

      const refused = await claim(actor, 'transcribe', 30);
      expect(refused).toMatchObject({ allowed: false, code: 'AI_DAILY_LIMIT', daily_limit: 30, daily_count: 30 });
      // Every request of this window is in the current hour: it frees up 24 hours after that hour began.
      expect(refused.retry_after_seconds).toBeGreaterThan(82800);
      expect(refused.retry_after_seconds).toBeLessThanOrEqual(86400);

      expect((await claim(otherActor, 'transcribe', 30)).allowed).toBe(true);
      expect((await claim(actor, 'categorize_dream', 30)).allowed).toBe(true);

      // Daily buckets never touch the 10-minute windows of the same actor.
      const windows = await db.query(
        `select count(*)::integer as n from public.ai_rate_limit_buckets where actor_hash = $1 and capability = 'transcribe'`,
        [actor]
      );
      expect(windows.rows[0].n).toBe(0);

      const privileges = await db.query(`select role,
        has_function_privilege(role, 'public.claim_ai_daily_budget(text,text,integer)', 'execute') as can_execute
        from (values ('anon'), ('authenticated'), ('service_role')) roles(role) order by role`);
      expect(privileges.rows).toEqual([
        { role: 'anon', can_execute: false },
        { role: 'authenticated', can_execute: false },
        { role: 'service_role', can_execute: true },
      ]);
      await db.exec(`select set_config('request.jwt.claims', '{"role":"authenticated"}', false)`);
      await expect(claim(actor, 'transcribe', 30)).rejects.toMatchObject({ code: '42501' });
    } finally {
      await db.close();
    }
  });
});
