'use strict';
/* global __dirname */
const { describe, it } = require('node:test');
const { expect } = require('expect');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

// Isolation gap: the running Auth journey starts after migration replay. This
// executes the complete migration on pre-existing metadata, including invalid
// values, and checks actual PostgreSQL privileges and FK behavior.
describe('private Apple credentials migration', () => {
  it('backfills, sanitizes legacy writes, denies client access and cascades erasure', { timeout: 30000 }, async () => {
    const db = new PGlite();
    const owner = '00000000-0000-4000-8000-000000000001';
    const other = '00000000-0000-4000-8000-000000000002';
    const inserted = '00000000-0000-4000-8000-000000000003';
    try {
      await db.exec(`
        create role anon; create role authenticated; create role service_role;
        create schema auth;
        create table auth.users(id uuid primary key, raw_app_meta_data jsonb);
        create function auth.jwt() returns jsonb language sql as $$
          select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
        $$;
      `);
      await db.query('insert into auth.users values ($1,$2),($3,$4)', [owner,
        { tier: 'plus', apple_refresh_token: 'legacy-provider-token' }, other,
        { provider: 'email', apple_refresh_token: { malformed: true } }]);
      const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261020001047_protect_apple_refresh_tokens.sql'), 'utf8');
      await db.exec(sql);
      const metadata = await db.query('select raw_app_meta_data from auth.users order by id');
      expect(metadata.rows.map(row => row.raw_app_meta_data)).toEqual([{ tier: 'plus' }, { provider: 'email' }]);
      expect((await db.query('select refresh_token from apple_auth_private.refresh_tokens')).rows).toEqual([{ refresh_token: 'legacy-provider-token' }]);
      const privileges = await db.query(`select role,
        has_schema_privilege(role, 'apple_auth_private', 'usage') as schema_access,
        has_table_privilege(role, 'apple_auth_private.refresh_tokens', 'select') as table_access,
        has_function_privilege(role, 'public.read_apple_refresh_token(uuid)', 'execute') as read_access,
        has_function_privilege(role, 'public.store_apple_refresh_token(uuid,text)', 'execute') as write_access
        from (values ('anon'), ('authenticated')) roles(role)`);
      for (const row of privileges.rows) {
        expect(row).toEqual({ role: row.role, schema_access: false, table_access: false, read_access: false, write_access: false });
      }
      for (const role of ['anon', 'authenticated']) {
        await db.exec(`set role ${role}`);
        try {
          await expect(db.query('select * from apple_auth_private.refresh_tokens')).rejects.toMatchObject({ code: '42501' });
          await expect(db.query('select public.read_apple_refresh_token($1)', [owner])).rejects.toMatchObject({ code: '42501' });
          await expect(db.query('select public.store_apple_refresh_token($1,$2)', [owner, 'forged'])).rejects.toMatchObject({ code: '42501' });
        } finally { await db.exec('reset role'); }
      }
      // An older API writes the former metadata contract: even RETURNING is safe.
      const sanitized = await db.query('update auth.users set raw_app_meta_data = $2 where id=$1 returning raw_app_meta_data', [owner,
        { tier: 'plus', apple_refresh_token: 'legacy-rotated-token' }]);
      expect(sanitized.rows[0].raw_app_meta_data).toEqual({ tier: 'plus' });
      const created = await db.query('insert into auth.users values ($1,$2) returning raw_app_meta_data', [inserted,
        { provider: 'apple', apple_refresh_token: 'created-provider-token' }]);
      expect(created.rows[0].raw_app_meta_data).toEqual({ provider: 'apple' });
      await db.exec(`select set_config('request.jwt.claims','{"role":"service_role"}',false); set role service_role;`);
      try {
        expect((await db.query('select public.read_apple_refresh_token($1) as token', [owner])).rows[0].token).toBe('legacy-rotated-token');
        await db.query('select public.store_apple_refresh_token($1,$2)', [owner, 'new-provider-token']);
        expect((await db.query('select public.read_apple_refresh_token($1) as token', [owner])).rows[0].token).toBe('new-provider-token');
        await expect(db.query('select public.store_apple_refresh_token($1,$2)', [other, ' '])).rejects.toMatchObject({ code: '23514' });
        await db.exec(`select set_config('request.jwt.claims','{"role":"authenticated"}',false)`);
        await expect(db.query('select public.read_apple_refresh_token($1)', [owner])).rejects.toMatchObject({ code: '42501' });
      } finally { await db.exec('reset role'); }
      await db.query('delete from auth.users where id=$1', [owner]);
      expect((await db.query('select count(*)::int as count from apple_auth_private.refresh_tokens where user_id=$1', [owner])).rows[0].count).toBe(0);
    } finally { await db.close(); }
  });
});
