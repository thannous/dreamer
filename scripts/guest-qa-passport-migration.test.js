'use strict';
/* global __dirname, describe, expect, it */

const fs = require('fs');
const path = require('path');

const migrationsDir = path.resolve(__dirname, '..', 'supabase', 'migrations');
const migrationName = fs.readdirSync(migrationsDir).find((name) =>
  name.endsWith('_add_guest_qa_passports.sql')
);

describe('guest QA passport database contract', () => {
  const readSql = () => {
    if (!migrationName) return '';
    return fs.readFileSync(path.join(migrationsDir, migrationName), 'utf8').toLowerCase();
  };

  it('keeps passport and paid-call audit state outside exposed schemas', () => {
    const sql = readSql();

    expect(sql).toContain('create schema if not exists qa_private');
    expect(sql).toContain('create table qa_private.guest_passports');
    expect(sql).toContain('create table qa_private.guest_paid_call_claims');
    expect(sql).toContain('force row level security');
    expect(sql).toContain('revoke all on schema qa_private from public, anon, authenticated');
  });

  it('exposes only service-role RPCs with fixed search paths', () => {
    const sql = readSql();

    expect(sql).toContain('create or replace function public.enroll_guest_qa_passport');
    expect(sql).toContain('create or replace function public.resolve_guest_qa_passport');
    expect(sql).toContain('create or replace function public.claim_guest_qa_paid_call');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql).toContain('to service_role');
  });

  it('enforces the accepted QA policy and idempotent paid-call claims', () => {
    const sql = readSql();

    expect(sql).toContain('p_valid_hours integer default 24');
    expect(sql).toContain('p_daily_reset_limit integer default 3');
    expect(sql).toContain('p_daily_paid_call_limit integer default 10');
    expect(sql).toContain('unique (operator_user_id, enrollment_request_id)');
    expect(sql).toContain('primary key (passport_id, capability, request_key)');
    expect(sql).toContain("'quotasubject', 'qa:' || v_active.id::text");
    expect(sql).toContain('and p.fingerprint_hash = p_fingerprint');
  });
});
