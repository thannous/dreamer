'use strict';
/* global __dirname */
const { describe, it } = require('node:test');
const { expect } = require('expect');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

// Isolation gap: no native E2E can safely force two valid Apple assertions
// against one challenge across Edge instances. Exercise the actual SQL RPCs.
describe('iOS App Attest challenge completion', () => {
  it('consumes only proven challenges and rejects a second, higher-counter assertion on the same challenge', { timeout: 30000 }, async () => {
    const db = new PGlite();
    const keyId = 'A'.repeat(43) + '=';
    const fingerprint = 'a'.repeat(64);
    const expiry = new Date(Date.now() + 60_000).toISOString();
    const attest = async (digest, hash = fingerprint) => (await db.query(
      'select public.complete_ios_guest_app_attestation($1,$2,$3,$4,$5,$6,$7,$8) as ok',
      [digest, expiry, keyId, hash, 'verified-public-key', 'verified-receipt',
        'development', 'ABCDEFGHIJ.com.tanuki75.noctalia'],
    )).rows[0].ok;
    const assert = async (digest, counter, hash = fingerprint) => (await db.query(
      'select public.complete_ios_guest_app_assertion($1,$2,$3,$4,$5) as ok',
      [digest, expiry, keyId, hash, counter],
    )).rows[0].ok;
    try {
      await db.exec('create role anon; create role authenticated; create role service_role;');
      const sql = fs.readFileSync(path.join(__dirname,
        '../supabase/migrations/20261021201025_ios_guest_app_attest.sql'), 'utf8');
      await db.exec(sql);
      await db.exec('set role service_role');
      try {
        expect(await attest('1'.repeat(64))).toBe(true);
        expect(await attest('1'.repeat(64))).toBe(false);
        expect(await assert('2'.repeat(64), 1)).toBe(true);
        // This is a fresh signature with a larger counter, but it used the
        // already consumed signed challenge. The quota token must not mint.
        expect(await assert('2'.repeat(64), 2)).toBe(false);
        expect(await assert('3'.repeat(64), 2)).toBe(true);
        expect(await assert('4'.repeat(64), 3, 'b'.repeat(64))).toBe(false);
        // A rejected fingerprint does not burn the valid owner's challenge.
        expect(await assert('4'.repeat(64), 3)).toBe(true);
        await expect(db.query('select * from public.ios_guest_app_attest_used_challenges'))
          .rejects.toMatchObject({ code: '42501' });
      } finally { await db.exec('reset role'); }
      const state = (await db.query(
        'select assertion_counter from public.ios_guest_app_attest_keys where key_id=$1', [keyId],
      )).rows[0];
      expect(Number(state.assertion_counter)).toBe(3);
      expect((await db.query('select count(*)::int as n from public.ios_guest_app_attest_used_challenges'))
        .rows[0].n).toBe(4);
      await db.exec('set role anon');
      try {
        await expect(db.query(
          'select public.complete_ios_guest_app_assertion($1,$2,$3,$4,$5)',
          ['5'.repeat(64), expiry, keyId, fingerprint, 3],
        )).rejects.toMatchObject({ code: '42501' });
      } finally { await db.exec('reset role'); }
    } finally { await db.close(); }
  });
});
