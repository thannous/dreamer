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

create policy "dreams select own" on public.dreams
  for select using (auth.uid() = user_id);
create policy "dreams insert own" on public.dreams
  for insert with check (auth.uid() = user_id);
create policy "dreams update own" on public.dreams
  for update using (auth.uid() = user_id);
create policy "dreams delete own" on public.dreams
  for delete using (auth.uid() = user_id);
```

If you already created the table earlier, run:

```sql
alter table public.dreams
add column if not exists image_generation_failed boolean default false;
```

3) Edge Function: `api`
- Requires the Supabase CLI: https://supabase.com/docs/guides/cli
- Initialize functions in a separate folder or clone `supabase/functions/api/index.ts` from this repo.
- Set Gemini secret: `supabase secrets set GEMINI_API_KEY="your_key" --project-ref <project-ref>`.

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
- Backend calls Gemini to analyze and stores in `public.dreams`. Image endpoint returns a placeholder URL.
- Guests can create up to two dreams (stored locally). Once authenticated, new dreams are persisted to `public.dreams` via Supabase and synced back into the journal automatically.

Notes
- You can expand with additional endpoints later (chat, TTS) using the same pattern.
- If you need image generation, swap the placeholder with an API like Replicate or Stable Diffusion (store API key as a secret).
