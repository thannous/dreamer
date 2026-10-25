Supabase backend (Auth + DB + AI API)

Overview
- Use Supabase for Auth + Postgres + Row Level Security.
- Add a single Edge Function `api` that exposes routes used by the app: `/analyzeDream`, `/generateImage`.
- Keep both provider API keys secret in the Edge Function; the Expo app never sees it.

1) Create project
- Go to supabase.com, create a new project.
- Note the `Project URL` and `anon` key (Settings > API).

2) Create table and RLS
Run this SQL in the Supabase SQL editor:

```sql
create table if not exists public.dreams (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  transcript text not null,
  title text not null,
  interpretation text not null,
  shareable_quote text not null,
  image_url text,
  chat_history jsonb not null default '[]',
  theme text,
  dream_type text not null,
  is_favorite boolean default false,
  image_generation_failed boolean default false,
  created_at timestamptz default now()
);

alter table public.dreams enable row level security;

-- New tables get no Data API privilege by default: grant them explicitly.
grant select, insert, update, delete on table public.dreams to authenticated, service_role;
revoke all on table public.dreams from anon;
grant usage, select on sequence public.dreams_id_seq to authenticated, service_role;
revoke all on sequence public.dreams_id_seq from anon;

create policy "dreams select own" on public.dreams
  for select using (auth.uid() = user_id);
create policy "dreams insert own" on public.dreams
  for insert with check (auth.uid() = user_id);
create policy "dreams update own" on public.dreams
  for update using (auth.uid() = user_id);
create policy "dreams delete own" on public.dreams
  for delete using (auth.uid() = user_id);
```

New tables need explicit grants. From 2026-10-30 Supabase gives a new table in `public`
no privilege for `anon`, `authenticated` or `service_role` (without one, PostgREST answers
42501), and `supabase/config.toml` sets `[api] auto_expose_new_tables = false` so the local
stack does the same. A migration that creates a table in `public` must, in the same file,
enable RLS on it and grant or revoke it explicitly for each of the three roles, plus its
sequence for a serial or identity column (the SQL above does it for `dreams`); a new view
or sequence needs the same per-role grant or revoke. `npm run migrations:grants` (part of
`npm run verify:pr`) enforces it; the migrations from before the rule are listed in
`scripts/check-migration-grants.cjs`.

A `security definer` function in `public` (created, or switched with `alter function ...
security definer`) keeps EXECUTE for PUBLIC and anon unless revoked. The same migration must
`revoke execute on function public.X(...) from public, anon`, grant EXECUTE explicitly to the
roles that call it (for example `authenticated` or `service_role`), and set a safe
`search_path`: `set search_path = ''` (then qualify every object in the body) or a list ending
with `pg_temp`, in the definition or with `alter function ... set search_path`. Never give such a function to `anon`, `authenticated` or `service_role` as owner. For an owner-only function (a trigger function), write the decision as `grant execute on function ... to postgres`. The same lint
enforces it, with its own list of earlier migrations.

If you already created the table earlier, run:

```sql
alter table public.dreams
add column if not exists image_generation_failed boolean default false;
```

3) Edge Function: `api`
- Requires the Supabase CLI: https://supabase.com/docs/guides/cli
- Initialize functions in a separate folder or clone `supabase/functions/api/index.ts` from this repo.
- Set Gemini secret: `supabase secrets set GEMINI_API_KEY="your_key" --project-ref <project-ref>`.
- Required text provider: `ANTHROPIC_API_KEY`. Analysis, full analysis, preview, categorization, chat (JSON and SSE), recall, recall formatting, moon letters and the analysis worker use Claude Haiku 5.5 exclusively. Missing configuration returns 503 explicitly; provider failures/invalid output return retryable 502/504 errors with the existing `{error}` envelope. There is no Gemini text relay, including for long recall accounts. Images remain on Gemini; Google Speech-to-Text is unchanged. Setting secrets or deploying requires separate owner authorization.
- Server/app budgets (seconds): analysis 35/45 (full 35/60), chat stream 35/45, categorization 25/30, recall 12/15, full recall formatting 45/55, moon letter 50/60, preview reading 35/65 (painting follows separately). Formatting sends all accepted text up to 20,000 characters to Claude; failure preserves the draft and offers retry or original exchanges.
- Failed analysis reservations are released by `20261025160000_refund_failed_text_analysis.sql`: exact reservation identity, service-only idempotent RPCs for synchronous routes; queued retries retain their receipt until a terminal failure refunds it. Admission rate/abuse budgets still count attempts. Apply this migration and functions together only under a separately authorized rollout. Runtime settings `GEMINI_MODEL`, `GEMINI_CHAT_MODEL`, `GEMINI_FALLBACK_MODEL` and `GEMINI_RECALL_MODEL` no longer route text. `GEMINI_LITE_MODEL` remains for the image-prompt pipeline; offline `api/evaluation/` scripts still evaluate Gemini explicitly.

Key points
- Link project if needed: `supabase link --project-ref <project-ref>`.
- Deploy: `supabase functions deploy api`.
- Endpoint base: `https://<project-ref>.functions.supabase.co/api`.
- Set Expo env var: `EXPO_PUBLIC_API_URL` to that base.

