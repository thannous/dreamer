# Shared test login (persistent Supabase test branch)

Goal (fleet decision, 2026-10-10): dedicated test accounts on a test Supabase
backend, logged in through the API, so agents reuse a saved session instead of
driving the login screen. dreamer is the reference for the other repos.

## Status

- **Target (owner decision, option B):** a persistent Supabase branch of the
  production project, named `e2e`, with its own ref and keys, built from
  `supabase/migrations`, holding no production data. It is not created yet, so
  `scripts/test-supabase-targets.json` stays empty and every script refuses to run.
  Once it exists, its ref (placeholder `<e2e-branch-ref>`, a 20-character lowercase
  ref) goes into that file through a reviewed PR. Never put a fake ref there.
- **Built and tested with mocked fetch only:** `npm run test:seed-users`,
  `npm run test:auth-setup`, the opt-in Playwright suite `npm run test:e2e:branch`,
  the guarded Expo start `scripts/start-branch-e2e.mjs` and the Maestro flow
  `maestro/e2e-account-sign-in.yml`. None has run against a real branch yet.
- The only other non-production backend is the disposable local stack of
  `npm run test:e2e:backend` (Docker, `127.0.0.1:56321`); it is unchanged.

## Guard (`scripts/test-supabase-guard.mjs`)

Every test-login script must call `runGuarded(env, action)` before any network
call. The action receives `{ target, accounts, fetch }`: the canonical
`target.url`, only the two accounts built from `E2E_ACCOUNT_DOMAIN`
(`e2e+free@` and `e2e+premium@`), and a `fetch` that refuses any request whose
origin is not the target. It must use those and nothing else: never read
`E2E_SUPABASE_URL` itself, never take another address (a static test checks every
`scripts/test-*seed*` / `scripts/test-*auth*` script). The policy is not
configurable by callers: the production ref and key are pinned in the script, and
the allowlist is the committed file next to it (read relative to the script, not
the working directory). Only `_assertWithListsForTests` /
`_runGuardedWithListsForTests` take an allowlist, for the guard's own tests; no
runtime script may import them, and even they keep production forbidden. It
refuses, with no override:

- the production project `usuyppgsmmowzizhaoqj`, also when its ref or its public
  key appears in any `E2E_*` value, and even if someone allowlists it;
- any ref not listed in `scripts/test-supabase-targets.json` (empty today, so
  every project is refused: fail closed), and an allowlist entry that is not a
  20-character lowercase ref or is the production ref;
- a URL that is not byte for byte `https://<ref>.supabase.co` (one trailing slash
  allowed; no port, path, case change, whitespace, custom domain or local URL);
- a missing or invalid `E2E_ACCOUNT_DOMAIN` (before the action runs);
- `E2E_SUPABASE_PROJECT_REF` missing or different from the URL ref, and a legacy
  JWT key whose `ref` claim names another project;
- any account email other than `e2e+free@<domain>` and `e2e+premium@<domain>`.

`npm run test:env:check` reads `.env.test.local` and runs the guard. It makes no
request and never prints a key or a password. Adding a test ref to the allowlist is
an owner-reviewed change (the file is in `deliveryFiles`).

## Variables (`.env.test.local`, gitignored; names in `.env.test.example`)

| Name | Content |
| --- | --- |
| `E2E_SUPABASE_URL` | `https://<e2e-branch-ref>.supabase.co` |
| `E2E_SUPABASE_PROJECT_REF` | the branch ref, equal to the URL ref |
| `E2E_SUPABASE_ANON_KEY` | branch publishable (`sb_publishable_`) or legacy anon key: password grant, app |
| `E2E_SUPABASE_SERVICE_ROLE_KEY` | branch secret (`sb_secret_`) or legacy service_role key: seed only |
| `E2E_ACCOUNT_DOMAIN` | domain of the test accounts (`e2e+free@`, `e2e+premium@`) |
| `E2E_FREE_PASSWORD` | password of `e2e+free@<domain>` |
| `E2E_PREMIUM_PASSWORD` | password of `e2e+premium@<domain>` |

