Backend proxy integration

Configure API base URL
- Use env var at start time: `EXPO_PUBLIC_API_URL=http://localhost:3000`
- Or set `extra.apiUrl` in `app.json`
- Default fallback if unset: `http://localhost:3000`
- For Supabase, create `.env.supabase` (see `doc_web_interne/docs/supabase-setup.md`) then run `npm run start:supabase` to load env vars automatically.

Supabase Edge Functions
- You can deploy a single function named `api` and route inside it. Then set:
  - `EXPO_PUBLIC_API_URL=https://<project-ref>.functions.supabase.co/api`
  - Requests will go to `/api/analyzeDream`, `/api/generateImage`, etc.
  - See `supabase/functions/api/index.ts` and `doc_web_interne/docs/supabase-setup.md`.

DB Contract Readiness
- The checked-in contract lives at `supabase/db-contract.manifest.json`.
- It covers the runtime objects the mobile app currently depends on for dream sync and quota flows:
  - tables and key columns for `public.dreams`, `public.ai_jobs`, `public.quota_limits`, `public.quota_usage`, and `public.guest_usage`
  - RPCs used by guest flows and async image jobs: `get_guest_quota_status`, `increment_guest_quota`, `release_guest_quota_claim`, and `mark_fingerprint_upgraded`
  - quota trigger functions and `public.dreams` triggers that enforce monthly limits and per-dream chat limits
  - critical uniqueness/index assumptions for dream sync and async image-job deduplication, plus seeded monthly `quota_limits` rows for `guest`, `free`, `plus`, and `premium`
  - guest image quota behavior checks, so stale RPC implementations that omit `image_count` or fail to claim/release image quota now fail readiness
- Run the readiness check against a database with:
  - `npm run db:contract:check -- --local` after `npx supabase start`
  - or `SUPABASE_DB_URL=postgresql://... npm run db:contract:check`
- A failure means the live database has drifted from the checked-in contract: an expected table, column, function, trigger, index, or seeded quota row is missing or no longer matches.

Expected endpoints
- POST `/transcribe`
  - Request JSON: `{ "contentBase64": string, "encoding": "LINEAR16"|"AMR_WB"|"WEBM_OPUS", "languageCode": string, "sampleRateHertz"?: number }`
  - Response JSON: `{ "transcript": string }`
  - Auth: public (no Supabase JWT required)

- POST `/analyzeDream`
  - Request JSON: `{ "transcript": string }`
  - Response JSON: `{ "title": string, "interpretation": string, "shareableQuote": string, "theme": "surreal"|"mystical"|"calm"|"noir", "dreamType": string, "imagePrompt": string }`
  - Env required: `GEMINI_API_KEY`
  - Optional env overrides:
    - `GEMINI_MODEL` (default `gemini-3-flash-preview`)
    - `GEMINI_FALLBACK_MODEL` (default `gemini-3.1-flash-lite-preview`)
    - `GEMINI_LITE_MODEL` (default `gemini-3.1-flash-lite-preview`)
    - `IMAGEN_MODEL` (default `gemini-3.1-flash-image-preview`)

- POST `/generateImage`
  - Request JSON: `{ "prompt": string }`
  - Response JSON: either `{ "imageUrl": string }` or `{ "imageBytes": base64-string }`
  - Auth: public (temporary)

- POST `/analyzeDreamFull`
  - Request JSON: `{ "transcript": string }`
  - Response JSON: `{ "title": string, "interpretation": string, "shareableQuote": string, "theme": "surreal"|"mystical"|"calm"|"noir", "dreamType": string, "imagePrompt": string, "imageBytes": base64-string }`
  - Notes: Combines analysis and image generation in one call. Client can build a data URL as `data:image/jpeg;base64,${imageBytes}`.

- POST `/chat`
  - Request JSON: `{ "history": [{ "role": "user"|"model", "text": string }], "message": string, "lang": string }`
  - Response JSON: `{ "text": string }`
  - Auth: public (no Supabase JWT required)

- POST `/tts`
  - Request JSON: `{ "text": string }`
  - Response JSON: `{ "audioBase64": base64-string }`

Minimal Express stub (for local testing)
```ts
import express from 'express';
import cors from 'cors';
const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.post('/analyzeDream', (req, res) => {
  const transcript = String(req.body?.transcript || '');
  res.json({
    title: transcript ? `On ${transcript.slice(0,40)}…` : 'A Journey Through Sleep',
    interpretation: 'Your dream reflects inner thoughts seeking balance.\n\nSymbols suggest transformation and curiosity.',
    shareableQuote: 'Between starlight and silence, a truth softly emerges.',
    theme: 'surreal',
    dreamType: 'Lucid Dream',
    imagePrompt: 'A surreal nocturne with floating lights over a still sea.',
  });
});

app.post('/generateImage', (_req, res) => {
  res.json({ imageUrl: 'https://picsum.photos/800/1200' });
});

app.post('/chat', (req, res) => {
  const message = String(req.body?.message || '');
  res.json({ text: `Let’s unpack that: “${message}”. What feelings stood out most?` });
});

app.post('/tts', (req, res) => {
  // Return silent PCM or any base64; client expects base64 string
  res.json({ audioBase64: '' });
});

app.listen(3000, () => console.log('API on http://localhost:3000'));
```