4) Configure Expo env
- Create `.env.supabase` in the project root:
  ```env
  EXPO_PUBLIC_SUPABASE_URL=...
  EXPO_PUBLIC_SUPABASE_ANON_KEY=...
  SUPABASE_PROJECT_REF=usuyppgsmmowzizhaoqj
  # Optional override if you prefer not to derive it from the project ref
  # EXPO_PUBLIC_API_URL=https://usuyppgsmmowzizhaoqj.functions.supabase.co/api
  ```
- Run `npm run start:supabase` (loads `.env.supabase` then launches Expo).
- Alternative: set env vars manually as before or configure `app.json` `expo.extra` values.

5) Try the flow
- In the app Settings tab, sign up or sign in with email/password.
- Go to Recording, write a dream, tap Save.
- Backend calls Claude to analyze and stores in `public.dreams`. Illustration is a separate optional endpoint; the current image endpoint returns a placeholder URL.
- Guests can record up to five dreams locally, counted cumulatively even after deletion. Costly AI usage (analysis, illustrations, chat) has separate quotas. Once authenticated, new dreams are persisted to `public.dreams` via Supabase and synced back into the journal automatically.

Notes
- You can expand with additional endpoints later (chat, TTS) using the same pattern.
- If you need image generation, swap the placeholder with an API like Replicate or Stable Diffusion (store API key as a secret).

## iOS guest App Attest release preparation

The iOS `/guest/session` route requires an Apple App Attest proof before issuing
a guest AI token. Its short-lived challenge is signed by the Edge Function;
only a valid attestation or assertion writes the challenge digest to the
service-role-only database table. The key is bound to its first guest quota
fingerprint, and each assertion must advance its stored counter.

Configure the Edge Function with the existing `GUEST_SESSION_SECRET`,
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Set
`IOS_APP_ATTEST_ALLOWED_APPS` to a JSON array of exact identities. Each entry
has `teamId` (the 10-character Apple App ID prefix), `bundleId`,
`environment` (`development` or `production`), and
`allowedBundleVersions` (exact native `CFBundleVersion` strings). For example,
replace every illustrative Team ID and build number before use:

```json
[
  {
    "teamId": "AAAAAAAAAA",
    "bundleId": "com.tanuki75.noctalia",
    "environment": "production",
    "allowedBundleVersions": ["123"]
  },
  {
    "teamId": "AAAAAAAAAA",
    "bundleId": "com.tanuki75.noctalia.qa",
    "environment": "development",
    "allowedBundleVersions": ["7"]
  },
  {
    "teamId": "AAAAAAAAAA",
    "bundleId": "com.tanuki75.noctalia.lucid",
    "environment": "production",
    "allowedBundleVersions": ["1"]
  }
]
```

Lucid iOS uses the same App Attest exchange for consented guest analytics.
Its `lucid-production` build uses the production environment; a `lucid-preview`
ad-hoc build uses development and needs a separate exact allowlist entry if it
talks to this backend. Add the Lucid identity only when its signed binary and
analytics journey have been qualified. The guest token includes the attested
App ID; Lucid tokens can exchange for analytics sessions but cannot call
Dreamer guest quota or AI routes. Old iOS guest tokens without this binding
are rejected, so qualify fresh sessions when changing the server.

An internal ad-hoc build of the main bundle needs its own exact
`development` entry if it calls the same backend. The structured allowlist
takes precedence over the older single-app variables
`IOS_APP_ATTEST_TEAM_ID`, `IOS_APP_ATTEST_BUNDLE_ID`,
`IOS_APP_ATTEST_ENVIRONMENT` and
`IOS_APP_ATTEST_ALLOWED_BUNDLE_VERSIONS`; those four remain a fallback when
the JSON variable is absent. An invalid or missing configuration fails closed.
Keep all server secrets out of `EXPO_PUBLIC_*` and out of Git.
Apple's authenticated bundle-version extension is absent on some supported
iOS versions. In that case the verifier still checks the signed App ID and
environment, but it cannot enforce `allowedBundleVersions`; do not use that
list as a universal binary-version gate.

For a release, apply
`supabase/migrations/20261021201025_ios_guest_app_attest.sql` after checking
migration history, then configure the exact server identities. Enable the App
Attest capability and renew provisioning profiles for each Apple App ID used
by a native build. Check the signed binary's bundle ID, entitlement,
`CFBundleVersion`, distribution method and destination API. TestFlight and
App Store use Apple's production App Attest environment; development and
ad-hoc builds use the development environment. EAS remote build counters
can differ from the checked-in `app.json` value.

Qualify attestation, refresh assertion, quota access and refusal paths on an
owned physical iOS device against a matching non-production backend before
production activation. A Simulator cannot provide App Attest proof. The new
Edge route rejects old iOS v1 guest tokens immediately, while a new binary
needs its challenge endpoint; coordinate Edge activation and binary
availability with an explicit expectation that old iOS builds lose guest AI
until updated. Local dream recording remains separate. Local fixture and
database tests do not establish native or production qualification.

Apple references: [validating App Attest objects](https://developer.apple.com/documentation/devicecheck/validating-apps-that-connect-to-your-server),
[App Attest environment](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.devicecheck.appattest-environment).
