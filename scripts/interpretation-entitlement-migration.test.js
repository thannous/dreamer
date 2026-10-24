'use strict';
/* global __dirname, describe, expect, it */

const fs = require('fs');
const path = require('path');

const migrationsDir = path.resolve(__dirname, '..', 'supabase', 'migrations');
const migrationName = fs.readdirSync(migrationsDir).find((name) =>
  name.endsWith('_unify_interpretation_entitlements_and_device_risk.sql')
);

describe('interpretation entitlement and device risk database contract', () => {

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

describe('Plus chat ceiling', () => {
  // The site copy is checked against constants/limits.ts; this keeps the
  // database, which enforces the ceiling, on the same number.
  it('is the same in the latest migration, the app quotas and the database contract', () => {
    const { readAppQuotas } = require('./check-content-release-gates');
    const latest = {};
    for (const name of fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort()) {
      const sql = fs.readFileSync(path.join(migrationsDir, name), 'utf8').toLowerCase();
      for (const [, tier, limit] of sql.matchAll(/\('(plus|premium)', 'monthly', 'messages_per_dream', (\d+|null)\)/g)) {
        latest[tier] = limit === 'null' ? null : Number(limit);
      }
    }
    const manifest = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '..', 'supabase', 'db-contract.manifest.json'), 'utf8')
    );
    const contract = (tier) => manifest.requiredSeedRows.find(
      (row) => row.table === 'quota_limits' && row.match.tier === tier && row.match.quota_type === 'messages_per_dream'
    ).expect.quota_limit;
    const ceiling = readAppQuotas().plus.messagesPerDream;

    expect(ceiling).toBe(100);
    expect(latest).toEqual({ plus: ceiling, premium: ceiling });
    expect({ plus: contract('plus'), premium: contract('premium') }).toEqual({ plus: ceiling, premium: ceiling });

    // The chat history must keep every user message a Plus conversation may contain.
    const chatContext = fs.readFileSync(
      path.resolve(__dirname, '..', 'supabase', 'functions', 'api', 'services', 'chatContext.ts'),
      'utf8'
    );
    expect(Number(chatContext.match(/MAX_CHAT_USER_MESSAGES = (\d+)/)[1])).toBe(ceiling);
    // The device cache must keep every user turn and its reply.
    const storage = fs.readFileSync(path.resolve(__dirname, '..', 'services', 'storageServiceReal.ts'), 'utf8');
    expect(Number(storage.match(/MAX_CHAT_HISTORY_FOR_STORAGE = (\d+)/)[1])).toBe(2 * ceiling);
  });
});
