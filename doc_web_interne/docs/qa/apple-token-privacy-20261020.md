# Apple refresh-token privacy — 2026-10-20

Scope: prevent Apple provider refresh tokens from reaching application clients
through Supabase user/session responses or new JWTs. Implementation and local
qualification only; production migration/deployment and provider rotation have
not been performed. Integration owner: `codex/apple-token-private`.

## Storage and compatibility

`20261020001047_protect_apple_refresh_tokens.sql` creates
`apple_auth_private.refresh_tokens`, outside the exposed Data API schemas. It has
RLS enabled, no client/service-role table or schema grants, and a cascading user
foreign key. Two fixed-search-path, service-role-only RPCs store/read credentials
for the Edge API. They check the signed role as well as SQL execute privileges.
The request's verified user ID selects the owner; a body-supplied ID is ignored.

The migration atomically moves valid existing `raw_app_meta_data.apple_refresh_token`
values and removes that key, including invalid values, without changing other
metadata. A BEFORE Auth trigger also captures and strips future legacy metadata
writes during a rolling deployment. The deferred FK permits BEFORE INSERT to
protect a newly created Auth user. A failed private write rolls back the metadata
write, rather than exposing a credential.

`POST /auth/apple-token` now writes only the private RPC and returns `{ ok: true }`.
`DELETE /account` loads the private credential before Apple revocation. Missing
credentials/storage failure/provider rejection prevent Auth-user deletion; a
successful deletion cascades to the private credential. Credential-bearing error
messages are not logged or returned.

## Validation and limits

The API journey uses real disposable Supabase Auth, PostgreSQL and PostgREST,
including signed access tokens and refresh. Only the Apple exchange/revocation
is synthetic. It invokes the actual application router and affected handlers over
loopback HTTP; it does not qualify Apple's real service or an iOS device.

Assertions cover legacy metadata insert/update, fresh user reads, password login,
JWT claims before/after refresh and after API credential storage; exact 401/403
RPC permission failures for anonymous/owner/other-user clients; non-exposed schema
and table errors; verified-owner storage; provider failure without secret echo;
failed-revocation account preservation, recovery and deletion with FK erasure.

The migration test executes the complete SQL on pre-existing metadata in PGlite,
checks actual role privileges and denials, safe SQL RETURNING, service-only
read/write, malformed input and cascading deletion. This isolated control covers
the backfill state that the already-migrated Auth journey cannot exercise. The
focused Deno tests cover provider/private-storage failures without real provider
credentials or a destructive service outage.

One initial test incorrectly expected GoTrue's service-role admin write response
to reload the trigger-modified row. GoTrue retains that request object internally;
the application must not forward it. The journey checks fresh persisted reads and
all public Auth/session/JWT outputs instead. A second run reached the deletion
check but exposed an incomplete synthetic Apple identity; its provider ID, identity
data and timestamps now match the real identity schema. Neither failed run is
counted as passed evidence.

Commands (Node 24.19.0, Deno 2.7.14, Supabase CLI 2.121.0):

```sh
mise exec -- npm run test:apple-auth:db
(cd supabase/functions && mise exec -- deno test --frozen --allow-env --allow-net=deno.land api/routes/account.test.ts api/routes/appleAuthToken.test.ts)
E2E_SUPABASE_HOME=/Users/timax/Projects/noctalia/test-results/backend-e2e-cli-home mise exec -- npm run test:e2e:backend -- e2e/backend/apple-token-privacy.spec.ts
mise exec -- npm run verify:pr
```

The canonical API report is ignored `test-results/e2e-backend-results.json` with
source revision, dirty marker, environment, rerun and individual test result;
`test-results/apple-token-privacy-initial-failure.json` retains the initial
safe diagnostic. The journey runs the security advisors on its owned database
and saves their local output in `test-results/apple-token-security-advisors.json`;
pre-existing findings must be distinguished from the new Apple objects. The final PR records the committed revision and local verification
receipt. No passwords, session tokens or real provider credentials are tracked.

## Production rollout dependency

After owner authorization, check applied migration history and actual schema;
stop on divergence. Apply this migration before deploying the updated `api`
function. The trigger protects older writers while the API is rolled forward.
Do not roll back to metadata storage: the previous API's account deletion reader
will no longer find a migrated credential, so complete the forward deployment.
No app rebuild or new client-visible secret is needed for this backend change.

New Auth reads and freshly issued/refreshed JWTs are clean after migration.
Previously issued JWTs and copied secrets cannot be retroactively sanitized.
A production incident response must separately assess and revoke/rotate any
previously exposed Apple refresh tokens; removing metadata or signing out a
Supabase session does not revoke the provider credential itself. No such provider
or production action is claimed here.
