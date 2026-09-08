# TI-560: bounded SQL product guards

The migration resolves a signed JWT `client_id` through an empty, private,
server-owned registry. Only `journal` and `lucid` are recognized products. A
missing claim returns `legacy`; a present null, non-string, blank or unregistered
claim returns `unknown`. Request headers, app variants, user metadata and claimed
product names are never authority. The no-argument resolver exposes only the
current token's classification, not registry contents.

Legacy remains deliberately compatible with both products. This is **not** an
isolation guarantee for existing unscoped sessions. No OAuth provider is enabled,
no client registration is populated, and no production rollout occurs here.

Restrictive policies add product scope to existing owner policies on dreams,
Lucid entities/reset fences and the private dream-images bucket. They do not
replace ownership or permit another user's data. Other Storage buckets retain
existing policy behavior. Existing service-role workers retain BYPASSRLS.

Eight SECURITY DEFINER RPCs receive a leading product check because they bypass
table RLS. The ninth RPC, `get_lucid_trainer_entities`, remains unchanged: it is
SECURITY INVOKER and reads the two Lucid tables through their restrictive product
policies and existing owner policies. It has no explicit procedural guard. Their final signatures, defaults, search paths, algorithmic
bodies and grants remain unchanged except for the explicit ownership-error correction below. The subscription helper explicitly permits
trusted service-role calls. Lucid's two subsequent entity allow-list migrations
are incorporated into the copied final definition.

Run `node --test scripts/ti560/sql-guards.test.cjs`. The eleven source checks
include exact definition comparison for eight actual guard insertions (a missing
insertion point fails), plus unchanged invoker definition and protected-table
source assertions. Runtime RLS enforcement still requires database tests.
They are mechanical regression evidence, **not** database authorization proof.
A disposable-database owner must apply the migration and test actual signed
legacy/Journal/Lucid/unknown tokens against table reads/writes, RPCs and Storage.
Existing-client and worker regression cases remain necessary.

## Additional surfaces to verify

- Read-only disposable DB grant audit: `subscription_state` and `quota_usage`
  have no authenticated SELECT/INSERT/UPDATE/DELETE grants. Their current direct
  reads are denied. Reassess product policies before future grants are added.
- The audited default TRUNCATE/REFERENCES/TRIGGER grants on dreams, Lucid
  entities/reset fences, quota usage and subscription state/events are revoked
  for anon/authenticated. These privileges have no application use. This is least
  privilege hardening; no PostgREST truncate exploit was demonstrated.
- `quota_limits` is intentionally public configuration, not private journal data.
- Analysis quota claims, analysis job admission/completion, guest quota mutation,
  worker leases and subscription mutation RPCs have service-only grants. Edge
  authorization must run before those trusted calls; these guards do not secure
  an Edge handler that ignores product scope.
- Lucid sync receipts are service-only; verify live grants still match migrations.
- Existing signed Storage URLs remain valid for their original lifetime; the
  new row policy is not a revocation mechanism for already issued URLs.
- Product-specific account deletion and future consent/import RPCs are outside
  this bounded migration. Global account deletion must not be mistaken for a
  Lucid-only deletion operation.

Live executable RPC audit also found only trigger-only routines and the invoker
`serialize_dream_for_sync(dreams)` helper outside this guarded list. The latter
serializes its supplied composite argument and does not load privileged rows.
No Lucid RPC calls the Journal subscription helper. Existing shared commercial
client behavior remains separate from server Journal quota authorization.


## Final verification and one baseline correction

The real OAuth matrix passed on the disposable database, including positive and
negative table/RPC/Storage paths and refresh. The historical subscription helper
raised an invalid duplicate MESSAGE option on foreign-owner access. This copied
definition now uses `RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = ...`;
the real regression expects HTTP403 / SQL42501, not SQL42601. The mechanical
comparison explicitly allows and asserts this one correction. The legacy
regression remains green: 55 contracts and six real tests.

The Edge router resolves scoped tokens through `current_app_product()` after
Auth validation and applies an explicit route allow-list. Unknown clients,
unclassified routes, global account/analytics deletion, Apple credential storage
and technical reconciliation are refused. Lucid scoped tokens cannot use Journal
quota/subscription routes. Invalid scoped bearers never fall back to guest work;
resolver failure returns503. Guest and unscoped legacy paths retain their existing
checks. These rollout limitations must be resolved before switching distributed
clients to the new identity. Ten Edge/auth tests pass; no Edge deployment is
claimed by that unit-level evidence.
