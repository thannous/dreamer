'use strict';
// Explicitly local, synthetic-only fixture for TI-528/TI-531. Never reads repo .env.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { readLocalStatus } = require('./local-config.cjs');
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');
async function main() {
  const status = readLocalStatus(process.argv[2]);
  const output = process.argv[3];
  if (!output) throw new Error('Private output file required');
  if (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink()) throw new Error('Refusing credential symlink');
  const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const db = new Client({ connectionString: status.DB_URL });
  await db.connect();
  try {
  const accounts = [];
  for (const label of ['a', 'b']) {
    const email = `ti528-${label}-${crypto.randomUUID()}@example.test`;
    const password = crypto.randomBytes(24).toString('base64url');
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    const id = data.user.id;
    await db.query(`insert into public.dreams (user_id, transcript, title, interpretation, shareable_quote, dream_type, created_at, client_request_id)
      select $1, 'TI528 synthetic transcript ' || n, 'TI528 synthetic dream ' || n, '', '', 'Symbolic Dream',
      '2026-01-01T08:00:00Z'::timestamptz, gen_random_uuid() from generate_series(1,$2::integer) n`, [id, label === 'a' ? 2501 : 1]);
    accounts.push({ label, id, email, password });
  }
  fs.writeFileSync(output, JSON.stringify({ url: status.API_URL, anonKey: status.ANON_KEY, accounts }, null, 2), { mode: 0o600 });
  fs.chmodSync(output, 0o600);
  console.log('Created synthetic A=2501/B=1 accounts; client credentials written to private fixture file.');
  } finally { await db.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
