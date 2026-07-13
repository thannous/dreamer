'use strict';
/* global __dirname, describe, expect, it */

const fs = require('fs');
const path = require('path');

const migrationsDir = path.resolve(__dirname, '..', 'supabase', 'migrations');
const migrationName = fs.readdirSync(migrationsDir).find((name) =>
  name.endsWith('_add_idempotent_guest_analysis_quota.sql')
);
const sql = fs.readFileSync(path.join(migrationsDir, migrationName), 'utf8').toLowerCase();

describe('analysis quota idempotency database contract', () => {
  it('keys guest claims by installation and analysis request', () => {
    expect(sql).toContain('primary key (fingerprint_hash, analysis_request_id)');
    expect(sql).toContain('for update');
    expect(sql).toContain("'duplicate', true");
    expect(sql).toContain("'claimed', false");
  });

  it('increments quota only after recording a new claim', () => {
    const claimInsert = sql.indexOf('insert into public.guest_analysis_quota_claims');
    const quotaUpdate = sql.indexOf('update public.guest_usage');

    expect(claimInsert).toBeGreaterThan(-1);
    expect(quotaUpdate).toBeGreaterThan(claimInsert);
    expect(sql).toContain('analysis_count = analysis_count + 1');
  });

  it('keeps the claim table and rpc server-only', () => {
    expect(sql).toContain('alter table public.guest_analysis_quota_claims enable row level security');
    expect(sql).toContain(
      'revoke all on table public.guest_analysis_quota_claims from public, anon, authenticated'
    );
    expect(sql).toContain(
      'revoke execute on function public.claim_guest_analysis_quota(text, uuid, integer)'
    );
    expect(sql).toContain(
      'grant execute on function public.claim_guest_analysis_quota(text, uuid, integer)\n  to service_role'
    );
  });
});
