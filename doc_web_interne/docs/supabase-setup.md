Supabase backend (Auth + DB + Gemini proxy)

Overview
- Use Supabase for Auth + Postgres + Row Level Security.
- Add a single Edge Function `api` that exposes routes used by the app: `/analyzeDream`, `/generateImage`.
- Keep the Gemini API key secret in the Edge Function; the Expo app never sees it.

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
with `pg_temp`, in the definition or with `alter function ... set search_path`. The same lint
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
- Optional Anthropic secret: `supabase secrets set ANTHROPIC_API_KEY="your_key" --project-ref <project-ref>`. With it, every text feature sends its text to Anthropic and runs on Claude Haiku 5.5: dream analysis and chat at medium effort; categorization, recall questions and recall formatting at low effort. Each falls back to Gemini on any failure, and images stay on Gemini. Without it, all text stays on Gemini.

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
- Backend calls Gemini to analyze and stores in `public.dreams`. Illustration is a separate optional endpoint; the current image endpoint returns a placeholder URL.
- Guests can record up to five dreams locally, counted cumulatively even after deletion. Costly AI usage (analysis, illustrations, chat) has separate quotas. Once authenticated, new dreams are persisted to `public.dreams` via Supabase and synced back into the journal automatically.

Notes
- You can expand with additional endpoints later (chat, TTS) using the same pattern.
- If you need image generation, swap the placeholder with an API like Replicate or Stable Diffusion (store API key as a secret).