No RevenueCat key is needed (see Premium). These names are `E2E_*` on purpose: an
`EXPO_PUBLIC_*` name would be bundled into the app. No plus-address controlled by
the owner is documented in the repo, so the domain is env-driven.

## Premium mechanism (for the seed)

The server owns the tier. `public.apply_subscription_state_update(p_user_id,
p_tier, p_is_active, ...)` (migrations `20260316140000`, `20260316154500`),
callable with the service role, writes the subscription state that the quota
triggers and the app read (`app_metadata` tier, `plus` or `free`). RevenueCat
webhooks call the same path in production. The local backend fixture
(`e2e/backend/fixtures.ts`) already makes its Plus account this way with
`p_tier: 'plus', p_is_active: true, p_source: 'local-e2e-fixture'`. The seed does
the same on the branch.

RevenueCat can undo that: in a build with a RevenueCat key,
`hooks/useSubscriptionInternal.ts` replaces the optimistic metadata tier with the
RevenueCat status and calls `/subscription/refresh`, which maps a user with no
RevenueCat customer to `free` and writes it to the server. So the test runtime
keeps RevenueCat out on both sides:
- app: no `EXPO_PUBLIC_REVENUECAT_*` key. `scripts/start-branch-e2e.mjs` removes
  them and sets `EXPO_NO_DOTENV=1`, so web and dev builds use the store-less
  subscription service of `services/subscriptionService.ts`, which reads the
  `app_metadata` tier;
- branch functions: no `REVENUECAT_*` secret, so `/subscription/refresh` answers
  "RevenueCat not configured" (500) and applies nothing
  (`supabase/functions/api/routes/subscription.ts`).
A RevenueCat sandbox entitlement would be the alternative; it is not needed with
the two rules above (to confirm on the first real run).

## Login path and captcha

- Password sign-in already exists in the app (`components/auth/EmailAuthCard.tsx`,
  `signInWithEmailPassword` in `lib/auth.ts` and `lib/auth.web.ts`), in every build,
  for real users. It is a product feature of the production project, not a test
  switch, so this PR does not and cannot make password login "test only". The test
  project needs Email provider with password sign-in on; nothing is enabled on
  production by this work.
- Turnstile is used only for web guest sessions (`lib/turnstileWeb.ts`, edge
  function `guestSession`); no sign-in call passes a captcha token, and Supabase Auth
  captcha is off in `supabase/config.toml`. On the hosted test project, Auth captcha
  must stay off (dashboard) or the password grant fails. Production is unchanged.

## Scripts

All of them read `.env.test.local` (only the `E2E_*` names), go through the guard
before any request and print no key, password or token.

