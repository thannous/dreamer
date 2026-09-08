const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260909010000_scope_oauth_product_access.sql'), 'utf8');
const sources = require('./rpc-sources.json');
function definition(text, name) {
  return text.match(new RegExp('create or replace function public\\.' + name + '\\([\\s\\S]*?\\n\\$\\$;'))[0];
}
for (const [name, source, product] of sources) {
  const isInvoker = name === 'get_lucid_trainer_entities';
  test(`${name}: ${isInvoker ? 'unchanged invoker relies on restricted owner rows' : 'leading scope guard changes only the final RPC body'}`, () => {
    let original = definition(fs.readFileSync(path.join(root, 'supabase/migrations', source), 'utf8'), name);
    if (name === 'sync_lucid_trainer_mutations') {
      original = original.replace("'weekly_review')", "'weekly_review', 'dream_sign', 'dream_atlas')");
    }
    // Explicit correction of the historical duplicate RAISE message option.
    if (name === 'get_effective_subscription_tier') {
      assert.ok(original.includes("raise exception 'insufficient_privilege'"));
      original = original.replace("raise exception 'insufficient_privilege'\n      using errcode = '42501', message = 'Cannot read another user''s subscription tier';", "raise exception using errcode = '42501',\n      message = 'Cannot read another user''s subscription tier';");
    }
    const actual = definition(migration, name);
    if (isInvoker) {
      assert.equal(actual, original);
      assert.match(actual, /security invoker/);
      for (const table of ['lucid_trainer_entities', 'lucid_trainer_reset_fences']) {
        assert.ok(actual.includes('from public.' + table));
        assert.ok(migration.includes('create policy app_product_scope on public.' + table));
      }
      assert.equal((actual.match(/where [ef]\.user_id = \(select auth\.uid\(\)\)/g) || []).length, 2);
      return;
    }
    assert.match(original, /security definer/);
    assert.ok(original.includes('\nbegin\n'), 'guard insertion point must exist');
    const guard = `\n  if coalesce(auth.role(), '') <> 'service_role'\n     and public.current_app_product() not in ('legacy', '${product}') then\n    raise exception 'Application scope does not allow ${product} access' using errcode = '42501';\n  end if;\n`;
    const guarded = original.replace('\nbegin\n', '\nbegin' + guard);
    assert.notEqual(guarded, original, 'scope guard must actually change the function');
    assert.equal(actual, guarded);
  });
}
test('registry is server controlled and resolution never reads a caller supplied product', () => {
  assert.match(migration, /revoke all on schema app_authorization_private from public, anon, authenticated/);
  assert.match(migration, /revoke all on table app_authorization_private.oauth_clients from public, anon, authenticated/);
  const resolver = definition(migration, 'current_app_product');
  assert.match(resolver, /claims jsonb := auth.jwt\(\)/);
  assert.match(resolver, /jsonb_typeof\(claims -> 'client_id'\) is distinct from 'string'/);
  assert.doesNotMatch(resolver, /user_metadata|app_metadata|request.headers/);
  assert.doesNotMatch(migration, /insert into app_authorization_private.oauth_clients/i);
});
test('product policies restrict rather than replace existing ownership', () => {
  assert.equal((migration.match(/as restrictive for all to authenticated/g) || []).length, 4);
  assert.doesNotMatch(migration, /drop policy|alter policy/i);
});
