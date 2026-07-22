'use strict';
/* global __dirname, describe, expect, it */

const fs = require('fs');
const path = require('path');

const migrationsDir = path.resolve(__dirname, '..', 'supabase', 'migrations');
const quotaRoutePath = path.resolve(
  __dirname,
  '..',
  'supabase',
  'functions',
  'api',
  'routes',
  'quota.ts'
);
const migrationName = fs.readdirSync(migrationsDir).find((name) =>
  name.endsWith('_unify_interpretation_entitlements_and_device_risk.sql')
);

describe('interpretation entitlement and device risk database contract', () => {
  it('ships the expected migration', () => {
    expect(migrationName).toBeDefined();
  });

  const readSql = () => {
    if (!migrationName) return '';
    return fs.readFileSync(path.join(migrationsDir, migrationName), 'utf8').toLowerCase();
  };

  it('uses interpretations as the only monthly product entitlement', () => {
    const sql = readSql();

    expect(sql).toContain("('guest', 'monthly', 'exploration', null)");
    expect(sql).toContain("('free', 'monthly', 'exploration', null)");
    expect(sql).toContain("('plus', 'monthly', 'exploration', null)");
    expect(sql).toContain("('guest', 'monthly', 'messages_per_dream', 10)");
    expect(sql).toContain("('free', 'monthly', 'messages_per_dream', 10)");
    expect(sql).toContain("('plus', 'monthly', 'messages_per_dream', 20)");
  });

  it('claims guest chat messages once per dream and request', () => {
    const sql = readSql();

    expect(sql).toContain('create table if not exists public.guest_chat_quota_claims');
    expect(sql).toContain('primary key (fingerprint_hash, dream_key, request_id)');
    expect(sql).toContain('create or replace function public.claim_guest_chat_message');
    expect(sql).toContain("'duplicate', true");
    expect(sql).toContain("'claimed', false");
    expect(sql).toContain('grant execute on function public.claim_guest_chat_message(text, text, uuid, integer)\n  to service_role');
  });

  it('scores combined integrity and account-creation velocity signals', () => {
    const sql = readSql();

    expect(sql).toContain('create table if not exists public.device_account_links');
    expect(sql).toContain('integrity_provider');
    expect(sql).toContain('account_created_at');
    expect(sql).toContain("interval '24 hours'");
    expect(sql).toContain("interval '30 days'");
    expect(sql).toContain("'risk_score'");
    expect(sql).toContain("'risk_level'");
    expect(sql).toContain('create or replace function public.register_device_account_link');
  });

  it('does not treat a platform label as an Apple integrity proof', () => {
    const route = fs.readFileSync(quotaRoutePath, 'utf8');

    expect(route).toContain("platform === 'android' ? 'play_integrity' : 'unknown'");
    expect(route).toContain("integrityVerified = platform === 'android'");
    expect(route).not.toContain("platform === 'ios'\n        ? 'app_attest'");
  });

  it('removes the legacy device-only hard block from guest claims', () => {
    const sql = readSql();

    expect(sql).toContain('create or replace function public.claim_guest_analysis_quota');
    expect(sql).toContain('create or replace function public.increment_guest_quota');
    expect(sql).not.toContain('if upgraded then');
    expect(sql).not.toContain('if v_is_upgraded then');
  });

  it('keeps all abuse-control tables and functions server-only', () => {
    const sql = readSql();

    expect(sql).toContain('alter table public.device_account_links enable row level security');
    expect(sql).toContain('alter table public.guest_chat_quota_claims enable row level security');
    expect(sql).toContain('revoke all on table public.device_account_links from public, anon, authenticated');
    expect(sql).toContain('revoke all on table public.guest_chat_quota_claims from public, anon, authenticated');
    expect(sql).toContain('set search_path = \'\'');
  });
});
