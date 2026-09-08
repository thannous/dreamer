const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sql = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20260909020000_journal_import_grants.sql'), 'utf8');
test('grant lifetime and identity are server controlled', () => {
  assert.match(sql, /clock_timestamp\(\) \+ interval '15 minutes'/);
  assert.match(sql, /references auth.users\(id\) on delete cascade/);
  assert.match(sql, /g.owner_uid = owner_id and g.destination_client_id = client_id/);
  assert.match(sql, /grant_row.expires_at <= clock_timestamp\(\)/);
  assert.match(sql, /grant_row.revoked_at is not null/);
  assert.match(sql, /grant_row.source_client_id and product = 'journal'/);
  assert.doesNotMatch(sql, /in \('legacy'/);
});
test('opaque cursor stores boundaries and no copied dream content', () => {
  const schema = sql.slice(sql.indexOf('create table app_authorization_private.journal_import_cursors'), sql.indexOf('revoke all'));
  assert.match(schema, /end_id bigint/);
  assert.match(schema, /next_cursor uuid/);
  assert.doesNotMatch(schema, /jsonb|transcript|response/);
  assert.match(sql, /for share of g/);
  assert.match(sql, /grant_id = grant_row.id for update/);
  assert.match(sql, /d.id = any\(page_ids\)/);
  assert.match(schema, /cardinality\(selected_row_ids\) <= 200/);
  assert.match(sql, /array_agg\(page.id order by page.id\)/);
  const afterLock = sql.slice(sql.indexOf('grant_id = grant_row.id for update'));
  assert.equal((afterLock.match(/grant_row.expires_at <= clock_timestamp\(\)/g) || []).length, 2);
});
test('projection excludes media and interpretation', () => {
  const projection = sql.slice(sql.indexOf("'id', d.id::text"), sql.indexOf('into items from'));
  for (const key of ['clientRequestId', 'revision', 'createdAt', 'transcript']) assert.ok(projection.includes(key));
  assert.doesNotMatch(projection, /image|audio|interpretation|analysis|health/i);
  assert.match(sql, /p_limit > 200/);
  assert.match(sql, /cardinality\(p_selected_ids\) > 10000/);
});
