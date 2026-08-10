'use strict';
/* global __dirname, describe, expect, it */

const fs = require('node:fs');
const path = require('node:path');

const migrationsDir = path.resolve(__dirname, '..', 'supabase', 'migrations');
const migrationName = fs.readdirSync(migrationsDir).find((name) =>
  name.endsWith('_harden_deleted_user_dream_image_access.sql')
);

const readMigration = () => {
  if (!migrationName) return '';
  return fs.readFileSync(path.join(migrationsDir, migrationName), 'utf8').toLowerCase();
};

const policyNames = [
  'authenticated read own dream-images',
  'authenticated upload to dream-images',
  'authenticated update dream-images',
  'authenticated delete dream-images',
];

describe('deleted-user dream image access migration', () => {
  it('ships a private auth-user existence guard with a fixed search path', () => {
    const sql = readMigration();

    expect(migrationName).toBeDefined();
    expect(sql).toContain('create schema if not exists auth_guard_private');
    expect(sql).toContain('security definer');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain('from auth.users as auth_user');
    expect(sql).toContain('where auth_user.id = (select auth.uid())');
    expect(sql).toContain(
      'revoke all on function auth_guard_private.current_auth_user_exists() from public, anon'
    );
    expect(sql).toContain(
      'grant execute on function auth_guard_private.current_auth_user_exists() to authenticated'
    );
  });

  it.each(policyNames)('keeps ownership checks and adds the guard to %s', (policyName) => {
    const sql = readMigration();
    const policy = sql.match(
      new RegExp(`alter policy "${policyName}"[\\s\\S]*?;`, 'i')
    )?.[0] ?? '';

    expect(policy).toContain("bucket_id = 'dream-images'");
    expect(policy).toContain("(select auth.uid())::text = split_part(name, '/', 1)");
    expect(policy).toContain('(select auth_guard_private.current_auth_user_exists())');
  });

  it('does not require a new JWT claim or revoke sessions for existing users', () => {
    const sql = readMigration();

    expect(sql).not.toContain('session_id');
    expect(sql).not.toContain('auth.sessions');
    expect(sql).not.toContain('signout');
  });
});
