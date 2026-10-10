# Shared test login (status: guard only, seed blocked)

Goal (fleet decision, 2026-10-10): dedicated test accounts on a test or staging
Supabase project, logged in through the API, so agents reuse a saved session
instead of driving the login screen. dreamer is the reference for the other repos.

## Status

- **No test or staging Supabase project exists.** The only hosted project in the
  repo is production, `usuyppgsmmowzizhaoqj` (`app.json`,
  `PRODUCTION_CONSTANTS.md`, and also `.env.teststore`, `.env.playstore`,
  `.env.lucid.teststore`). The only non-production backend is the disposable local
  stack of `npm run test:e2e:backend` (Docker, `127.0.0.1:56321`), whose fixtures
  already create throwaway accounts per test.
- So `npm run test:seed-users` and the API login step are **not built yet**. What
  exists today is the guard they must call first, the allowlist (empty), the
  variable names and this doc.

## Guard (`scripts/test-supabase-guard.mjs`)

Every test-login script must call `runGuarded(env, action)` (or
`assertTestSupabaseTarget`) before any network call. It refuses, with no override:

- the production project `usuyppgsmmowzizhaoqj`, also when its ref or its public
  key appears in any `E2E_*` value, and even if someone allowlists it;
- any ref not listed in `scripts/test-supabase-targets.json` (empty today, so
  every project is refused: fail closed);
- a URL that is not exactly `https://<ref>.supabase.co` (no port, path, custom
  domain or local URL);
- `E2E_SUPABASE_PROJECT_REF` missing or different from the URL ref, and a legacy
  JWT key whose `ref` claim names another project;
- any account email other than `e2e+free@<domain>` and `e2e+premium@<domain>`.

`npm run test:env:check` reads `.env.test.local` and runs the guard. It makes no
request and never prints a key or a password. Adding a test ref to the allowlist is
an owner-reviewed change (the file is in `deliveryFiles`).

## Variables (`.env.test.local`, gitignored; names in `.env.test.example`)

| Name | Content |
| --- | --- |
| `E2E_SUPABASE_URL` | `https://<test-ref>.supabase.co` |
| `E2E_SUPABASE_PROJECT_REF` | the test project ref, equal to the URL ref |
| `E2E_SUPABASE_ANON_KEY` | test project publishable (anon) key, for the password grant |
| `E2E_SUPABASE_SERVICE_ROLE_KEY` | test project secret (service role) key, for the seed only |
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
`p_tier: 'plus', p_is_active: true, p_source: 'local-e2e-fixture'`. The seed will
do the same on the test project; no RevenueCat sandbox user is needed. The client
also asks RevenueCat; with no RevenueCat customer the server tier is what the
journeys see (to confirm on the first real run).

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

## Planned, once a test project exists

1. `npm run test:seed-users`: through `runGuarded`, create or reset
   `e2e+free@<domain>` and `e2e+premium@<domain>` with the admin API (password from
   env, `email_confirm: true`), delete their dreams, set premium with the RPC above.
2. `npm run test:auth-setup`: password grant (`/auth/v1/token?grant_type=password`
   with the anon key) per account, session written to `.auth/<account>.json`
   (gitignored, mode 0600), never logged.
3. Web: Playwright `storageState` built from that session (the Supabase web client
   stores it in `localStorage` under `sb-<ref>-auth-token`), wired as a setup project
   for real-backend suites and for the TesterArmy web engine (`tools/e2e`). The mock
   suites keep their simulated auth.
4. Mobile: no new code in the app. Maestro types the test credentials into the
   existing password form (it ships in every build already), reading them from the
   owner machine env. A dev-only session-injection deep link would add prod-risk
   surface for little gain; if one is ever wanted, it must be gated on `__DEV__`
   and a dev-client-only plugin, with a test that the release bundle lacks it.

## Owner steps (thanh)

1. Create a Supabase test project (free tier is enough) or a branch of production
   if the plan allows it; apply `supabase/migrations` (`supabase link` then
   `supabase db push` on the test ref). In its dashboard: Auth > Providers > Email
   on, password sign-in on, confirm email off or seed with `email_confirm`; Auth
   captcha off; no Google provider needed.
2. Send the test ref through review: add it to
   `scripts/test-supabase-targets.json` (`allowedProjectRefs`).
3. On the PC Tanuki and the Mac mini, copy `.env.test.example` to
   `.env.test.local` and fill it (test project URL, ref, keys, domain, two
   passwords). Run `npm run test:env:check`: it must print the allowlisted URL.
4. Production dashboard: nothing changes.
