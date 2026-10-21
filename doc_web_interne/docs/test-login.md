# Reusable QA identity (persistent Supabase test branch)

Owner intent: dedicated, stable, non-personal accounts that remain available
between runs. A run logs in to existing identities; it does not replace them.
The disposable native backend remains separate, including isolated signup and
account-deletion fixtures.

## Current state and provisioning boundary

Inspection on 2026-10-21 found no `.env.test.local` or saved branch sessions in
this isolated checkout. The committed `scripts/test-supabase-targets.json` is
empty. Read-only Supabase project/branch metadata returned the two production
projects (Noctalia and Shapier) and **no Noctalia test branch**. No production
users, credentials or data were queried. No hosted identity is available or
qualified by this PR; hosted branch journeys are blocked before network access.

The existing owner choice is a **persistent branch `e2e`** of Noctalia, with its
own project ref/keys, schema only and no production data. Creating it has cost
and access effects: provisioning is pending, not performed. Before that action,
confirm the organization, obtain its current Supabase branch cost quote and
approve that cost, the QA target and the account domain. Do not infer cost
approval from the general E2E migration request.

Prepared plan for that decision:

1. Create persistent `e2e` under the approved organization/project, without data
   copying and without enabling automatic production deployment. Verify its
   distinct ref, persistence and current service health.
2. Reconcile the QA schema with this checkout's migrations. Historical cron jobs
   contain production function URLs: neutralize/disable them in QA before enabling
   work; keep the Vault reconciliation secret and `REVENUECAT_*` absent. Inspect
   branch-inherited Edge Functions; deploy this checkout's functions **to QA only**
   if a journey needs them. The current saved-session/data cases do not.
3. Apply [account-leases.sql](../../scripts/qa/account-leases.sql) **only to the
   approved QA database**. It is deliberately outside `supabase/migrations` and
   never included in production releases. Normal runs need only the existing
   publishable/anon key, password login, own-row Data API and these own-row lease
   grants. There is no runner admin credential or new admin key.
4. Use `e2e+free@<approved-QA-domain>` and `e2e+premium@<approved-QA-domain>`.
   `qa.noctalia.app` is a candidate requiring domain-owner confirmation, not an
   existing verified mailbox/domain claim. Use a dedicated QA mailbox/vault;
   never a personal account. Initialize missing identities once with the existing
   QA owner's admin credential, assign the initial free/Plus tiers, then remove
   that credential from the normal runner environment. Verify and pin both Auth
   UUIDs. Re-running the seed preserves existing passwords, tier and data.
5. Review the real QA ref into the committed allowlist. Store credentials in the
   owner's approved password vault and this checkout's ignored `.env.test.local`
   with mode 0600; directories/sessions are private. Do not copy another checkout's
   secrets or put a value in a command, chat, report, screenshot or Git.
6. Run the preflight and two hosted TesterArmy cases; verify the same server Auth
   UUIDs and pre-existing data survive subsequent runs. Only after that can the
   hosted identity be described as reusable. Availability still depends on the
   branch, Auth settings, tier validity and credentials: no perpetual uptime
   promise follows from a local proof.

## Guard and configuration

Every hosted entry point uses `runGuarded` before network requests. It refuses
the production ref `usuyppgsmmowzizhaoqj`/public key even if allowlisted, an empty
or invalid allowlist, any other ref, a noncanonical URL, a mismatched ref/JWT,
wrong key roles and account addresses outside the two dedicated aliases. No
runtime override exists. URLs are exactly `https://<20-character-ref>.supabase.co`
(with optional trailing slash), with no port, path, credentials or custom host.
The guarded fetch refuses other origins and redirects. The allowlist is resolved
relative to the script, never the working directory. A local target cannot pass
this hosted guard; only the owned native integration runner uses loopback.

`.env.test.example` defines names only. `.env.test.local` is ignored and local to
this checkout; only its `E2E_*` fields are read:

| Variable | Purpose |
| --- | --- |
| `E2E_SUPABASE_URL`, `E2E_SUPABASE_PROJECT_REF` | Approved QA URL and the same distinct ref |
| `E2E_SUPABASE_ANON_KEY` | QA publishable key or legacy anon JWT; never an admin key |
| `E2E_ACCOUNT_DOMAIN` | Verified dedicated QA domain |
| `E2E_FREE_PASSWORD`, `E2E_PREMIUM_PASSWORD` | Existing dedicated account passwords, kept private |
| `E2E_FREE_USER_ID`, `E2E_PREMIUM_USER_ID` | Verified existing Auth UUIDs; distinct and required |
| `E2E_SUPABASE_SERVICE_ROLE_KEY` | One-time approved seed only; omit for normal runs |