1. `npm run test:seed-users` (`scripts/test-seed-users.mjs`), with the secret
   (service role) key. For each of `e2e+free@<domain>` and `e2e+premium@<domain>`:
   find it through the admin API (`GET /auth/v1/admin/users`, paged), create it
   (`POST`, `email_confirm: true`) or reset its password (`PUT`), delete its dreams
   (`DELETE /rest/v1/dreams?user_id=eq.<id>`, as the local fixture does) and its
   quota usage (`DELETE /rest/v1/quota_usage?user_id=eq.<id>`: those rows are
   counted per month even when the dream is gone), then set
   its tier with `apply_subscription_state_update`: `p_tier 'plus', p_is_active
   true` for premium (the fixture's values), `p_tier 'free', p_is_active false` for
   free, `p_source 'e2e-seed'`, a fresh `p_source_event_id`. Idempotent: a second run
   resets the same two accounts and never touches another user. Passwords must be at
   least 12 characters.
2. `npm run test:auth-setup` (`scripts/test-auth-setup.mjs`), with the publishable
   (anon) key: password grant (`POST /auth/v1/token?grant_type=password`) per
   account, checks the session belongs to that account, and writes a Playwright
   storageState to `.auth/free.json` and `.auth/premium.json` (gitignored; folder
   0700, files 0600). Shape: origin `http://127.0.0.1:8087`, localStorage key
   `sb-<ref>-auth-token` holding the session JSON, which is what the web app's
   supabase-js client reads (`lib/supabase.ts` keeps the default storage and key
   on web; supabase-js 2.89 stores `JSON.stringify(session)` under
   `sb-<hostname first label>-auth-token`).
3. Key headers: new `sb_publishable_`/`sb_secret_` keys are sent on `apikey` only,
   legacy JWT keys also as `Authorization: Bearer`
   ([API keys, Known limitations](https://supabase.com/docs/guides/api/api-keys)).

## Web (Playwright)

`npm run test:e2e:branch` runs `playwright.branch.config.ts`, opt-in and separate
from the mock suite (`playwright.config.ts`) and the local backend suite, which do
not change. Its `auth-setup` project runs `npm run test:auth-setup`; the
`chromium-branch` project depends on it. The web server is
`scripts/start-branch-e2e.mjs`: it takes the target from the guard and starts Expo
with that URL, the branch publishable key, the branch functions URL
(`https://<ref>.functions.supabase.co/api`), `EXPO_PUBLIC_SUPABASE_FUNCTION_JWT` set to
the branch key (else `lib/http.ts` falls back to the production legacy JWT in
`app.json`), mock mode off and `EXPO_NO_DOTENV=1` (no `.env.local` mixed in); no
`E2E_*` or `EXPO_PUBLIC_REVENUECAT_*` variable reaches Metro. Edge Functions want
a JWT: use the branch legacy anon JWT as `E2E_SUPABASE_ANON_KEY` for journeys
that call them (the guard checks its `ref` claim names the branch); with a
publishable key, function calls may answer 401. Reports record `dirty` like the
other Playwright configs. Reuse in a spec:

```ts
import { test, expect } from './fixtures'; // e2e/branch/fixtures.ts
test.use({ account: 'premium' }); // starts signed in from .auth/premium.json
```

The fixture fails a test if any request reaches the production project. Traces are
off (they would record tokens). `e2e/branch/session.spec.ts` checks both accounts
open signed in. The TesterArmy engine (`tools/e2e`) keeps its mocked services; it
can load the same `.auth/<account>.json` later if a real-backend TesterArmy journey
is wanted.

## Mobile (Maestro)

No deep link and no app code. `maestro/e2e-account-sign-in.yml` opens Settings and
runs `maestro/subflows/sign-in-e2e-account.yml`, which types the account into the
existing EmailAuthCard form (`settings-account-open-signin`, `input.auth.email`,
`input.auth.password`, `btn.auth.signIn`) and checks `text.auth.email` shows an
`e2e+free@`/`e2e+premium@` address. A device already signed in (any account) is
signed out first (`btn.auth.signOut`), so reruns work; use a dev client kept for
tests. Credentials come only from the shell:
Maestro reads `MAESTRO_*` variables. On the owner machine, with a dev client on
Metro started against the branch:

```sh
node scripts/start-branch-e2e.mjs            # guarded; refuses production
MAESTRO_E2E_EMAIL="e2e+free@$E2E_ACCOUNT_DOMAIN" MAESTRO_E2E_PASSWORD="$E2E_FREE_PASSWORD" \
  maestro test maestro/e2e-account-sign-in.yml
```

A release build talks to production, where these accounts do not exist, so the
flow fails there by design.

## supabase/config.toml: unchanged (decision)

- Branching reads `config.toml` only through the GitHub integration: the deployment
  step "Configure - Updates service configurations based on your config.toml file"
  is "only available for Branching via GitHub"
  ([Branching](https://supabase.com/docs/guides/deployment/branching)).
- A persistent branch gets its own settings from a `[remotes.<name>]` block whose
  `project_id` "must reference an existing branch", applied "when merging a PR
  into a persistent branch"; with no remote or a wrong id "the configuration step is
  skipped" ([Branching configuration](https://supabase.com/docs/guides/deployment/branching/configuration)).
  The branch ref does not exist yet and a fake ref is not allowed, so no block now.
- On the production branch, the GitHub integration's "Deploy to production"
  applies new migrations and deploys Edge Functions and storage buckets declared in
  `config.toml`; "All other configurations, including API, Auth, and seed files, are
  ignored by default"
  ([GitHub integration](https://supabase.com/docs/guides/deployment/branching/github-integration)).
  So the top-level `[auth]` block would not change production auth by default, but
  the integration would push migrations and functions to production on every merge
  to `master`, outside the owner-machine release rule. Ephemeral preview branches
  also get the top-level config.
- Recommendation: no GitHub integration. Create the branch with the CLI or the
  dashboard and set its Auth settings in the dashboard with the branch selected
  ("Any changes you make (including ... configuration changes) are now made against
  the currently selected branch",
  [Branching via the dashboard](https://supabase.com/docs/guides/deployment/branching/dashboard)).
  If the integration is ever enabled, add `[remotes.e2e]` (real `project_id`, email
  password on, captcha off) and keep "Deploy to production" off.

## Owner steps (thanh)

See the click-level list below; production auth settings never change.

1. Plan: branching needs the Pro plan or above; a branch is billed for its usage,
   from $0.01344 per hour on Micro compute, and branch compute is not covered by
   compute credits or the spend cap
   ([Manage Branching usage](https://supabase.com/docs/guides/platform/manage-your-usage/branching)).
2. Create the persistent branch `e2e` without data:
   CLI (recommended): `supabase branches create e2e --persistent --project-ref usuyppgsmmowzizhaoqj`
   (no `--with-data`). Dashboard alternative (public alpha): user menu (top right)
   > Branching via dashboard > Enable feature; top bar branch selector > Create
   branch `e2e`, Include data left off; then make it persistent with
   `supabase branches update e2e --persistent` (the dashboard "Switch to
   persistent" item may only appear for Git-linked branches).
3. Migrations: a new branch is a clone of the production schema built from the
   production migration history ("Pull - Retrieves database migrations from your
   main project"). Check it: `supabase link --project-ref <e2e-branch-ref>`, then
   `supabase migration list --linked` must show every file of `supabase/migrations`
   on both sides; apply any missing one with `supabase db push` (still linked to
   the branch). Re-link production afterwards if you use the link elsewhere.
4. Ref and keys: `supabase branches list` (column `BRANCH PROJECT ID`) or the
   dashboard with `e2e` selected; URL `https://<e2e-branch-ref>.supabase.co`;
   keys under Settings > API Keys with `e2e` selected, or
   `supabase projects api-keys --project-ref <e2e-branch-ref>` (a branch has its
   own keys).
5. Auth on the branch (`e2e` selected): Authentication > Sign In / Providers >
   Email enabled; captcha off at Settings > Authentication > Bot and Abuse
   Protection > Enable CAPTCHA protection (off). The seed confirms the accounts,
   so email confirmation can stay on.
6. Reconcile cron: two migrations (`20251222162951_` and
   `20251223000000_schedule_revenuecat_reconcile.sql`) schedule
   `revenuecat_reconcile_daily` with a hard-coded production functions URL. With
   `e2e` selected, SQL editor: `select cron.unschedule('revenuecat_reconcile_daily');`.
   The job only calls out when the vault holds `revenuecat_reconcile_secret`; never
   add it, nor any `REVENUECAT_*` function secret, to the branch
   (`supabase secrets list --project-ref <e2e-branch-ref>` shows none).
7. No production data: with `e2e` selected, Authentication > Users is empty and
   Table Editor > `dreams` has no rows before the first seed.
8. Review PR: add `<e2e-branch-ref>` to `scripts/test-supabase-targets.json`.
9. On the PC Tanuki and the Mac mini: copy `.env.test.example` to
   `.env.test.local`, fill it, run `npm run test:env:check`, then
   `npm run test:seed-users` and `npm run test:auth-setup`.