No `E2E_*` credential belongs in `EXPO_PUBLIC_*`. New Supabase API keys are sent
on `apikey`; only legacy JWT keys also use `Authorization: Bearer`. See the
[official API key guidance](https://supabase.com/docs/guides/api/api-keys).

## Normal lifecycle and shared-account lock

`npm run test:qa:check` executes health, identity, tier, read/write and cleanup
checks. `npm run test:e2e:branch` holds the same lifecycle around the complete
TesterArmy run, including collection and server use:

1. Check Auth health; password-login both existing accounts, check exact UUID and
   email, verify each identity again with server `GET /auth/v1/user`, require the
   effective free/Plus tier, and check own-data read access. No seed or password
   reset occurs. Use an Auth policy that permits multiple sessions; a contender's
   fresh login must not invalidate the owner's session.
2. Claim `qa_account_leases` for both accounts. A database primary key, with RLS
   limited to `auth.uid()`, makes the lock effective across machines/checkouts.
   A conflict fails the run. Every agent using these accounts must use this
   runner; the lock coordinates the harness, not arbitrary manual app activity.
3. Save a private recovery manifest and sessions in `.auth/runs/<run-UUID>/`
   (directory 0700, files 0600). Existing `.auth/free.json` is never reused by the
   branch runner. No session/token is put in SDK arguments or HTTP/model traces.
4. Insert one synthetic, unanalysed dream per account, with `QA:<run-UUID>:<tier>`
   title and a registered unique `client_request_id`. Both browser cases assert
   their session and this server-backed journal fixture. No AI, image, payment,
   quota reset or entitlement mutation occurs.
5. In `finally`, select by **both user UUID and exact registered request UUID**,
   verify the run title, delete that exact fixture, verify absence, release only
   this run's lease, and close only this run's local Auth session. Existing dreams,
   images, receipts, quota and accounts remain. Successful runs remove only their
   private run directory and record a redacted receipt.

An insert's response can be lost and commit after an immediate empty read.
Any indeterminate claim/fixture write retains its manifest and account ownership
for explicit recovery; it never releases on an immediate empty observation.
Registered IDs restrict later owner recovery to that attempted run. Cleanup
failure is a failed run, retains that account's lease and recovery manifest, and
never becomes a pass because the browser passed. There is **no expiry, automatic
lock stealing, whole-account reset or global logout**. For crash/cleanup recovery,
the QA owner first verifies the recorded runner has stopped, checks target and
manifest UUIDs, then removes only the matching run fixtures/lease. Renew local
credentials through the approved secure store if the session expired. Never
release another run or delete account-wide data to bypass a busy account.

## Commands and validation

- `npm run test:env:check`: pure configuration/target guard, no network.
- `npm run test:qa:check`: guarded hosted lifecycle, no browser; currently blocked
  because the target/credentials do not exist.
- `npm run test:e2e:branch`: two TesterArmy saved-session + journal cases on QA;
  currently unexecuted against a hosted target.
- `npm run test:qa:guards`: deterministic failure/recovery coverage without secrets
  or remote services (busy account, uncertain claim, failed cleanup, wrong UUID,
  body failure and production/unconfigured refusal).
- `npm run test:qa:local`: canonical native Supabase runner, the existing eight
  backend browser cases, then two reusable-account cycles on that same owned
  stack. It checks identical Auth UUIDs, preserved pre-existing data, database
  lock contention, cross-account RLS and exact cleanup. It creates synthetic
  accounts once for this stack, **then destroys the entire stack**. This is an
  integration contract, not a hosted account kept available between invocations.
  Redacted receipt: ignored `test-results/persistent-qa-local.json`.
- `npm run test:seed-users`: approved provisioning only. Creates missing dedicated
  users and assigns their initial server tier with `apply_subscription_state_update`;
  existing identities are returned unchanged. No password, dreams, quota, storage,
  rate buckets, sync receipts or entitlement reset. It is never called by a run.
- `npm run test:auth-setup`: legacy standalone API session export, excluded from
  normal branch runs; it does not acquire a shared-account lease. Do not use its
  files to bypass `test:qa:check` / `test:e2e:branch`.

The native runtime is the pinned Supabase CLI 2.121.0 on supported hosts. No
Docker/Podman fallback. Native proof is recorded separately in the
[migration evidence](../../tools/e2e/MIGRATION.md).

## Web boundaries and future mobile

The branch Expo start removes shell credentials/endpoints and `NODE_OPTIONS` /
`NODE_PATH`, forces `EXPO_NO_DOTENV=1`, and rechecks the approved QA URL/keys in
`expo-safe-runner`. RevenueCat, Google and Turnstile credentials are absent.
The subscription service reads the server-owned metadata tier; branch Functions
must also have no RevenueCat secret, so refresh cannot silently downgrade Plus.
Email/password Auth must be enabled with QA captcha off; production Auth is unchanged.

The browser fixture aborts production HTTP and Realtime WebSocket requests.
The latter and private session injection still use the preserved public browser
surface because this locked TesterArmy Browser API lacks equivalents. No model
or HTTP payload trace is enabled. Reports identify revision, target and cleanup.
The branch remains excluded from `test:testerarmy:all` while unprovisioned.

No shared-account mobile journey is qualified. A future one needs an owned build
pointed at QA and its device lock; a production build cannot use this profile.
The retired Maestro sign-in never ran and provides no coverage proof. Keep
isolated ephemeral accounts for tests that intentionally sign up/delete users.

Supabase references: [password login](https://supabase.com/docs/reference/javascript/auth-signinwithpassword),
[server identity check](https://supabase.com/docs/reference/javascript/auth-getuser),
[branching](https://supabase.com/docs/guides/deployment/branching),
[branch configuration](https://supabase.com/docs/guides/deployment/branching/configuration),
[usage and billing](https://supabase.com/docs/guides/platform/manage-your-usage/branching).
